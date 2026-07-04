import { Store } from '@prisma/client';

export interface NormalizedApp {
  store: Store;
  storeAppId: string;
  title: string;
  subtitle?: string;
  summary?: string;
  description: string;
  iconUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
  installs?: bigint;
  price?: number;
  version?: string;
  releasedAt?: Date;
  storeUpdatedAt?: Date;
  raw: unknown;
}

export interface SearchItem {
  storeAppId: string;
  title: string;
  developer?: string;
  ratingAvg?: number;
  ratingCount?: number;
  updatedAt?: Date;
}

export interface SuggestItem {
  term: string;
  priority?: number;
}

export interface StoreProvider {
  readonly store: Store;
  getApp(storeAppId: string, country: string): Promise<NormalizedApp>;
  search(term: string, country: string, num: number): Promise<SearchItem[]>;
  suggest(term: string, country: string): Promise<SuggestItem[]>;
  similar(storeAppId: string, country: string): Promise<SearchItem[]>;
}
