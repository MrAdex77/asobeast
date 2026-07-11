import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RankingSeries, SERP_DEPTH, SerpSnapshot } from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { RankingHistoryQueryDto } from './dto/ranking-history-query.dto';
import { SerpQueryDto } from './dto/serp-query.dto';

const RANK_DEPTH = 100;
const HISTORY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class RankingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly config: ConfigService<Env, true>,
    private readonly alerts: AlertsDispatcher,
  ) {}

  async checkKeyword(keywordId: string): Promise<void> {
    const keyword = await this.prisma.keyword.findUnique({
      where: { id: keywordId },
      select: { id: true, text: true, store: true, country: true },
    });
    if (!keyword) {
      return;
    }

    const tracked = await this.prisma.trackedKeyword.findMany({
      where: {
        keywordId,
        active: true,
        app: { store: keyword.store, country: keyword.country },
      },
      select: {
        app: {
          select: {
            id: true,
            name: true,
            storeAppId: true,
            competitors: { select: { id: true, storeAppId: true } },
          },
        },
      },
    });

    const apps = new Map<string, string>();
    const primaryNames = new Map<string, string | null>();
    for (const { app } of tracked) {
      apps.set(app.id, app.storeAppId);
      primaryNames.set(app.id, app.name);
      for (const competitor of app.competitors) {
        apps.set(competitor.id, competitor.storeAppId);
      }
    }
    if (apps.size === 0) {
      return;
    }

    const results = await this.registry
      .get(keyword.store)
      .search(keyword.text, keyword.country, RANK_DEPTH);

    const positionByStoreAppId = new Map<string, number>();
    results.forEach((item, index) => {
      if (!positionByStoreAppId.has(item.storeAppId)) {
        positionByStoreAppId.set(item.storeAppId, index + 1);
      }
    });

    const date = utcToday();
    for (const [appId, storeAppId] of apps) {
      const position = positionByStoreAppId.get(storeAppId) ?? null;
      const existing = await this.prisma.keywordRanking.findUnique({
        where: { appId_keywordId_date: { appId, keywordId, date } },
        select: { position: true },
      });
      await this.prisma.keywordRanking.upsert({
        where: { appId_keywordId_date: { appId, keywordId, date } },
        create: { appId, keywordId, date, position, depth: RANK_DEPTH },
        update: { position, depth: RANK_DEPTH },
      });

      const changed = existing === null || existing.position !== position;
      if (primaryNames.has(appId) && changed) {
        await this.dispatchRankAlert(
          { id: appId, name: primaryNames.get(appId) ?? null },
          { id: keyword.id, text: keyword.text },
          date,
          position,
        );
      }
    }

    const entries = results.slice(0, SERP_DEPTH).map((item, index) => ({
      keywordId,
      date,
      position: index + 1,
      storeAppId: item.storeAppId,
      title: item.title,
      developer: item.developer ?? null,
      ratingAvg: item.ratingAvg ?? null,
      ratingCount: item.ratingCount ?? null,
    }));

    await this.prisma.$transaction([
      this.prisma.serpEntry.deleteMany({ where: { keywordId, date } }),
      this.prisma.serpEntry.createMany({ data: entries }),
    ]);
  }

  private async dispatchRankAlert(
    app: { id: string; name: string | null },
    keyword: { id: string; text: string },
    date: Date,
    position: number | null,
  ): Promise<void> {
    const previous = await this.prisma.keywordRanking.findFirst({
      where: { appId: app.id, keywordId: keyword.id, date: { lt: date } },
      orderBy: { date: 'desc' },
      select: { position: true },
    });
    if (!previous) {
      return;
    }

    const threshold = this.config.get('ALERT_RANK_DROP_THRESHOLD', {
      infer: true,
    });
    const from = previous.position;
    const occurredAt = new Date().toISOString();

    if (from !== null && (position === null || position - from >= threshold)) {
      await this.alerts.dispatch({
        event: 'rank.dropped',
        occurredAt,
        app,
        keyword,
        from,
        to: position,
        threshold,
      });
      return;
    }

    if (position !== null && (from === null || from - position >= threshold)) {
      await this.alerts.dispatch({
        event: 'rank.improved',
        occurredAt,
        app,
        keyword,
        from,
        to: position,
        threshold,
      });
    }
  }

  async history(
    appId: string,
    query: RankingHistoryQueryDto,
  ): Promise<RankingSeries> {
    await this.ensureApp(appId);

    const to = query.to ? new Date(query.to) : utcToday();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - HISTORY_DAYS * DAY_MS);

    const requested = query.keywordIds
      ?.split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const tracked = await this.prisma.trackedKeyword.findMany({
      where: {
        appId,
        ...(requested ? { keywordId: { in: requested } } : { active: true }),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        keywordId: true,
        keyword: {
          select: {
            text: true,
            rankings: {
              where: { appId, date: { gte: from, lte: to } },
              orderBy: { date: 'asc' },
              select: { date: true, position: true },
            },
          },
        },
      },
    });

    return {
      series: tracked.map((row) => ({
        keywordId: row.keywordId,
        text: row.keyword.text,
        points: row.keyword.rankings.map((ranking) => ({
          date: toDateKey(ranking.date),
          position: ranking.position,
        })),
      })),
    };
  }

  async serp(keywordId: string, query: SerpQueryDto): Promise<SerpSnapshot> {
    const keyword = await this.prisma.keyword.findUnique({
      where: { id: keywordId },
      select: { id: true, text: true, store: true, country: true },
    });
    if (!keyword) {
      throw new NotFoundException(`Keyword ${keywordId} not found`);
    }

    const date = query.date
      ? new Date(`${query.date}T00:00:00.000Z`)
      : ((
          await this.prisma.serpEntry.findFirst({
            where: { keywordId },
            orderBy: { date: 'desc' },
            select: { date: true },
          })
        )?.date ?? null);

    if (!date) {
      return { keywordId, text: keyword.text, date: null, entries: [] };
    }

    const entries = await this.prisma.serpEntry.findMany({
      where: { keywordId, date },
      orderBy: { position: 'asc' },
      select: {
        position: true,
        storeAppId: true,
        title: true,
        developer: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    const apps = await this.prisma.app.findMany({
      where: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: keyword.store,
        country: keyword.country,
        storeAppId: { in: entries.map((entry) => entry.storeAppId) },
      },
      select: { id: true, storeAppId: true, isCompetitor: true },
    });
    const appByStoreAppId = new Map(apps.map((app) => [app.storeAppId, app]));

    return {
      keywordId,
      text: keyword.text,
      date: toDateKey(date),
      entries: entries.map((entry) => {
        const app = appByStoreAppId.get(entry.storeAppId);
        return {
          position: entry.position,
          storeAppId: entry.storeAppId,
          title: entry.title,
          developer: entry.developer,
          ratingAvg: entry.ratingAvg,
          ratingCount: entry.ratingCount,
          appId: app?.id ?? null,
          isCompetitor: app?.isCompetitor ?? false,
        };
      }),
    };
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
