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

  const buildConfig = (rpm = 15) =>
    ({ get: jest.fn().mockReturnValue(rpm) }) as unknown as ConfigService<
      Env,
      true
    >;

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
          { id: 'primary', isCompetitor: false },
          { id: 'competitor', isCompetitor: true },
        ]),
      },
      trackedKeyword: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PipelineService(
      queue as unknown as Queue,
      prisma as unknown as PrismaService,
      buildCategoryRanks() as unknown as CategoryRanksService,
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
          isCompetitor: false,
          competitors: [{ id: 'competitor' }],
          tracked: [{ keywordId: 'kw1' }],
        }),
      },
    };
    const service = new PipelineService(
      queue as unknown as Queue,
      prisma as unknown as PrismaService,
      buildCategoryRanks() as unknown as CategoryRanksService,
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
          competitors: [],
          tracked: [],
        }),
      },
    };
    const buckets: CategoryBucket[] = [
      {
        collection: 'free',
        genreId: 6007,
        country: 'us',
      },
      { collection: 'free', genreId: 0, country: 'us' },
    ];
    const categoryRanks = buildCategoryRanks(buckets);
    const service = new PipelineService(
      queue as unknown as Queue,
      prisma as unknown as PrismaService,
      categoryRanks as unknown as CategoryRanksService,
      buildConfig(),
    );

    const summary = await service.fanOutApp('primary');

    expect(categoryRanks.buckets).toHaveBeenCalledWith(['primary']);
    expect(summary.categories).toBe(2);
    const categoryCalls = queue.add.mock.calls.filter(
      (call: unknown[]) => call[0] === JOBS.CHECK_CATEGORY,
    ) as [string, CategoryBucket, { jobId: string }][];
    expect(categoryCalls).toHaveLength(2);
    expect(categoryCalls[0][1]).toEqual(buckets[0]);
    expect(categoryCalls[0][2].jobId).toMatch(
      /^category:free:6007:us:\d{4}-\d{2}-\d{2}$/,
    );
  });

  it('estimates a budget matching the daily fan out counts on multi-country data', async () => {
    const buildPrisma = () => ({
      app: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'primary-de', isCompetitor: false },
          { id: 'primary-us', isCompetitor: false },
          { id: 'competitor-de', isCompetitor: true },
        ]),
      },
      trackedKeyword: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ keywordId: 'kw-de' }, { keywordId: 'kw-us' }]),
      },
    });
    const buckets: CategoryBucket[] = [
      { collection: 'free', genreId: 6007, country: 'de' },
      { collection: 'free', genreId: 6007, country: 'us' },
    ];

    const fanOut = new PipelineService(
      buildQueue() as unknown as Queue,
      buildPrisma() as unknown as PrismaService,
      buildCategoryRanks(buckets) as unknown as CategoryRanksService,
      buildConfig(),
    );
    const summary = await fanOut.fanOutDaily();

    const estimator = new PipelineService(
      buildQueue() as unknown as Queue,
      buildPrisma() as unknown as PrismaService,
      buildCategoryRanks(buckets) as unknown as CategoryRanksService,
      buildConfig(15),
    );
    const budget = await estimator.estimateDailyBudget();

    expect(budget.apps).toBe(summary.apps);
    expect(budget.keywords).toBe(summary.keywords);
    expect(budget.categories).toBe(summary.categories);
    expect(budget.reviews).toBe(summary.reviews);
    expect(budget.total).toBe(
      summary.apps + summary.keywords + summary.categories + summary.reviews,
    );
    expect(budget.capacityPerDay).toBe(15 * 60 * 24);
    expect(budget.utilization).toBe(
      Math.round((budget.total / budget.capacityPerDay) * 1000) / 1000,
    );
  });
});
