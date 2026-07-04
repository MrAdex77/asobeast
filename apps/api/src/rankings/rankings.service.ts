import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';

const RANK_DEPTH = 100;

function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
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
}
