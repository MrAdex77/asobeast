import { Inject, Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import * as cheerio from 'cheerio';
import {
  APP_STORE_LIB,
  AppStoreAppResult,
  AppStoreLib,
  AppStoreSearchResult,
} from './app-store.lib';
import { StoreRequestError } from './errors';
import { NormalizedApp, SearchItem, StoreProvider, SuggestItem } from './types';

const RETRY_DELAYS_MS = [2000, 5000];

@Injectable()
export class AppStoreProvider implements StoreProvider {
  readonly store = Store.APP_STORE;
  private readonly logger = new Logger(AppStoreProvider.name);

  constructor(@Inject(APP_STORE_LIB) private readonly lib: AppStoreLib) {}

  async getApp(storeAppId: string, country: string): Promise<NormalizedApp> {
    const raw = await this.withRetry('getApp', () =>
      this.lib.app({ id: Number(storeAppId), country, ratings: true }),
    );
    const subtitle =
      raw.subtitle ?? (await this.fetchSubtitle(storeAppId, country));
    return this.toNormalizedApp(raw, subtitle);
  }

  async search(
    term: string,
    country: string,
    num: number,
  ): Promise<SearchItem[]> {
    const results = await this.withRetry('search', () =>
      this.lib.search({ term, country, num }),
    );
    return results.map((item) => this.toSearchItem(item));
  }

  async suggest(term: string, country: string): Promise<SuggestItem[]> {
    const results = await this.withRetry('suggest', () =>
      this.lib.suggest({ term, country }),
    );
    return results.map(({ term, priority }) => ({ term, priority }));
  }

  async similar(storeAppId: string, country: string): Promise<SearchItem[]> {
    const results = await this.withRetry('similar', () =>
      this.lib.similar({ id: Number(storeAppId), country }),
    );
    return results.map((item) => this.toSearchItem(item));
  }

  private async fetchSubtitle(
    storeAppId: string,
    country: string,
  ): Promise<string | undefined> {
    try {
      const html = await this.withRetry('page', () =>
        this.lib.page({ id: Number(storeAppId), country }),
      );
      const text = cheerio.load(html)('p.subtitle').first().text().trim();
      return text.length > 0 ? text : undefined;
    } catch (error) {
      this.logger.warn(
        `subtitle scrape failed for ${storeAppId}: ${messageOf(error)}`,
      );
      return undefined;
    }
  }

  private toNormalizedApp(
    raw: AppStoreAppResult,
    subtitle: string | undefined,
  ): NormalizedApp {
    return {
      store: this.store,
      storeAppId: String(raw.trackId ?? raw.id),
      title: raw.title,
      subtitle,
      description: raw.description,
      iconUrl: raw.icon,
      ratingAvg: raw.score,
      ratingCount: raw.reviews ?? raw.currentVersionReviews,
      price: raw.price,
      version: raw.version,
      releasedAt: toDate(raw.released),
      storeUpdatedAt: toDate(raw.updated),
      raw,
    };
  }

  private toSearchItem(item: AppStoreSearchResult): SearchItem {
    return {
      storeAppId: String(item.trackId ?? item.id),
      title: item.title,
      developer: item.developer,
      ratingAvg: item.score,
      ratingCount: item.reviews ?? item.currentVersionReviews,
      updatedAt: toDate(item.updated),
    };
  }

  private async withRetry<T>(
    method: string,
    call: () => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await call();
      } catch (error) {
        lastError = error;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) break;
        await sleep(delay);
      }
    }
    throw new StoreRequestError(this.store, method, messageOf(lastError));
  }
}

function toDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
