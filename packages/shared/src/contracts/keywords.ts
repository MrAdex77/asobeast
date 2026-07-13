import { KeywordBucket, KeywordSource, KeywordSuggestionStrategy } from '../index';

export interface TrackedKeywordItem {
  keywordId: string;
  text: string;
  source: KeywordSource;
  active: boolean;
  latestPosition: number | null;
  previousPosition: number | null;
  positionDelta1d: number | null;
  positionDelta7d: number | null;
  traffic: number | null;
  difficulty: number | null;
  volume: number | null;
  relevance: number | null;
  opportunity: number | null;
  bucket: KeywordBucket | null;
  scoredAt: string | null;
  serpVolatility7d: number | null;
}

export interface KeywordSuggestion {
  text: string;
  strategy: KeywordSuggestionStrategy;
  priority?: number;
  usedByCount?: number;
  event?: string;
}

export interface KeywordFieldResult {
  tracked: TrackedKeywordItem[];
  charactersUsed: number;
  charactersLimit: number;
  duplicatesRemoved: number;
}

export interface KeywordComparisonCompetitor {
  id: string;
  name: string | null;
}

export interface KeywordComparisonRow {
  keywordId: string;
  text: string;
  traffic: number | null;
  difficulty: number | null;
  you: number | null;
  positions: Record<string, number | null>;
  gap: boolean;
}

export interface KeywordComparison {
  competitors: KeywordComparisonCompetitor[];
  rows: KeywordComparisonRow[];
}
