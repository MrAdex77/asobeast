import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { CategoryRanksService } from './category-ranks.service';

interface AppRow {
  id: string;
  storeAppId: string;
  country: string;
  snapshots: { raw: unknown }[];
}

const app = (
  id: string,
  storeAppId: string,
  raw: unknown,
  country = 'us',
): AppRow => ({ id, storeAppId, country, snapshots: [{ raw }] });

const makeService = (
  apps: AppRow[],
  chart: { storeAppId: string; title: string }[] = [],
) => {
  const upsert = jest.fn().mockResolvedValue(undefined);
  const prisma = {
    app: { findMany: jest.fn().mockResolvedValue(apps) },
    categoryRank: { upsert },
  };
  const topCharts = jest.fn().mockResolvedValue(chart);
  const registry = { get: jest.fn().mockReturnValue({ topCharts }) };
  const service = new CategoryRanksService(
    prisma as unknown as PrismaService,
    registry as unknown as StoreProviderRegistry,
  );
  return { service, upsert, topCharts, registry, prisma };
};

describe('CategoryRanksService buckets', () => {
  it('dedupes buckets across apps sharing a genre', async () => {
    const { service } = makeService([
      app('a1', '111', { primaryGenreId: 6007, price: 0 }),
      app('a2', '222', { primaryGenreId: 6007, price: 0 }),
    ]);

    const buckets = await service.buckets(['a1', 'a2']);

    expect(buckets).toEqual([
      { collection: 'free', genreId: 6007, country: 'us' },
      { collection: 'free', genreId: 0, country: 'us' },
    ]);
  });

  it('splits free and paid apps into separate collections', async () => {
    const { service } = makeService([
      app('a1', '111', { primaryGenreId: 6007, price: 0 }),
      app('a2', '222', { primaryGenreId: 6014, price: 2.99 }),
    ]);

    const buckets = await service.buckets(['a1', 'a2']);

    expect(buckets).toEqual([
      { collection: 'free', genreId: 6007, country: 'us' },
      { collection: 'free', genreId: 0, country: 'us' },
      { collection: 'paid', genreId: 6014, country: 'us' },
      { collection: 'paid', genreId: 0, country: 'us' },
    ]);
  });

  it('skips apps without a snapshot or genre', async () => {
    const { service } = makeService([
      { id: 'a1', storeAppId: '111', country: 'us', snapshots: [] },
      app('a2', '222', { price: 0 }),
    ]);

    expect(await service.buckets(['a1', 'a2'])).toEqual([]);
  });
});

describe('CategoryRanksService checkCategory', () => {
  it('upserts the chart position for matching apps and null for absent ones', async () => {
    const { service, upsert, registry } = makeService(
      [
        app('a1', '111', { primaryGenreId: 6007, price: 0 }),
        app('a2', '999', { primaryGenreId: 6007, price: 0 }),
        app('a3', '333', { primaryGenreId: 6014, price: 0 }),
      ],
      [{ storeAppId: '111', title: 'First' }],
    );

    await service.checkCategory({
      collection: 'free',
      genreId: 6007,
      country: 'us',
    });

    expect(registry.get).toHaveBeenCalledWith(Store.APP_STORE);
    expect(upsert).toHaveBeenCalledTimes(2);
    const positions = upsert.mock.calls.map(
      ([arg]) =>
        (arg as { create: { appId: string; position: number | null } }).create,
    );
    expect(positions).toEqual([
      expect.objectContaining({ appId: 'a1', position: 1 }),
      expect.objectContaining({ appId: 'a2', position: null }),
    ]);
  });

  it('matches every collection member for the overall genre bucket', async () => {
    const { service, upsert } = makeService(
      [
        app('a1', '111', { primaryGenreId: 6007, price: 0 }),
        app('a2', '222', { primaryGenreId: 6014, price: 0 }),
        app('a3', '333', { primaryGenreId: 6014, price: 5 }),
      ],
      [{ storeAppId: '222', title: 'Second' }],
    );

    await service.checkCategory({
      collection: 'free',
      genreId: 0,
      country: 'us',
    });

    const appIds = upsert.mock.calls.map(
      ([arg]) => (arg as { create: { appId: string } }).create.appId,
    );
    expect(appIds).toEqual(['a1', 'a2']);
  });

  it('reruns idempotently via the same composite key', async () => {
    const { service, upsert } = makeService(
      [app('a1', '111', { primaryGenreId: 6007, price: 0 })],
      [{ storeAppId: '111', title: 'First' }],
    );

    await service.checkCategory({
      collection: 'free',
      genreId: 6007,
      country: 'us',
    });
    await service.checkCategory({
      collection: 'free',
      genreId: 6007,
      country: 'us',
    });

    for (const [arg] of upsert.mock.calls) {
      const where = (
        arg as {
          where: { appId_date_collection_genreId: Record<string, unknown> };
        }
      ).where.appId_date_collection_genreId;
      expect(where).toMatchObject({
        appId: 'a1',
        collection: 'free',
        genreId: 6007,
      });
    }
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});
