import {
  competitorsScore,
  computeDifficulty,
  computeOpportunity,
  computeTraffic,
  freshnessScore,
  KeywordStats,
  lengthScore,
  strengthScore,
  suggestScore,
  titleMatchScore,
} from './formulas';

const genericKeyword: KeywordStats = {
  keywordText: 'games',
  top10: Array.from({ length: 10 }, (_, index) => ({
    title: `Best Games ${index}`,
    ratingCount: 1_000_000,
    ratingAvg: 4.8,
    daysSinceUpdate: 9,
  })),
  top30TitleMatchCount: 30,
  suggest: { priority: 9000 },
};

const longTailKeyword: KeywordStats = {
  keywordText: 'offline pixel dungeon crawler',
  top10: Array.from({ length: 10 }, (_, index) => ({
    title: `Random App ${index}`,
    ratingCount: 50,
    ratingAvg: 3.2,
  })),
  top30TitleMatchCount: 0,
  suggest: {},
};

const midKeyword: KeywordStats = {
  keywordText: 'puzzle game',
  top10: [
    'Puzzle Game Deluxe',
    'Ultimate Puzzle Game',
    'Game of Puzzle',
    'A Game and a Puzzle',
    'Puzzle Land Game',
    'Puzzle Quest',
    'Daily Puzzle',
    'Puzzle Mania',
    'Random App',
    'Another Thing',
  ].map((title) => ({
    title,
    ratingCount: 10_000,
    ratingAvg: 4.4,
    daysSinceUpdate: 45,
  })),
  top30TitleMatchCount: 12,
  suggest: { priority: 4000 },
};

describe('scoring formulas', () => {
  it('scores a huge generic keyword high on traffic and difficulty', () => {
    expect(titleMatchScore(genericKeyword)).toBeCloseTo(10, 2);
    expect(strengthScore(genericKeyword)).toBeCloseTo(9.3, 2);
    expect(competitorsScore(genericKeyword)).toBeCloseTo(10, 2);
    expect(freshnessScore(genericKeyword)).toBeCloseTo(9, 2);
    expect(suggestScore(genericKeyword)).toBeCloseTo(9, 2);
    expect(lengthScore(genericKeyword)).toBeCloseTo(10, 2);
    expect(computeDifficulty(genericKeyword)).toBeCloseTo(9.64, 2);
    expect(computeTraffic(genericKeyword)).toBeCloseTo(9.29, 2);
  });

  it('scores a niche long tail phrase low on traffic and difficulty', () => {
    expect(titleMatchScore(longTailKeyword)).toBeCloseTo(0, 2);
    expect(strengthScore(longTailKeyword)).toBeCloseTo(0, 2);
    expect(competitorsScore(longTailKeyword)).toBeCloseTo(0, 2);
    expect(freshnessScore(longTailKeyword)).toBeCloseTo(0, 2);
    expect(suggestScore(longTailKeyword)).toBeCloseTo(1, 2);
    expect(lengthScore(longTailKeyword)).toBeCloseTo(2, 2);
    expect(computeDifficulty(longTailKeyword)).toBeCloseTo(0, 2);
    expect(computeTraffic(longTailKeyword)).toBeCloseTo(0.9, 2);
  });

  it('scores an achievable mid keyword in the middle', () => {
    expect(titleMatchScore(midKeyword)).toBeCloseTo(5.3, 2);
    expect(strengthScore(midKeyword)).toBeCloseTo(4.65, 2);
    expect(competitorsScore(midKeyword)).toBeCloseTo(4, 2);
    expect(freshnessScore(midKeyword)).toBeCloseTo(5, 2);
    expect(suggestScore(midKeyword)).toBeCloseTo(4, 2);
    expect(lengthScore(midKeyword)).toBeCloseTo(8.22, 2);
    expect(computeDifficulty(midKeyword)).toBeCloseTo(4.8, 2);
    expect(computeTraffic(midKeyword)).toBeCloseTo(5.04, 2);
  });

  describe('computeOpportunity', () => {
    it('is null when traffic or difficulty is missing', () => {
      expect(computeOpportunity(null, 5, 10)).toBeNull();
      expect(computeOpportunity(5, null, 10)).toBeNull();
    });

    it('returns the base value outside boost and cut zones', () => {
      expect(computeOpportunity(8, 4, 1)).toBeCloseTo(4.8, 2);
      expect(computeOpportunity(8, 4, null)).toBeCloseTo(4.8, 2);
    });

    it('boosts winnable positions between 4 and 30', () => {
      expect(computeOpportunity(8, 4, 10)).toBeCloseTo(6, 2);
    });

    it('cuts unranked keywords with high difficulty', () => {
      expect(computeOpportunity(8, 8, null)).toBeCloseTo(0.8, 2);
    });

    it('clamps to a maximum of 10', () => {
      expect(computeOpportunity(10, 0, 10)).toBeCloseTo(10, 2);
    });
  });

  it('falls back to partial suggest priority when no exact match', () => {
    const stats: KeywordStats = {
      keywordText: 'race',
      top10: [],
      top30TitleMatchCount: 0,
      suggest: { partialPriority: 6000 },
    };
    expect(suggestScore(stats)).toBeCloseTo(3, 2);
  });
});
