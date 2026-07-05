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

describe('KeywordsService.compare', () => {
  const buildService = (prisma: unknown) =>
    new KeywordsService(
      prisma as PrismaService,
      undefined as unknown as StoreProviderRegistry,
      { add: jest.fn() } as unknown as Queue,
    );

  const buildPrisma = () => ({
    app: {
      findFirst: jest.fn().mockResolvedValue({ id: 'app1' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'rival', name: 'Rival' }]),
    },
    trackedKeyword: {
      findMany: jest.fn().mockResolvedValue([
        {
          keywordId: 'kwGap',
          keyword: {
            text: 'habit tracker',
            metrics: [{ traffic: 5, difficulty: 3 }],
          },
        },
        {
          keywordId: 'kwLead',
          keyword: {
            text: 'daily planner',
            metrics: [{ traffic: 8, difficulty: 4 }],
          },
        },
      ]),
    },
    keywordRanking: {
      findMany: jest.fn().mockResolvedValue([
        { appId: 'app1', keywordId: 'kwGap', position: null },
        { appId: 'rival', keywordId: 'kwGap', position: 3 },
        { appId: 'app1', keywordId: 'kwLead', position: 2 },
        { appId: 'rival', keywordId: 'kwLead', position: 40 },
      ]),
    },
  });

  it('flags a gap when a competitor leads the top 10 and lists competitors', async () => {
    const service = buildService(buildPrisma());

    const result = await service.compare('app1', false);

    expect(result.competitors).toEqual([{ id: 'rival', name: 'Rival' }]);
    const gapRow = result.rows.find((row) => row.keywordId === 'kwGap');
    const leadRow = result.rows.find((row) => row.keywordId === 'kwLead');
    expect(gapRow?.gap).toBe(true);
    expect(gapRow?.you).toBeNull();
    expect(gapRow?.positions.rival).toBe(3);
    expect(leadRow?.gap).toBe(false);
    expect(result.rows[0].keywordId).toBe('kwGap');
  });

  it('filters to gaps only when requested', async () => {
    const service = buildService(buildPrisma());

    const result = await service.compare('app1', true);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].keywordId).toBe('kwGap');
  });
});

describe('KeywordsService.suggest competitors', () => {
  const buildService = (prisma: unknown) =>
    new KeywordsService(
      prisma as PrismaService,
      undefined as unknown as StoreProviderRegistry,
      { add: jest.fn() } as unknown as Queue,
    );

  it('counts overlapping competitor terms and drops tracked ones', async () => {
    const prisma = {
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'app1',
          store: Store.APP_STORE,
          country: 'us',
          storeAppId: 'store1',
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            snapshots: [{ title: 'Habit Tracker', subtitle: 'Daily goals' }],
          },
          {
            snapshots: [{ title: 'Habit Planner', subtitle: 'Daily streak' }],
          },
        ]),
      },
      trackedKeyword: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ keyword: { text: 'streak' } }]),
      },
    };
    const service = buildService(prisma);

    const suggestions = await service.suggest('app1', 'competitors', 30);

    const byText = new Map(suggestions.map((s) => [s.text, s.usedByCount]));
    expect(byText.get('habit')).toBe(2);
    expect(byText.get('daily')).toBe(2);
    expect(byText.has('streak')).toBe(false);
    expect(suggestions.every((s) => s.strategy === 'competitors')).toBe(true);
    expect(suggestions[0].usedByCount).toBeGreaterThanOrEqual(
      suggestions[suggestions.length - 1].usedByCount ?? 0,
    );
  });
});
