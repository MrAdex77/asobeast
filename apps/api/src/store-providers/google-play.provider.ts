import { Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import { StoreNotSupportedError } from './errors';
import {
  ChartItem,
  NormalizedApp,
  SearchItem,
  StoreProvider,
  SuggestItem,
} from './types';

/**
 * Google Play scraping is intentionally deferred. When implementing:
 * 1. Pick a maintained scraper (the classic google-play-scraper is ESM only and
 *    loosely maintained; expect parser breakage and wrap imports accordingly).
 * 2. Implement this class, register a 'gplay' BullMQ worker with its own
 *    SCRAPE_GPLAY_RPM limiter, and remove the 501 mapping test.
 * Nothing outside store-providers/ and jobs/ should need to change.
 */
@Injectable()
export class GooglePlayProvider implements StoreProvider {
  readonly store = Store.GOOGLE_PLAY;

  getApp(): Promise<NormalizedApp> {
    return Promise.reject(new StoreNotSupportedError(this.store));
  }

  search(): Promise<SearchItem[]> {
    return Promise.reject(new StoreNotSupportedError(this.store));
  }

  suggest(): Promise<SuggestItem[]> {
    return Promise.reject(new StoreNotSupportedError(this.store));
  }

  similar(): Promise<SearchItem[]> {
    return Promise.reject(new StoreNotSupportedError(this.store));
  }

  topCharts(): Promise<ChartItem[]> {
    return Promise.reject(new StoreNotSupportedError(this.store));
  }
}
