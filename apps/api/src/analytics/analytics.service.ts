import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppSummary,
  CoverageSummary,
  KeywordMover,
  KeywordMovers,
  normalizeText,
  RankDistribution,
  RankDistributionHistory,
  UncoveredKeyword,
  VisibilityHistory,
  VisibilitySummary,
} from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeOpportunity,
  defaultRelevance,
  toDifficulty100,
  toVolume,
} from '../scoring/formulas';
import { KeywordSource } from '@prisma/client';
import { VisibilityHistoryQueryDto } from './dto/visibility-history-query.dto';
import { bucketPositions } from './rank-distribution';
import { visibility, VisibilityKeyword } from './visibility';

const DAY_MS = 24 * 60 * 60 * 1000;
const SUMMARY_WINDOW_DAYS = 31;
const MOVER_WINDOW_DAYS = 7;
const MOVER_TOLERANCE_MS = DAY_MS;
const MOVER_LIMIT = 5;
const UNRANKED_RANK = Number.MAX_SAFE_INTEGER;
const HIGH_OPPORTUNITY = 60;
const COVERAGE_LIMIT = 5;
const HISTORY_DEFAULT_DAYS = 30;
const HISTORY_MAX_DAYS = 180;

interface Metric {
  traffic: number | null;
  difficulty: number | null;
  date: Date;
}

interface Ranking {
  position: number | null;
  date: Date;
}

interface TrackedRow {
  keywordId: string;
  source: KeywordSource;
  relevance: number | null;
  keyword: {
    text: string;
    metrics: Metric[];
    rankings: Ranking[];
  };
}

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_MS);

const startOfUtcDay = (date: Date): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const utcToday = (): Date => startOfUtcDay(new Date());

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const isSameDay = (a: Date, b: Date): boolean => a.getTime() === b.getTime();

const positionAt = (rankings: Ranking[], date: Date): number | null =>
  rankings.find((ranking) => isSameDay(ranking.date, date))?.position ?? null;

const metricAt = (metrics: Metric[], date: Date): Metric | null =>
  metrics.find((metric) => metric.date.getTime() <= date.getTime()) ?? null;

const nearestPosition = (rankings: Ranking[], target: Date): number | null => {
  let closest: Ranking | null = null;
  for (const ranking of rankings) {
    const distance = Math.abs(ranking.date.getTime() - target.getTime());
    if (distance > MOVER_TOLERANCE_MS) {
      continue;
    }
    if (
      closest === null ||
      distance < Math.abs(closest.date.getTime() - target.getTime())
    ) {
      closest = ranking;
    }
  }
  return closest?.position ?? null;
};

const visibilityAt = (rows: TrackedRow[], date: Date): number =>
  visibility(
    rows.map((row): VisibilityKeyword => ({
      traffic: metricAt(row.keyword.metrics, date)?.traffic ?? null,
      position: positionAt(row.keyword.rankings, date),
    })),
  );

