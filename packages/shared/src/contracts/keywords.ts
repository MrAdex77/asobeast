import { KeywordSource, KeywordSuggestionStrategy } from '../index';

export interface TrackedKeywordItem {
  keywordId: string;
  text: string;
  source: KeywordSource;
  active: boolean;
  latestPosition: number | null;
  positionDelta7d: number | null;
  traffic: number | null;
  difficulty: number | null;
  opportunity: number | null;
  scoredAt: string | null;
}

export interface KeywordSuggestion {
  text: string;
  strategy: KeywordSuggestionStrategy;
  priority?: number;
  usedByCount?: number;
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
