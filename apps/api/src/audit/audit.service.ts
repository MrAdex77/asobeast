import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import {
  AppAuditResult,
  AuditHistory,
  AuditInputAnswers,
  tokenize,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { extractRawFacts } from '../store-providers/raw-facts';
import { AuditContext, AuditKeyword } from './audit-checks';
import { AuditHistoryQueryDto } from './dto/audit-history-query.dto';
import { computeAudit } from './rubric';

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_WINDOW_DAYS = 30;
const DEFAULT_HISTORY_DAYS = 90;
const MAX_HISTORY_DAYS = 365;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keywords: KeywordsService,
  ) {}

  async audit(appId: string): Promise<AppAuditResult> {
    return computeAudit(await this.buildContext(appId));
  }

  async snapshotAll(): Promise<number> {
    const apps = await this.prisma.app.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID, isCompetitor: false },
      select: { id: true },
    });
    const date = utcDate();

    let saved = 0;
    for (const { id } of apps) {
      try {
        const result = await this.audit(id);
        await this.prisma.auditScore.upsert({
          where: { appId_date: { appId: id, date } },
          create: {
            appId: id,
            date,
            overall: result.overall,
            coveredWeight: result.coveredWeight,
            totalWeight: result.totalWeight,
            factors: toSlimFactors(result),
          },
          update: {
            overall: result.overall,
            coveredWeight: result.coveredWeight,
            totalWeight: result.totalWeight,
            factors: toSlimFactors(result),
          },
        });
        saved += 1;
      } catch (error) {
        this.logger.error(`audit snapshot failed for app ${id}`, error);
      }
    }

    this.logger.log(`audit snapshot saved ${saved}/${apps.length}`);
    return saved;
  }

  async history(
    appId: string,
    query: AuditHistoryQueryDto,
  ): Promise<AuditHistory> {
    await this.ensureApp(appId);

    const to = query.to ? new Date(query.to) : utcDate();
    const earliest = new Date(to.getTime() - MAX_HISTORY_DAYS * DAY_MS);
    const requestedFrom = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_HISTORY_DAYS * DAY_MS);
    const from = requestedFrom < earliest ? earliest : requestedFrom;

    const rows = await this.prisma.auditScore.findMany({
      where: { appId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        overall: true,
        coveredWeight: true,
        totalWeight: true,
      },
    });

    return {
      points: rows.map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        overall: row.overall,
        coveredWeight: row.coveredWeight,
        totalWeight: row.totalWeight,
      })),
    };
  }

  async saveInputs(
    appId: string,
    answers: AuditInputAnswers,
  ): Promise<AppAuditResult> {
    await this.ensureApp(appId);
    const payload = answers as Prisma.InputJsonValue;
    await this.prisma.auditInput.upsert({
      where: { appId },
      create: { appId, answers: payload },
      update: { answers: payload },
    });
    return this.audit(appId);
  }

  private async ensureApp(
    appId: string,
  ): Promise<{ id: string; store: Store; name: string | null }> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true, store: true, name: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return app;
  }

  private async buildContext(appId: string): Promise<AuditContext> {
    const app = await this.ensureApp(appId);
    const cutoff = new Date(Date.now() - TREND_WINDOW_DAYS * DAY_MS);

    const [latest, prior, tracked, comparison, competitors, inputRow] =
      await Promise.all([
        this.prisma.appSnapshot.findFirst({
          where: { appId },
          orderBy: { capturedAt: 'desc' },
        }),
        this.prisma.appSnapshot.findFirst({
          where: { appId, capturedAt: { lte: cutoff } },
          orderBy: { capturedAt: 'desc' },
          select: { ratingAvg: true, ratingCount: true },
        }),
        this.keywords.listTracked(appId),
        this.keywords.compare(appId, false),
        this.prisma.app.findMany({
          where: { primaryAppId: appId },
          select: {
            name: true,
            snapshots: {
              orderBy: { capturedAt: 'desc' },
              take: 1,
              select: { title: true },
            },
          },
        }),
        this.prisma.auditInput.findUnique({ where: { appId } }),
      ]);

    const active = tracked.filter((item) => item.active);

    return {
      appId,
      store: app.store,
      title: latest?.title ?? '',
      subtitle: latest?.subtitle ?? null,
      description: latest?.description ?? '',
      ratingAvg: latest?.ratingAvg ?? null,
      ratingCount: latest?.ratingCount ?? null,
      storeUpdatedAt: latest?.storeUpdatedAt ?? null,
      now: new Date(),
      rawFacts: extractRawFacts(app.store, latest?.raw),
      keywords: active.map(toAuditKeyword),
      rankings: this.rankingAggregates(active, comparison.rows),
      history: {
        ratingAvgDelta30d: delta(latest?.ratingAvg, prior?.ratingAvg),
        ratingCountDelta30d: delta(latest?.ratingCount, prior?.ratingCount),
      },
      competitorTitles: competitors
        .map((competitor) => competitor.snapshots[0]?.title)
        .filter((title): title is string => Boolean(title)),
      competitorNames: competitors
        .map((competitor) => competitor.name)
        .filter((name): name is string => Boolean(name)),
      brandTokens: tokenize(app.name ?? ''),
      answers: (inputRow?.answers as AuditInputAnswers) ?? {},
    };
  }

  private rankingAggregates(
    active: TrackedKeywordItem[],
    comparisonRows: { gap: boolean }[],
  ): AuditContext['rankings'] {
    const total = active.length;
    const ranked = active.filter((item) => item.latestPosition !== null);
    const top10 = ranked.filter(
      (item) => (item.latestPosition as number) <= 10,
    );
    const deltas = active
      .map((item) => item.positionDelta7d)
      .filter((value): value is number => value !== null);
    return {
      top10Share: total === 0 ? 0 : top10.length / total,
      rankedShare: total === 0 ? 0 : ranked.length / total,
      avgDelta7d:
        deltas.length === 0
          ? null
          : deltas.reduce((sum, value) => sum + value, 0) / deltas.length,
      gapCount: comparisonRows.filter((row) => row.gap).length,
    };
  }
}

const utcDate = (now = new Date()): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

const toSlimFactors = (result: AppAuditResult): Prisma.InputJsonValue =>
  result.factors.map((factor) => ({
    id: factor.id,
    score: factor.score,
    weight: factor.weight,
  }));

const toAuditKeyword = (item: TrackedKeywordItem): AuditKeyword => ({
  text: item.text,
  source: item.source,
  bucket: item.bucket,
  relevance: item.relevance ?? 0,
  position: item.latestPosition,
});

const delta = (
  current: number | null | undefined,
  past: number | null | undefined,
): number | null =>
  current === null ||
  current === undefined ||
  past === null ||
  past === undefined
    ? null
    : current - past;
