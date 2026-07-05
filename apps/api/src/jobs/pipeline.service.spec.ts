import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { JOBS } from './jobs.types';
import { PipelineService } from './pipeline.service';

describe('PipelineService competitor fan out', () => {
  const buildQueue = () => ({ add: jest.fn().mockResolvedValue(undefined) });

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
    );

    await service.fanOutApp('primary');

    expect(refreshedAppIds(queue)).toEqual(['primary', 'competitor']);
  });
});
