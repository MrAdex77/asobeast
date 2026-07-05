import { PrismaService } from '../prisma/prisma.service';
import { KeywordStats } from './formulas';
import { ScoringService } from './scoring.service';
import { StatsCollectorService } from './stats-collector.service';

const stats: KeywordStats = {
  keywordText: 'games',
  top10: Array.from({ length: 10 }, () => ({
    title: 'Best Games',
    ratingCount: 1_000_000,
    daysSinceUpdate: 9,
  })),
  top30TitleMatchCount: 30,
  suggest: { priority: 9000 },
};

interface UpsertArgs {
  where: { keywordId_date: { keywordId: string; date: Date } };
  create: {
    keywordId: string;
    traffic: number;
    difficulty: number;
    stats: unknown;
  };
}

describe('ScoringService', () => {
  it('upserts a metric with computed scores for today', async () => {
    const upsert = jest.fn<Promise<void>, [UpsertArgs]>();
    const collect = jest.fn<Promise<KeywordStats>, [string]>();
    collect.mockResolvedValue(stats);
    const prisma = {
      keywordMetric: { upsert },
    } as unknown as PrismaService;
    const collector = { collect } as unknown as StatsCollectorService;
    const service = new ScoringService(prisma, collector);

    await service.scoreKeyword('kw1');

    expect(collect).toHaveBeenCalledWith('kw1');
    const [args] = upsert.mock.calls[0];
    expect(args.create.keywordId).toBe('kw1');
    expect(args.create.traffic).toBeCloseTo(9.29, 2);
    expect(args.create.difficulty).toBeCloseTo(9.64, 2);
    expect(args.create.stats).toBe(stats);

    const today = new Date().toISOString().slice(0, 10);
    expect(args.where.keywordId_date.date.toISOString().slice(0, 10)).toBe(
      today,
    );
  });
});
