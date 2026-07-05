export const clamp = (v: number, lo = 0, hi = 10): number =>
  Math.min(hi, Math.max(lo, v));

export const linear = (v: number, min: number, max: number): number =>
  clamp(((v - min) / (max - min)) * 10);

export const logScale = (v: number, min: number, max: number): number =>
  v <= 0 ? 0 : linear(Math.log10(v), Math.log10(min), Math.log10(max));

export interface KeywordStats {
  keywordText: string;
  top10: Array<{
    title: string;
    ratingCount?: number;
    ratingAvg?: number;
    daysSinceUpdate?: number;
  }>;
  top30TitleMatchCount: number;
  suggest: {
    priority?: number;
    partialPriority?: number;
  };
}

export const WEIGHTS = {
  difficulty: {
    titleMatch: 0.35,
    strength: 0.3,
    competitors: 0.2,
    freshness: 0.15,
  },
  traffic: {
    suggest: 0.5,
    strength: 0.3,
    length: 0.2,
  },
} as const;

const average = (values: number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const definedNumbers = (values: Array<number | undefined>): number[] =>
  values.filter((value): value is number => typeof value === 'number');

function titleScore(title: string, keyword: string): number {
  const haystack = title.toLowerCase();
  const phrase = keyword.toLowerCase().trim();
  if (phrase.length === 0) {
    return 0;
  }
  if (haystack.includes(phrase)) {
    return 10;
  }
  const words = phrase.split(/\s+/);
  const present = words.filter((word) => haystack.includes(word));
  if (present.length === words.length) {
    return 7;
  }
  return present.length > 0 ? 4 : 0;
}

export const titleMatchScore = (stats: KeywordStats): number =>
  average(stats.top10.map((item) => titleScore(item.title, stats.keywordText)));

export const strengthScore = (stats: KeywordStats): number =>
  logScale(
    average(definedNumbers(stats.top10.map((item) => item.ratingCount))),
    100,
    2_000_000,
  );

export const competitorsScore = (stats: KeywordStats): number =>
  clamp(stats.top30TitleMatchCount / 3);

export const freshnessScore = (stats: KeywordStats): number => {
  const days = definedNumbers(stats.top10.map((item) => item.daysSinceUpdate));
  return days.length === 0 ? 0 : clamp(10 - average(days) / 9);
};

export const suggestScore = (stats: KeywordStats): number => {
  const { priority, partialPriority } = stats.suggest;
  if (typeof priority === 'number') {
    return clamp(priority / 1000);
  }
  if (typeof partialPriority === 'number') {
    return clamp(partialPriority / 2000);
  }
  return 1;
};

export const lengthScore = (stats: KeywordStats): number => {
  const chars = stats.keywordText.length;
  if (chars <= 7) {
    return 10;
  }
  if (chars >= 25) {
    return 2;
  }
  return 10 - ((chars - 7) / (25 - 7)) * (10 - 2);
};

export const computeDifficulty = (stats: KeywordStats): number =>
  clamp(
    WEIGHTS.difficulty.titleMatch * titleMatchScore(stats) +
      WEIGHTS.difficulty.strength * strengthScore(stats) +
      WEIGHTS.difficulty.competitors * competitorsScore(stats) +
      WEIGHTS.difficulty.freshness * freshnessScore(stats),
  );

export const computeTraffic = (stats: KeywordStats): number =>
  clamp(
    WEIGHTS.traffic.suggest * suggestScore(stats) +
      WEIGHTS.traffic.strength * strengthScore(stats) +
      WEIGHTS.traffic.length * lengthScore(stats),
  );

const round2 = (v: number): number => Math.round(v * 100) / 100;

export const computeOpportunity = (
  traffic: number | null,
  difficulty: number | null,
  position: number | null,
): number | null => {
  if (traffic === null || difficulty === null) {
    return null;
  }
  const base = (traffic * (10 - difficulty)) / 10;
  if (position !== null && position >= 4 && position <= 30) {
    return round2(clamp(base * 1.25));
  }
  if (position === null && difficulty >= 8) {
    return round2(clamp(base * 0.5));
  }
  return round2(clamp(base));
};
