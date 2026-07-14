import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import {
  RankingSeries,
  SERP_DEPTH,
  SerpMovers,
  SerpSnapshot,
} from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { RankingHistoryQueryDto } from './dto/ranking-history-query.dto';
import { SerpMoversQueryDto } from './dto/serp-movers-query.dto';
import { SerpQueryDto } from './dto/serp-query.dto';
import { detectEntrants, SerpSnapshotDay } from './serp-movers';

const RANK_DEPTH = 100;
const HISTORY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const MOVERS_LIMIT = 50;

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
        app: { store: keyword.store },
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

    const appByStoreAppId = await this.appsByStoreAppId(
      keyword.store,
      keyword.country,
      entries.map((entry) => entry.storeAppId),
    );

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

  async serpMovers(
    appId: string,
    query: SerpMoversQueryDto,
  ): Promise<SerpMovers> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true, store: true, country: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const tracked = await this.prisma.trackedKeyword.findMany({
      where: { appId, active: true },
      select: { keywordId: true, keyword: { select: { text: true } } },
    });
    const textByKeyword = new Map(
      tracked.map((row) => [row.keywordId, row.keyword.text]),
    );
    if (textByKeyword.size === 0) {
      return { windowDays: query.days, items: [] };
    }

    const from = new Date(utcToday().getTime() - query.days * DAY_MS);
    const rows = await this.prisma.serpEntry.findMany({
      where: {
        keywordId: { in: [...textByKeyword.keys()] },
        date: { gte: from },
      },
      select: {
        keywordId: true,
        date: true,
        position: true,
        storeAppId: true,
        title: true,
      },
    });

    const snapshotsByKeyword = new Map<string, Map<string, SerpSnapshotDay>>();
    for (const row of rows) {
      const dateKey = toDateKey(row.date);
      let days = snapshotsByKeyword.get(row.keywordId);
      if (!days) {
        days = new Map();
        snapshotsByKeyword.set(row.keywordId, days);
      }
      let snapshot = days.get(dateKey);
      if (!snapshot) {
        snapshot = { date: dateKey, entries: [] };
        days.set(dateKey, snapshot);
      }
      snapshot.entries.push({
        position: row.position,
        storeAppId: row.storeAppId,
        title: row.title,
      });
    }

    const movers: {
      date: string;
      keywordId: string;
      position: number;
      storeAppId: string;
      title: string;
    }[] = [];
    for (const [keywordId, days] of snapshotsByKeyword) {
      for (const entrant of detectEntrants([...days.values()])) {
        movers.push({ keywordId, ...entrant });
      }
    }

    const appByStoreAppId = await this.appsByStoreAppId(
      app.store,
      app.country,
      movers.map((mover) => mover.storeAppId),
    );

    const items = movers
      .map((mover) => {
        const known = appByStoreAppId.get(mover.storeAppId);
        return {
          date: mover.date,
          keywordId: mover.keywordId,
          text: textByKeyword.get(mover.keywordId) ?? '',
          position: mover.position,
          storeAppId: mover.storeAppId,
          title: mover.title,
          appId: known?.id ?? null,
          isCompetitor: known?.isCompetitor ?? false,
        };
      })
      .sort((a, b) =>
        a.date === b.date
          ? a.position - b.position
          : b.date.localeCompare(a.date),
      )
      .slice(0, MOVERS_LIMIT);

    return { windowDays: query.days, items };
  }

  private async appsByStoreAppId(
    store: Store,
    country: string,
    storeAppIds: string[],
  ): Promise<Map<string, { id: string; isCompetitor: boolean }>> {
    if (storeAppIds.length === 0) {
      return new Map();
    }
    const apps = await this.prisma.app.findMany({
      where: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        country,
        storeAppId: { in: storeAppIds },
      },
      select: { id: true, storeAppId: true, isCompetitor: true },
    });
    return new Map(apps.map((app) => [app.storeAppId, app]));
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
