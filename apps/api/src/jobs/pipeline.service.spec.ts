import { Queue } from 'bullmq';
import {
  CategoryBucket,
  CategoryRanksService,
} from '../category-ranks/category-ranks.service';
import { PrismaService } from '../prisma/prisma.service';
import { JOBS } from './jobs.types';
import { PipelineService } from './pipeline.service';

describe('PipelineService competitor fan out', () => {
  const buildQueue = () => ({ add: jest.fn().mockResolvedValue(undefined) });

  const buildCategoryRanks = (buckets: CategoryBucket[] = []) => ({
    buckets: jest.fn().mockResolvedValue(buckets),
  });

  const refreshedAppIds = (queue: { add: jest.Mock }): string[] =>
    queue.add.mock.calls
      .filter(([job]) => job === JOBS.REFRESH_APP)
      .map(([, payload]) => (payload as { appId: string }).appId);

  it('enqueues a refresh for competitors during the daily fan out', async () => {
    const queue = buildQueue();
    const prisma = {
      app: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'primary' }, { id: 'competitor' }]),
      },
      trackedKeyword: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PipelineService(
      queue as unknown as Queue,
      prisma as unknown as PrismaService,
      buildCategoryRanks() as unknown as CategoryRanksService,
    );

    await service.fanOutDaily();

    expect(refreshedAppIds(queue)).toEqual(['primary', 'competitor']);
  });

  it('enqueues a refresh for competitors during a single app fan out', async () => {
    const queue = buildQueue();
    const prisma = {
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'primary',
          competitors: [{ id: 'competitor' }],
          tracked: [{ keywordId: 'kw1' }],
        }),
      },
    };
    const service = new PipelineService(
      queue as unknown as Queue,
      prisma as unknown as PrismaService,
      buildCategoryRanks() as unknown as CategoryRanksService,
    );

    await service.fanOutApp('primary');

    expect(refreshedAppIds(queue)).toEqual(['primary', 'competitor']);
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
});
