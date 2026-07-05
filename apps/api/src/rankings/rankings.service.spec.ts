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

  const setup = () => {
    const search = jest.fn().mockResolvedValue(buildSearchResults());
    const upsert = jest
      .fn<
        Promise<void>,
        [{ create: { appId: string; position: number | null } }]
      >()
      .mockResolvedValue(undefined);
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
        findMany: jest.fn().mockResolvedValue([
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
        ]),
      },
      keywordRanking: { upsert },
    };
    const registry = { get: () => ({ search }) };
    const service = new RankingsService(
      prisma as unknown as PrismaService,
      registry as unknown as StoreProviderRegistry,
    );
    return { service, search, upsert };
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
});
