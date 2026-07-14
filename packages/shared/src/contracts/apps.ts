import { Store } from '../index';

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
  country: string;
  name: string | null;
  iconUrl: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  capturedAt: string | null;
  trackedKeywordCount: number;
  competitorCount: number;
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
