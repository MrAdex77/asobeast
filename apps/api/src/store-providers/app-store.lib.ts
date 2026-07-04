import * as appStore from '@perttu/app-store-scraper';

export interface AppStoreAppResult {
  id?: number | string;
  trackId?: number | string;
  title: string;
  subtitle?: string;
  description: string;
  icon?: string;
  score?: number;
  reviews?: number;
  currentVersionReviews?: number;
  price?: number;
  version?: string;
  released?: string;
  updated?: string;
}

export interface AppStoreSearchResult {
  id?: number | string;
  trackId?: number | string;
  title: string;
  developer?: string;
  score?: number;
  reviews?: number;
  currentVersionReviews?: number;
  updated?: string;
}

export interface AppStoreSuggestResult {
  term: string;
  priority?: number;
}

export interface AppStoreLib {
  app(options: {
    id: number;
    country: string;
    ratings: boolean;
  }): Promise<AppStoreAppResult>;
  search(options: {
    term: string;
    country: string;
    num: number;
  }): Promise<AppStoreSearchResult[]>;
  suggest(options: {
    term: string;
    country: string;
  }): Promise<AppStoreSuggestResult[]>;
  similar(options: {
    id: number;
    country: string;
  }): Promise<AppStoreSearchResult[]>;
}

export const APP_STORE_LIB = Symbol('APP_STORE_LIB');

export const appStoreLib: AppStoreLib = {
  app: (options) => appStore.app(options),
  search: (options) =>
    appStore.search(options) as Promise<AppStoreSearchResult[]>,
  suggest: (options) => appStore.suggest(options),
  similar: (options) => appStore.similar(options),
};
