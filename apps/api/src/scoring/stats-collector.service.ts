import { normalizeText } from '@asobeast/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import {
  SearchItem,
  StoreProvider,
  SuggestItem,
} from '../store-providers/types';
import { KeywordStats } from './formulas';

const SEARCH_DEPTH = 100;
const TOP_STRENGTH = 10;
const TITLE_MATCH_DEPTH = 30;
const PREFIX_PROBE_CAP = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StatsCollectorService {
  private readonly logger = new Logger(StatsCollectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
  ) {}

  async collect(keywordId: string): Promise<KeywordStats | null> {
    const keyword = await this.prisma.keyword.findUnique({
      where: { id: keywordId },
      select: { text: true, store: true, country: true },
    });
    if (!keyword) {
      return null;
    }

    const provider = this.registry.get(keyword.store);
    const results = await provider.search(
      keyword.text,
      keyword.country,
      SEARCH_DEPTH,
    );
    const top30TitleMatchCount = this.countTitleMatches(results, keyword.text);

    if (keyword.store === Store.GOOGLE_PLAY) {
      return {
        store: keyword.store,
        keywordText: keyword.text,
        top10: await this.enrichTop10(provider, results, keyword.country),
        top30TitleMatchCount,
        suggest: {
          prefixHitLength: await this.probePrefix(
            provider,
            keyword.text,
            keyword.country,
          ),
        },
      };
    }

    const suggestions = await this.safeSuggest(
      keyword.store,
      keyword.text,
      keyword.country,
    );

    return {
      store: keyword.store,
      keywordText: keyword.text,
      top10: results
        .slice(0, TOP_STRENGTH)
        .map((item) => this.toStrength(item)),
      top30TitleMatchCount,
      suggest: this.toSuggest(suggestions, keyword.text),
    };
  }

  private async enrichTop10(
    provider: StoreProvider,
    results: SearchItem[],
    country: string,
  ): Promise<KeywordStats['top10']> {
    const enriched: KeywordStats['top10'] = [];
    for (const item of results.slice(0, TOP_STRENGTH)) {
      try {
        const app = await provider.getApp(item.storeAppId, country);
        enriched.push({
          title: app.title,
          ...(app.ratingCount === undefined
            ? {}
            : { ratingCount: app.ratingCount }),
          ...(app.ratingAvg === undefined ? {} : { ratingAvg: app.ratingAvg }),
          ...(app.storeUpdatedAt === undefined
            ? {}
            : { daysSinceUpdate: daysSince(app.storeUpdatedAt) }),
          ...(app.installs === undefined
            ? {}
            : { installs: Number(app.installs) }),
        });
      } catch (error) {
        this.logger.warn(
          `detail lookup failed for "${item.storeAppId}", dropping it: ${messageOf(error)}`,
        );
      }
    }
    return enriched;
  }

  private async probePrefix(
    provider: StoreProvider,
    text: string,
    country: string,
  ): Promise<number | null> {
    const target = normalizeText(text);
    const maxLength = Math.min(text.length, PREFIX_PROBE_CAP);
    for (let length = 1; length <= maxLength; length += 1) {
      const suggestions = await provider.suggest(
        text.slice(0, length),
        country,
      );
      if (suggestions.some((item) => normalizeText(item.term) === target)) {
        return length;
      }
    }
    return null;
  }

  private async safeSuggest(
    store: Store,
    text: string,
    country: string,
  ): Promise<SuggestItem[]> {
    try {
      return await this.registry.get(store).suggest(text, country);
    } catch (error) {
      this.logger.warn(
        `suggest failed for "${text}", scoring without it: ${messageOf(error)}`,
      );
      return [];
    }
  }

  private toStrength(item: SearchItem): KeywordStats['top10'][number] {
    return {
      title: item.title,
      ...(item.ratingCount === undefined
        ? {}
        : { ratingCount: item.ratingCount }),
      ...(item.ratingAvg === undefined ? {} : { ratingAvg: item.ratingAvg }),
      ...(item.updatedAt === undefined
        ? {}
        : { daysSinceUpdate: daysSince(item.updatedAt) }),
    };
  }

  private countTitleMatches(results: SearchItem[], text: string): number {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    return results.slice(0, TITLE_MATCH_DEPTH).filter((item) => {
      const title = item.title.toLowerCase();
      return words.every((word) => title.includes(word));
    }).length;
  }

  private toSuggest(
    suggestions: { term: string; priority?: number }[],
    text: string,
  ): KeywordStats['suggest'] {
    const target = text.toLowerCase();
    const exact = suggestions.find(
      (item) => item.term.toLowerCase() === target,
    );
    if (exact) {
      return exact.priority === undefined ? {} : { priority: exact.priority };
    }

    const partial = suggestions
      .filter((item) => item.term.toLowerCase().includes(target))
      .reduce<number | undefined>((best, item) => {
        if (item.priority === undefined) {
          return best;
        }
        return best === undefined || item.priority > best
          ? item.priority
          : best;
      }, undefined);

    return partial === undefined ? {} : { partialPriority: partial };
  }
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / DAY_MS);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
