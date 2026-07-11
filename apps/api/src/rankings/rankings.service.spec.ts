import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem } from '../store-providers/types';
import { RankingsService } from './rankings.service';

describe('RankingsService.checkKeyword', () => {
  const buildSearchResults = (): SearchItem[] => {
    const items: SearchItem[] = [];
    for (let i = 1; i <= 40; i += 1) {
      items.push({ storeAppId: `other-${i}`, title: `Other ${i}` });
    }
    items[6] = { storeAppId: 'primary-store', title: 'Primary' };
    items[30] = { storeAppId: 'competitor-store', title: 'Competitor A' };
    return items;
  };

  const setup = (options?: { tracked?: unknown[] }) => {
    const search = jest.fn().mockResolvedValue(buildSearchResults());
    const upsert = jest
      .fn<
        Promise<void>,
        [{ create: { appId: string; position: number | null } }]
      >()
      .mockResolvedValue(undefined);
    const deleteMany = jest
      .fn<{ op: string }, [{ where: { keywordId: string; date: Date } }]>()
      .mockReturnValue({ op: 'delete' });
    const createMany = jest
      .fn<
        { op: string },
        [
          {
            data: Array<{
              keywordId: string;
              position: number;
              storeAppId: string;
            }>;
          },
        ]
      >()
      .mockReturnValue({ op: 'create' });
    const $transaction = jest.fn().mockResolvedValue([]);
    const tracked = options?.tracked ?? [
      {
        app: {
          id: 'primary',
          storeAppId: 'primary-store',
          competitors: [
            { id: 'competitorA', storeAppId: 'competitor-store' },
            { id: 'competitorB', storeAppId: 'absent-store' },
          ],
        },
      },
    ];
    const prisma = {
      keyword: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'kw1',
          text: 'habit tracker',
          store: Store.APP_STORE,
          country: 'us',
        }),
      },
      trackedKeyword: {
        findMany: jest.fn().mockResolvedValue(tracked),
      },
      keywordRanking: { upsert },
      serpEntry: { deleteMany, createMany },
      $transaction,
    };
    const registry = { get: () => ({ search }) };
    const service = new RankingsService(
      prisma as unknown as PrismaService,
      registry as unknown as StoreProviderRegistry,
    );
    return { service, search, upsert, deleteMany, createMany, $transaction };
  };

  it('records positions for the primary and its competitors from one search', async () => {
    const { service, search, upsert } = setup();

    await service.checkKeyword('kw1');

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('habit tracker', 'us', 100);

    const positions = new Map(
      upsert.mock.calls.map(([args]) => [
        args.create.appId,
        args.create.position,
      ]),
    );
    expect(positions.get('primary')).toBe(7);
    expect(positions.get('competitorA')).toBe(31);
    expect(positions.get('competitorB')).toBeNull();
    expect(upsert).toHaveBeenCalledTimes(3);
  });

  it('persists the top ten entries with 1-based positions', async () => {
    const { service, createMany, deleteMany, $transaction } = setup();

    await service.checkKeyword('kw1');

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(deleteMany.mock.calls[0][0].where.keywordId).toBe('kw1');
    expect(deleteMany.mock.calls[0][0].where.date).toBeInstanceOf(Date);
    const entries = createMany.mock.calls[0][0].data;
    expect(entries).toHaveLength(10);
    expect(entries[0].position).toBe(1);
    expect(entries[9].position).toBe(10);
    expect(entries[6].storeAppId).toBe('primary-store');
    expect(entries.every((entry) => entry.keywordId === 'kw1')).toBe(true);
  });

  it('replaces rather than duplicates when re-run on the same day', async () => {
    const { service, deleteMany, createMany } = setup();

    await service.checkKeyword('kw1');
    await service.checkKeyword('kw1');

    expect(deleteMany).toHaveBeenCalledTimes(2);
    expect(createMany).toHaveBeenCalledTimes(2);
  });

  it('writes no entries when nothing tracks the keyword', async () => {
    const { service, search, deleteMany, createMany } = setup({ tracked: [] });

    await service.checkKeyword('kw1');

    expect(search).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });
});
