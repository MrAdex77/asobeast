import { KeywordSource, KeywordSuggestionStrategy, Store } from './index';

export interface AppSnapshotSummary {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  installs: number | null;
  price: number | null;
  version: string | null;
  capturedAt: string;
}

export interface CompetitorItem {
  id: string;
  store: Store;
  name: string | null;
  iconUrl: string | null;
  latestSnapshot: AppSnapshotSummary | null;
}

export interface AppDetail {
  id: string;
  store: Store;
  storeAppId: string;
  country: string;
  name: string | null;
  iconUrl: string | null;
  createdAt: string;
  latestSnapshot: AppSnapshotSummary | null;
  competitors: CompetitorItem[];
}

export interface AppListItem {
  id: string;
  store: Store;
  name: string | null;
  iconUrl: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  capturedAt: string | null;
  trackedKeywordCount: number;
  competitorCount: number;
}

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

export interface RankingPoint {
  date: string;
  position: number | null;
}

export interface RankingSeriesItem {
  keywordId: string;
  text: string;
  points: RankingPoint[];
}

export interface RankingSeries {
  series: RankingSeriesItem[];
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

export interface VisibilitySummary {
  current: number;
  delta7d: number | null;
  delta30d: number | null;
}

export interface RankDistribution {
  top1: number;
  top3: number;
  top10: number;
  top50: number;
  beyond: number;
  unranked: number;
}

export interface KeywordMover {
  keywordId: string;
  text: string;
  from: number | null;
  to: number | null;
}

export interface KeywordMovers {
  up: KeywordMover[];
  down: KeywordMover[];
}

export interface UncoveredKeyword {
  keywordId: string;
  text: string;
  opportunity: number;
}

export interface CoverageSummary {
  inTitle: number;
  inSubtitle: number;
  inDescription: number;
  uncoveredHighOpportunity: UncoveredKeyword[];
}

export interface AppSummary {
  visibility: VisibilitySummary;
  rankDistribution: RankDistribution;
  movers: KeywordMovers;
  coverage: CoverageSummary;
  lastRefreshAt: string | null;
  trackedKeywords: number;
  competitors: number;
}

export interface SnapshotChange {
  field: string;
  before: string | number | null;
  after: string | number | null;
}

export interface SnapshotDiffResult {
  snapshotId: string;
  changes: SnapshotChange[];
}