const covers = (field: string, keyword: string): boolean =>
  ` ${normalizeText(field)} `.includes(` ${keyword} `);

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(appId: string): Promise<AppSummary> {
    await this.ensureApp(appId);

    const referenceDate = await this.referenceDate(appId);
    const windowStart = referenceDate
      ? addDays(referenceDate, -SUMMARY_WINDOW_DAYS)
      : null;

    const [rows, snapshot, competitors] = await Promise.all([
      this.trackedRows(appId, windowStart, referenceDate),
      this.prisma.appSnapshot.findFirst({
        where: { appId },
        orderBy: { capturedAt: 'desc' },
        select: {
          title: true,
          subtitle: true,
          description: true,
          capturedAt: true,
        },
      }),
      this.prisma.app.count({ where: { primaryAppId: appId } }),
    ]);

    return {
      visibility: this.visibilitySummary(rows, referenceDate),
      rankDistribution: this.rankDistribution(rows, referenceDate),
      movers: this.movers(rows, referenceDate),
      coverage: this.coverage(rows, referenceDate, snapshot),
      lastRefreshAt: snapshot?.capturedAt.toISOString() ?? null,
      trackedKeywords: rows.length,
      competitors,
    };
  }

  async history(
    appId: string,
    query: VisibilityHistoryQueryDto,
  ): Promise<VisibilityHistory> {
    await this.ensureApp(appId);

    const to = query.to ? startOfUtcDay(new Date(query.to)) : utcToday();
    const from = query.from
      ? startOfUtcDay(new Date(query.from))
      : addDays(to, -HISTORY_DEFAULT_DAYS);

    if (to.getTime() - from.getTime() > HISTORY_MAX_DAYS * DAY_MS) {
      throw new BadRequestException(
        `Range must not exceed ${HISTORY_MAX_DAYS} days`,
      );
    }

    const rows = await this.trackedRows(appId, from, to);
    const dates = new Set<number>();
    for (const row of rows) {
      for (const ranking of row.keyword.rankings) {
        dates.add(ranking.date.getTime());
      }
    }

    const points = [...dates]
      .sort((a, b) => a - b)
      .map((time) => {
        const date = new Date(time);
        return { date: toDateKey(date), visibility: visibilityAt(rows, date) };
      });

    return { points };
  }

  async rankDistributionHistory(
    appId: string,
    query: VisibilityHistoryQueryDto,
  ): Promise<RankDistributionHistory> {
    await this.ensureApp(appId);

    const reference = await this.referenceDate(appId);
    const to = query.to
      ? startOfUtcDay(new Date(query.to))
      : (reference ?? utcToday());
    const from = query.from
      ? startOfUtcDay(new Date(query.from))
      : addDays(to, -HISTORY_DEFAULT_DAYS);

    if (to.getTime() - from.getTime() > HISTORY_MAX_DAYS * DAY_MS) {
      throw new BadRequestException(
        `Range must not exceed ${HISTORY_MAX_DAYS} days`,
      );
    }

    const rows = await this.trackedRows(appId, from, to);
    const byDate = new Map<number, Array<number | null>>();
    for (const row of rows) {
      for (const ranking of row.keyword.rankings) {
        const list = byDate.get(ranking.date.getTime()) ?? [];
        list.push(ranking.position);
        byDate.set(ranking.date.getTime(), list);
      }
    }

    const points = [...byDate.entries()]
      .sort(([a], [b]) => a - b)
      .map(([time, positions]) => ({
        date: toDateKey(new Date(time)),
        ...bucketPositions(positions),
      }));

    return { points };
  }

  private visibilitySummary(
    rows: TrackedRow[],
    referenceDate: Date | null,
  ): VisibilitySummary {
    if (!referenceDate) {
      return { current: 0, delta7d: null, delta30d: null };
    }
    const current = visibilityAt(rows, referenceDate);
    return {
      current,
      delta7d: this.delta(rows, referenceDate, current, 7),
      delta30d: this.delta(rows, referenceDate, current, 30),
    };
  }

  private delta(
    rows: TrackedRow[],
    referenceDate: Date,
    current: number,
    days: number,
  ): number | null {
    const past = addDays(referenceDate, -days);
    const hasCapture = rows.some((row) =>
      row.keyword.rankings.some((ranking) => isSameDay(ranking.date, past)),
    );
    if (!hasCapture) {
      return null;
    }
    return Math.round((current - visibilityAt(rows, past)) * 10) / 10;
  }

  private rankDistribution(
    rows: TrackedRow[],
    referenceDate: Date | null,
  ): RankDistribution {
    const distribution: RankDistribution = {
      top1: 0,
      top3: 0,
      top10: 0,
      top50: 0,
      beyond: 0,
      unranked: 0,
    };
    for (const row of rows) {
      const position = referenceDate
        ? positionAt(row.keyword.rankings, referenceDate)
        : null;
      if (position === null) {
        distribution.unranked += 1;
        continue;
      }
      if (position <= 1) distribution.top1 += 1;
      if (position <= 3) distribution.top3 += 1;
      if (position <= 10) distribution.top10 += 1;
      if (position <= 50) distribution.top50 += 1;
      if (position > 50) distribution.beyond += 1;
    }
    return distribution;
  }

  private movers(
    rows: TrackedRow[],
    referenceDate: Date | null,
  ): KeywordMovers {
    if (!referenceDate) {
      return { up: [], down: [] };
    }
    const target = addDays(referenceDate, -MOVER_WINDOW_DAYS);
    const up: Array<KeywordMover & { change: number }> = [];
    const down: Array<KeywordMover & { change: number }> = [];

    for (const row of rows) {
      const to = positionAt(row.keyword.rankings, referenceDate);
      const from = nearestPosition(row.keyword.rankings, target);
      const change = (from ?? UNRANKED_RANK) - (to ?? UNRANKED_RANK);
      const mover: KeywordMover & { change: number } = {
        keywordId: row.keywordId,
        text: row.keyword.text,
        from,
        to,
        change,
      };
      if (to !== null && change > 0) {
        up.push(mover);
      } else if (from !== null && change < 0) {
        down.push(mover);
      }
    }

    return {
      up: up
        .sort((a, b) => b.change - a.change)
        .slice(0, MOVER_LIMIT)
        .map(strip),
      down: down
        .sort((a, b) => a.change - b.change)
        .slice(0, MOVER_LIMIT)
        .map(strip),
    };
  }

  private coverage(
    rows: TrackedRow[],
    referenceDate: Date | null,
    snapshot: {
      title: string;
      subtitle: string | null;
      description: string;
    } | null,
  ): CoverageSummary {
    const title = snapshot?.title ?? '';
    const subtitle = snapshot?.subtitle ?? '';
    const description = snapshot?.description ?? '';
    const snapshotText = [title, subtitle, description].join(' ');

    let inTitle = 0;
    let inSubtitle = 0;
    let inDescription = 0;
    const uncovered: UncoveredKeyword[] = [];

    for (const row of rows) {
      const text = row.keyword.text;
      const hitTitle = covers(title, text);
      const hitSubtitle = covers(subtitle, text);
      const hitDescription = covers(description, text);
      if (hitTitle) inTitle += 1;
      if (hitSubtitle) inSubtitle += 1;
      if (hitDescription) inDescription += 1;

      if (hitTitle || hitSubtitle || hitDescription) {
        continue;
      }
      const metric = referenceDate
        ? metricAt(row.keyword.metrics, referenceDate)
        : null;
      const traffic = metric?.traffic ?? null;
      const difficulty = metric?.difficulty ?? null;
      const relevance =
        row.relevance ?? defaultRelevance(row.source, text, snapshotText);
      const opportunity = computeOpportunity(
        traffic === null ? null : toVolume(traffic),
        difficulty === null ? null : toDifficulty100(difficulty),
        relevance,
      );
      if (opportunity !== null && opportunity >= HIGH_OPPORTUNITY) {
        uncovered.push({ keywordId: row.keywordId, text, opportunity });
      }
    }

    return {
      inTitle,
      inSubtitle,
      inDescription,
      uncoveredHighOpportunity: uncovered
        .sort((a, b) => b.opportunity - a.opportunity)
        .slice(0, COVERAGE_LIMIT),
    };
  }

  private async referenceDate(appId: string): Promise<Date | null> {
    const latest = await this.prisma.keywordRanking.findFirst({
      where: { appId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    return latest?.date ?? null;
  }

  private async trackedRows(
    appId: string,
    windowStart: Date | null,
    referenceDate: Date | null,
  ): Promise<TrackedRow[]> {
    return this.prisma.trackedKeyword.findMany({
      where: { appId, active: true },
      orderBy: { createdAt: 'asc' },
      select: {
        keywordId: true,
        source: true,
        relevance: true,
        keyword: {
          select: {
            text: true,
            metrics: {
              where: referenceDate
                ? { date: { lte: referenceDate } }
                : undefined,
              orderBy: { date: 'desc' },
              select: { traffic: true, difficulty: true, date: true },
            },
            rankings: {
              where: {
                appId,
                ...(windowStart && referenceDate
                  ? { date: { gte: windowStart, lte: referenceDate } }
                  : {}),
              },
              orderBy: { date: 'desc' },
              select: { position: true, date: true },
            },
          },
        },
      },
    });
  }

  private async ensureApp(appId: string): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
  }
}

const strip = (mover: KeywordMover & { change: number }): KeywordMover => ({
  keywordId: mover.keywordId,
  text: mover.text,
  from: mover.from,
  to: mover.to,
});
