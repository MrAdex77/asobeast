import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  CategoryBucket,
  CategoryRanksService,
} from '../category-ranks/category-ranks.service';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { JOBS } from './jobs.types';
import { PipelineService } from './pipeline.service';

describe('PipelineService competitor fan out', () => {
  const buildQueue = () => ({ add: jest.fn().mockResolvedValue(undefined) });

  const buildCategoryRanks = (buckets: CategoryBucket[] = []) => ({
    buckets: jest.fn().mockResolvedValue(buckets),
  });

  const buildConfig = (itunesRpm = 15, gplayRpm = 10) =>
    ({
      get: jest.fn((key: string) =>
        key === 'SCRAPE_GPLAY_RPM' ? gplayRpm : itunesRpm,
      ),
    }) as unknown as ConfigService<Env, true>;

  const buildService = (
    queue: ReturnType<typeof buildQueue>,
    prisma: unknown,
    categoryRanks: unknown,
    config: ConfigService<Env, true>,
    gplayQueue: ReturnType<typeof buildQueue> = buildQueue(),
  ) =>
    new PipelineService(
      queue as unknown as Queue,
      gplayQueue as unknown as Queue,
      prisma as PrismaService,
      categoryRanks as CategoryRanksService,
      config,
    );

  const refreshedAppIds = (queue: { add: jest.Mock }): string[] =>
    queue.add.mock.calls
      .filter(([job]) => job === JOBS.REFRESH_APP)
      .map(([, payload]) => (payload as { appId: string }).appId);

  const reviewedAppIds = (queue: { add: jest.Mock }): string[] =>
    queue.add.mock.calls
      .filter(([job]) => job === JOBS.SYNC_REVIEWS)
      .map(([, payload]) => (payload as { appId: string }).appId);

  it('enqueues a refresh for competitors but reviews only for primaries during the daily fan out', async () => {
    const queue = buildQueue();
    const prisma = {
      app: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'primary', isCompetitor: false, store: 'APP_STORE' },
          { id: 'competitor', isCompetitor: true, store: 'APP_STORE' },
        ]),
      },
      trackedKeyword: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = buildService(
      queue,
      prisma,
      buildCategoryRanks(),
      buildConfig(),
    );

    const summary = await service.fanOutDaily();

    expect(refreshedAppIds(queue)).toEqual(['primary', 'competitor']);
    expect(reviewedAppIds(queue)).toEqual(['primary']);
    expect(summary.reviews).toBe(1);
  });

  it('enqueues a refresh for competitors but reviews only the primary during a single app fan out', async () => {
    const queue = buildQueue();
    const prisma = {
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'primary',
          store: 'APP_STORE',
          isCompetitor: false,
          competitors: [{ id: 'competitor', store: 'APP_STORE' }],
          tracked: [{ keywordId: 'kw1', keyword: { store: 'APP_STORE' } }],
        }),
      },
    };
    const service = buildService(
      queue,
      prisma,
      buildCategoryRanks(),
      buildConfig(),
    );

    await service.fanOutApp('primary');

    expect(refreshedAppIds(queue)).toEqual(['primary', 'competitor']);
    expect(reviewedAppIds(queue)).toEqual(['primary']);
  });

  it('enqueues one category job per bucket with a stable job id', async () => {
    const queue = buildQueue();
    const prisma = {
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'primary',
          store: 'APP_STORE',
          competitors: [],
          tracked: [],
        }),
      },
    };
    const buckets: CategoryBucket[] = [
      {
        collection: 'free',
        genre: '6007',
        country: 'us',
        store: 'APP_STORE',
      },
      {
        collection: 'free',
        genre: 'overall',
        country: 'us',
        store: 'APP_STORE',
      },
    ];
    const categoryRanks = buildCategoryRanks(buckets);
    const service = buildService(queue, prisma, categoryRanks, buildConfig());

    const summary = await service.fanOutApp('primary');

    expect(categoryRanks.buckets).toHaveBeenCalledWith(['primary']);
    expect(summary.categories).toBe(2);
    const categoryCalls = queue.add.mock.calls.filter(
      (call: unknown[]) => call[0] === JOBS.CHECK_CATEGORY,
    ) as [string, CategoryBucket, { jobId: string }][];
    expect(categoryCalls).toHaveLength(2);
    expect(categoryCalls[0][1]).toEqual(buckets[0]);
    expect(categoryCalls[0][2].jobId).toMatch(
      /^category~free~6007~us~\d{4}-\d{2}-\d{2}$/,
    );
  });

  it('estimates a budget matching the daily fan out counts on multi-country data', async () => {
    const buildPrisma = () => ({
      app: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'primary-de', isCompetitor: false, store: 'APP_STORE' },
          { id: 'primary-us', isCompetitor: false, store: 'APP_STORE' },
          { id: 'competitor-de', isCompetitor: true, store: 'APP_STORE' },
        ]),
      },
      trackedKeyword: {
        findMany: jest.fn().mockResolvedValue([
          { keywordId: 'kw-de', keyword: { store: 'APP_STORE' } },
          { keywordId: 'kw-us', keyword: { store: 'APP_STORE' } },
        ]),
      },
    });
    const buckets: CategoryBucket[] = [
      { collection: 'free', genre: '6007', country: 'de', store: 'APP_STORE' },
      { collection: 'free', genre: '6007', country: 'us', store: 'APP_STORE' },
    ];

    const fanOut = buildService(
      buildQueue(),
      buildPrisma(),
      buildCategoryRanks(buckets),
      buildConfig(),
    );
    const summary = await fanOut.fanOutDaily();

    const estimator = buildService(
      buildQueue(),
      buildPrisma(),
      buildCategoryRanks(buckets),
      buildConfig(15, 10),
    );
    const budget = await estimator.estimateDailyBudget();

    expect(budget.apps).toBe(summary.apps);
    expect(budget.keywords).toBe(summary.keywords);
    expect(budget.categories).toBe(summary.categories);
    expect(budget.reviews).toBe(summary.reviews);
    expect(budget.total).toBe(
      summary.apps + summary.keywords + summary.categories + summary.reviews,
    );
    expect(budget.capacityPerDay).toBe((15 + 10) * 60 * 24);

    const appStore = budget.stores.find((row) => row.store === 'APP_STORE');
    const gplay = budget.stores.find((row) => row.store === 'GOOGLE_PLAY');
    expect(appStore).toMatchObject({
      apps: summary.apps,
      keywords: summary.keywords,
      categories: summary.categories,
      reviews: summary.reviews,
      total: budget.total,
      capacityPerDay: 15 * 60 * 24,
    });
    expect(gplay).toMatchObject({ total: 0, capacityPerDay: 10 * 60 * 24 });
    expect(budget.utilization).toBe(appStore?.utilization);
    expect(budget.utilization).toBe(
      Math.round((budget.total / (15 * 60 * 24)) * 1000) / 1000,
    );
  });
});
