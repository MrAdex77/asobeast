import { Injectable } from '@nestjs/common';
import { CategoryCollection, OVERALL_GENRE_ID } from '@asobeast/shared';
import { Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { PrismaService } from '../prisma/prisma.service';
import { isPaid, primaryGenreId } from '../store-providers/raw-facts';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { CheckCategoryPayload } from '../jobs/jobs.types';

const CHART_DEPTH = 200;

export interface CategoryBucket {
  collection: CategoryCollection;
  genreId: number;
  country: string;
}

interface AppBucketRow {
  id: string;
  storeAppId: string;
  country: string;
  collection: CategoryCollection;
  genreId: number;
}

function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

@Injectable()
export class CategoryRanksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
  ) {}

  async buckets(appIds: string[]): Promise<CategoryBucket[]> {
    const rows = await this.loadAppBuckets({ id: { in: appIds } });
    const seen = new Set<string>();
    const buckets: CategoryBucket[] = [];
    for (const row of rows) {
      for (const genreId of [row.genreId, OVERALL_GENRE_ID]) {
        const key = `${row.collection}:${genreId}:${row.country}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        buckets.push({
          collection: row.collection,
          genreId,
          country: row.country,
        });
      }
    }
    return buckets;
  }

  async checkCategory(payload: CheckCategoryPayload): Promise<void> {
    const { collection, genreId, country } = payload;
    const items = await this.registry
      .get(Store.APP_STORE)
      .topCharts(collection, genreId, CHART_DEPTH, country);

    const positionByStoreAppId = new Map<string, number>();
    items.forEach((item, index) => {
      if (!positionByStoreAppId.has(item.storeAppId)) {
        positionByStoreAppId.set(item.storeAppId, index + 1);
      }
    });

    const rows = await this.loadAppBuckets({
      workspaceId: DEFAULT_WORKSPACE_ID,
      store: Store.APP_STORE,
      country,
    });
    const date = utcToday();
    for (const row of rows) {
      const matches =
        row.collection === collection &&
        (genreId === OVERALL_GENRE_ID || row.genreId === genreId);
      if (!matches) {
        continue;
      }
      const position = positionByStoreAppId.get(row.storeAppId) ?? null;
      await this.prisma.categoryRank.upsert({
        where: {
          appId_date_collection_genreId: {
            appId: row.id,
            date,
            collection,
            genreId,
          },
        },
        create: {
          appId: row.id,
          date,
          collection,
          genreId,
          position,
          depth: CHART_DEPTH,
        },
        update: { position, depth: CHART_DEPTH },
      });
    }
  }

  private async loadAppBuckets(
    where: Record<string, unknown>,
  ): Promise<AppBucketRow[]> {
    const apps = await this.prisma.app.findMany({
      where,
      select: {
        id: true,
        storeAppId: true,
        country: true,
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
          select: { raw: true },
        },
      },
    });

    const rows: AppBucketRow[] = [];
    for (const app of apps) {
      const snapshot = app.snapshots[0];
      if (!snapshot) {
        continue;
      }
      const genreId = primaryGenreId(snapshot.raw);
      if (genreId === null) {
        continue;
      }
      rows.push({
        id: app.id,
        storeAppId: app.storeAppId,
        country: app.country,
        collection: isPaid(snapshot.raw) ? 'paid' : 'free',
        genreId,
      });
    }
    return rows;
  }
}
