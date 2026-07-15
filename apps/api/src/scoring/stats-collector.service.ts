import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem, SuggestItem } from '../store-providers/types';
import { KeywordStats } from './formulas';

const SEARCH_DEPTH = 100;
const TOP_STRENGTH = 10;
const TITLE_MATCH_DEPTH = 30;
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
      top30TitleMatchCount: this.countTitleMatches(results, keyword.text),
      suggest: this.toSuggest(suggestions, keyword.text),
    };
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
