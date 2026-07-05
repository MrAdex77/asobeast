import { Queue } from 'bullmq';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { KeywordsService } from './keywords.service';

describe('KeywordsService.syncFromSnapshot', () => {
  const buildQueue = () => ({ add: jest.fn() });

  const buildService = (prisma: unknown, queue: { add: jest.Mock }) =>
    new KeywordsService(
      prisma as PrismaService,
      undefined as unknown as StoreProviderRegistry,
      queue as unknown as Queue,
    );

  const buildPrisma = () => {
    let keywordId = 0;
    return {
      keywordMetric: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      app: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'app1',
          store: Store.APP_STORE,
          country: 'us',
        }),
      },
      appSnapshot: {
        findFirst: jest.fn().mockResolvedValue({
          title: 'Zombie Castle Defense',
          subtitle: 'Tower strategy game',
          summary: 'markdown editor notes',
        }),
      },
      keyword: {
        upsert: jest.fn().mockImplementation(() => {
          keywordId += 1;
          return Promise.resolve({ id: `kw${keywordId}` });
        }),
      },
      trackedKeyword: {
        upsert: jest.fn<
          Promise<void>,
          [{ create: { source: string; active: boolean }; update: object }]
        >(),
      },
    };
  };

  it('tracks only title and subtitle candidates with create-only upserts', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    const trackedSources = prisma.trackedKeyword.upsert.mock.calls.map(
      ([args]) => args.create.source,
    );
    expect(trackedSources).toContain('TITLE');
    expect(trackedSources).toContain('SUBTITLE');
    expect(trackedSources).not.toContain('DESCRIPTION');

    for (const [args] of prisma.trackedKeyword.upsert.mock.calls) {
      expect(args.create.active).toBe(true);
      expect(args.update).toEqual({});
    }
  });

  it('caps auto tracked keywords at 15', async () => {
    const prisma = buildPrisma();
    prisma.appSnapshot.findFirst.mockResolvedValue({
      title: 'alpha bravo charlie delta echo foxtrot golf hotel india juliet',
      subtitle: 'kilo lima mike november oscar papa quebec romeo sierra tango',
      summary: null,
    });
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    expect(prisma.trackedKeyword.upsert).toHaveBeenCalledTimes(15);
  });

  it('does nothing when the app has no snapshot', async () => {
    const prisma = buildPrisma();
    prisma.appSnapshot.findFirst.mockResolvedValue(null);
    const service = buildService(prisma, buildQueue());

    await service.syncFromSnapshot('app1');

    expect(prisma.trackedKeyword.upsert).not.toHaveBeenCalled();
  });
});
