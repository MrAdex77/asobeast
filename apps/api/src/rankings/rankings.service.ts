import { Injectable, NotFoundException } from '@nestjs/common';
import { RankingSeries } from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { RankingHistoryQueryDto } from './dto/ranking-history-query.dto';

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
            storeAppId: true,
            competitors: { select: { id: true, storeAppId: true } },
          },
        },
      },
    });

    const apps = new Map<string, string>();
    for (const { app } of tracked) {
      apps.set(app.id, app.storeAppId);
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
      await this.prisma.keywordRanking.upsert({
        where: { appId_keywordId_date: { appId, keywordId, date } },
        create: { appId, keywordId, date, position, depth: RANK_DEPTH },
        update: { position, depth: RANK_DEPTH },
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
