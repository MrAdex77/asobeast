import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem, SuggestItem } from '../store-providers/types';
import { StatsCollectorService } from './stats-collector.service';

const daysAgo = (days: number): Date =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

function buildSearch(): SearchItem[] {
  return Array.from({ length: 40 }, (_, index) => ({
    storeAppId: `app${index}`,
    title: index < 12 ? `Puzzle Game ${index}` : `Other App ${index}`,
    ratingCount: 1000 + index,
    ratingAvg: 4.5,
    updatedAt: daysAgo(10),
  }));
}

function buildProvider(suggest: SuggestItem[]) {
  const search = jest.fn().mockResolvedValue(buildSearch());
  const suggestFn = jest.fn().mockResolvedValue(suggest);
  const registry = {
    get: jest.fn().mockReturnValue({ search, suggest: suggestFn }),
  } as unknown as StoreProviderRegistry;
  return { registry, search, suggestFn };
}

function buildPrisma() {
  return {
    keyword: {
      findUnique: jest.fn().mockResolvedValue({
        text: 'puzzle game',
        store: Store.APP_STORE,
        country: 'us',
      }),
    },
  } as unknown as PrismaService;
}

describe('StatsCollectorService', () => {
  it('assembles stats from two provider requests', async () => {
    const { registry, search, suggestFn } = buildProvider([
      { term: 'puzzle game', priority: 7000 },
      { term: 'puzzle game free', priority: 9000 },
    ]);
    const service = new StatsCollectorService(buildPrisma(), registry);

    const stats = await service.collect('kw1');

    expect(search).toHaveBeenCalledWith('puzzle game', 'us', 100);
    expect(suggestFn).toHaveBeenCalledWith('puzzle game', 'us');
    expect(search).toHaveBeenCalledTimes(1);
    expect(suggestFn).toHaveBeenCalledTimes(1);

    expect(stats.keywordText).toBe('puzzle game');
    expect(stats.top10).toHaveLength(10);
    expect(stats.top10[0].ratingCount).toBe(1000);
    expect(stats.top10[0].daysSinceUpdate).toBe(10);
    expect(stats.top30TitleMatchCount).toBe(12);
    expect(stats.suggest).toEqual({ priority: 7000 });
  });

  it('returns null when the keyword no longer exists', async () => {
    const { registry, search, suggestFn } = buildProvider([]);
    const prisma = {
      keyword: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new StatsCollectorService(prisma, registry);

    expect(await service.collect('gone')).toBeNull();
    expect(search).not.toHaveBeenCalled();
    expect(suggestFn).not.toHaveBeenCalled();
  });

  it('falls back to best partial priority when the term is absent', async () => {
    const { registry } = buildProvider([
      { term: 'puzzle game free', priority: 4000 },
      { term: 'puzzle game offline', priority: 6000 },
    ]);
    const service = new StatsCollectorService(buildPrisma(), registry);

    const stats = await service.collect('kw1');

    expect(stats.suggest).toEqual({ partialPriority: 6000 });
  });
});
