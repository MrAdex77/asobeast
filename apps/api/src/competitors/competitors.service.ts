import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CompetitorAnalysis,
  CompetitorDiscovery,
  CompetitorGapKeyword,
  CompetitorMetadataRow,
  KeywordComparison,
  PositionMapPoint,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { visibility } from '../analytics/visibility';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { toDifficulty100 } from '../scoring/formulas';
import { aggregateDiscovery } from './discovery';
import { DiscoveryQueryDto } from './dto/discovery-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

interface AppRow {
  id: string;
  name: string | null;
  snapshots: {
    title: string;
    subtitle: string | null;
    ratingAvg: number | null;
  }[];
}

@Injectable()
export class CompetitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keywords: KeywordsService,
  ) {}

  async analysis(appId: string): Promise<CompetitorAnalysis> {
    await this.ensureApp(appId);
    const [comparison, tracked, primary, competitors] = await Promise.all([
      this.keywords.compare(appId, false),
      this.keywords.listTracked(appId),
      this.appRow({ id: appId }),
      this.prisma.app.findMany({
        where: { primaryAppId: appId },
        orderBy: { createdAt: 'asc' },
        select: this.appSelect(),
      }),
    ]);
    if (!primary) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const trackedById = new Map(tracked.map((item) => [item.keywordId, item]));

    return {
      metadataComparison: [
        this.metadataRow(primary, true),
        ...competitors.map((competitor) => this.metadataRow(competitor, false)),
      ],
      gaps: this.gaps(comparison, trackedById),
      positionMap: this.positionMap(primary, competitors, comparison),
    };
  }

  async discovery(
    appId: string,
    query: DiscoveryQueryDto,
  ): Promise<CompetitorDiscovery> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, workspaceId: DEFAULT_WORKSPACE_ID },
      select: {
        storeAppId: true,
        competitors: { select: { storeAppId: true } },
        tracked: { where: { active: true }, select: { keywordId: true } },
      },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const known = [
      app.storeAppId,
      ...app.competitors.map((competitor) => competitor.storeAppId),
    ];
    const since = new Date(utcToday().getTime() - query.days * DAY_MS);

    const rows = await this.prisma.serpEntry.findMany({
      where: {
        keywordId: { in: app.tracked.map((item) => item.keywordId) },
        date: { gte: since },
        storeAppId: { notIn: known },
      },
      select: {
        storeAppId: true,
        title: true,
        developer: true,
        ratingAvg: true,
        ratingCount: true,
        position: true,
        date: true,
        keyword: { select: { text: true } },
      },
    });

    return {
      windowDays: query.days,
      items: aggregateDiscovery(
        rows.map((row) => ({
          storeAppId: row.storeAppId,
          title: row.title,
          developer: row.developer,
          ratingAvg: row.ratingAvg,
          ratingCount: row.ratingCount,
          position: row.position,
          date: row.date,
          keywordText: row.keyword.text,
        })),
      ),
    };
  }

  private gaps(
    comparison: KeywordComparison,
    tracked: Map<string, TrackedKeywordItem>,
  ): CompetitorAnalysis['gaps'] {
    const theyRankYouDont: CompetitorGapKeyword[] = [];
    const youRankTheyDont: CompetitorGapKeyword[] = [];
    const outranked: CompetitorGapKeyword[] = [];

    for (const row of comparison.rows) {
      const best = comparison.competitors
        .map((competitor) => ({
          id: competitor.id,
          position: row.positions[competitor.id] ?? null,
        }))
        .filter(
          (entry): entry is { id: string; position: number } =>
            entry.position !== null,
        )
        .sort((a, b) => a.position - b.position)[0];

      const item = tracked.get(row.keywordId);
      const base = {
        keywordId: row.keywordId,
        text: row.text,
        volume: item?.volume ?? null,
        difficulty:
          row.difficulty === null ? null : toDifficulty100(row.difficulty),
        opportunity: item?.opportunity ?? null,
        yourPosition: row.you,
        bestCompetitorPosition: best?.position ?? null,
        bestCompetitorId: best?.id ?? null,
      };

      if (row.you === null && best) {
        theyRankYouDont.push({ ...base, gap: null });
      } else if (row.you !== null && !best) {
        youRankTheyDont.push({ ...base, gap: null });
      } else if (row.you !== null && best && row.you > best.position) {
        outranked.push({ ...base, gap: row.you - best.position });
      }
    }

    theyRankYouDont.sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0));
    return { theyRankYouDont, youRankTheyDont, outranked };
  }

  private positionMap(
    primary: AppRow,
    competitors: AppRow[],
    comparison: KeywordComparison,
  ): PositionMapPoint[] {
    const point = (app: AppRow, isYou: boolean): PositionMapPoint => ({
      appId: app.id,
      name: app.name,
      isYou,
      ratingAvg: app.snapshots[0]?.ratingAvg ?? null,
      visibility: visibility(
        comparison.rows.map((row) => ({
          traffic: row.traffic,
          position: isYou ? row.you : (row.positions[app.id] ?? null),
        })),
      ),
    });
    return [
      point(primary, true),
      ...competitors.map((competitor) => point(competitor, false)),
    ];
  }

  private metadataRow(app: AppRow, isYou: boolean): CompetitorMetadataRow {
    const snapshot = app.snapshots[0] ?? null;
    return {
      appId: app.id,
      name: app.name,
      isYou,
      title: snapshot?.title ?? null,
      titleChars: snapshot?.title.length ?? 0,
      subtitle: snapshot?.subtitle ?? null,
      subtitleChars: snapshot?.subtitle?.length ?? 0,
    };
  }

  private appSelect() {
    return {
      id: true,
      name: true,
      snapshots: {
        orderBy: { capturedAt: 'desc' as const },
        take: 1,
        select: { title: true, subtitle: true, ratingAvg: true },
      },
    };
  }

  private async appRow(where: { id: string }): Promise<AppRow | null> {
    return this.prisma.app.findFirst({
      where: { ...where, workspaceId: DEFAULT_WORKSPACE_ID },
      select: this.appSelect(),
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
