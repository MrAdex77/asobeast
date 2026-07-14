import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KeywordSource, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  KeywordComparison,
  KeywordComparisonRow,
  KeywordCountrySummary,
  KeywordFieldResult,
  KeywordSort,
  KeywordSuggestion,
  KeywordSuggestionStrategy,
  KEYWORD_FIELD_CHAR_LIMIT,
  normalizeText,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { isoWeekKey, JOBS, QUEUES, scoreJobId } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { serpVolatility } from '../rankings/serp-volatility';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { classifyBuckets } from './buckets';
import { extractCandidates } from './extraction';
import { toTrackedKeywordItem } from './keywords.mapper';
import { mineReviewPhrases } from './review-mining';
import { seasonalSuggestions } from './seasonal-suggestions';

const AUTO_TRACK_LIMIT = 15;
const MAX_KEYWORD_WORDS = 5;
const REVIEW_MINING_CAP = 500;
const RANKING_HISTORY_LIMIT = 60;
const SEARCH_SEED_LIMIT = 5;
const VOLATILITY_WINDOW_DAYS = 8;

const SOURCE_WEIGHT: Record<KeywordSource, number> = {
  KEYWORD_FIELD: 4,
  TITLE: 3,
  SUBTITLE: 2,
  MANUAL: 2,
  SUGGESTED: 1,
  DESCRIPTION: 1,
  COMPETITOR: 1,
};

@Injectable()
export class KeywordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
  ) {}

  private async enqueueFirstScore(keywordId: string): Promise<void> {
    const existing = await this.prisma.keywordMetric.findFirst({
      where: { keywordId },
      select: { keywordId: true },
    });
    if (existing) {
      return;
    }
    await this.appStoreQueue.add(
      JOBS.SCORE_KEYWORD,
      { keywordId },
      { jobId: scoreJobId(keywordId, isoWeekKey()) },
    );
  }

  async listTracked(
    appId: string,
    sort?: KeywordSort,
    country?: string,
  ): Promise<TrackedKeywordItem[]> {
    await this.ensureApp(appId);
    const rows = await this.prisma.trackedKeyword.findMany({
      where: { appId, ...(country ? { keyword: { is: { country } } } : {}) },
      ...this.trackedArgs(appId),
    });
    const [snapshotText, volatility] = await Promise.all([
      this.snapshotText(appId),
      this.serpVolatilities(rows.map((row) => row.keywordId)),
    ]);
    return sortTracked(
      classifyBuckets(
        rows.map((row) =>
          toTrackedKeywordItem(
            row,
            snapshotText,
            volatility.get(row.keywordId) ?? null,
          ),
        ),
      ),
      sort,
    );
  }

  async keywordCountries(appId: string): Promise<KeywordCountrySummary[]> {
    const app = await this.ensureApp(appId);
    const rows = await this.prisma.trackedKeyword.findMany({
      where: { appId },
      select: { keyword: { select: { country: true } } },
    });

    const counts = new Map<string, number>([[app.country, 0]]);
    for (const row of rows) {
      const country = row.keyword.country;
      counts.set(country, (counts.get(country) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([country, keywordCount]) => ({ country, keywordCount }))
      .sort((a, b) => {
        if (a.country === app.country) return -1;
        if (b.country === app.country) return 1;
        return b.keywordCount - a.keywordCount;
      });
  }

  private async snapshotText(appId: string): Promise<string> {
    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
      select: { title: true, subtitle: true, summary: true },
    });
    if (!snapshot) {
      return '';
    }
    return [snapshot.title, snapshot.subtitle, snapshot.summary]
      .filter((part): part is string => Boolean(part))
      .join(' ');
  }

  async compare(appId: string, onlyGaps: boolean): Promise<KeywordComparison> {
    await this.ensureApp(appId);

    const competitors = await this.prisma.app.findMany({
      where: { primaryAppId: appId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    const tracked = await this.prisma.trackedKeyword.findMany({
      where: { appId, active: true },
      orderBy: { createdAt: 'asc' },
      select: {
        keywordId: true,
        keyword: {
          select: {
            text: true,
            metrics: {
              orderBy: { date: 'desc' },
              take: 1,
              select: { traffic: true, difficulty: true },
            },
          },
        },
      },
    });

    const appIds = [appId, ...competitors.map((competitor) => competitor.id)];
    const latest = await this.latestPositions(
      appIds,
      tracked.map((row) => row.keywordId),
    );

    const rows = tracked.map((row) => {
      const you = latest.get(positionKey(appId, row.keywordId)) ?? null;
      const positions: Record<string, number | null> = {};
      for (const competitor of competitors) {
        positions[competitor.id] =
          latest.get(positionKey(competitor.id, row.keywordId)) ?? null;
      }
      const metric = row.keyword.metrics[0] ?? null;
      return {
        keywordId: row.keywordId,
        text: row.keyword.text,
        traffic: metric?.traffic ?? null,
        difficulty: metric?.difficulty ?? null,
        you,
        positions,
        gap: isGap(you, positions),
      };
    });

    const filtered = onlyGaps ? rows.filter((row) => row.gap) : rows;
    return { competitors, rows: sortComparison(filtered) };
  }

  private async serpVolatilities(
    keywordIds: string[],
  ): Promise<Map<string, number | null>> {
    if (keywordIds.length === 0) {
      return new Map();
    }
    const latest = await this.prisma.serpEntry.findFirst({
      where: { keywordId: { in: keywordIds } },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!latest) {
      return new Map();
    }
    const from = new Date(latest.date);
    from.setUTCDate(from.getUTCDate() - VOLATILITY_WINDOW_DAYS);
    const entries = await this.prisma.serpEntry.findMany({
      where: { keywordId: { in: keywordIds }, date: { gte: from } },
      orderBy: { date: 'asc' },
      select: { keywordId: true, date: true, storeAppId: true },
    });

    const byKeyword = new Map<string, Map<string, string[]>>();
    for (const entry of entries) {
      const dateKey = entry.date.toISOString().slice(0, 10);
      let dates = byKeyword.get(entry.keywordId);
      if (!dates) {
        dates = new Map();
        byKeyword.set(entry.keywordId, dates);
      }
      const set = dates.get(dateKey);
      if (set) {
        set.push(entry.storeAppId);
      } else {
        dates.set(dateKey, [entry.storeAppId]);
      }
    }

    const result = new Map<string, number | null>();
    for (const [keywordId, dates] of byKeyword) {
      const dailySets = [...dates.keys()]
        .sort()
        .map((key) => dates.get(key) ?? []);
      result.set(keywordId, serpVolatility(dailySets));
    }
    return result;
  }

  private async latestPositions(
    appIds: string[],
    keywordIds: string[],
  ): Promise<Map<string, number | null>> {
    if (keywordIds.length === 0) {
      return new Map();
    }
    const rankings = await this.prisma.keywordRanking.findMany({
      where: { appId: { in: appIds }, keywordId: { in: keywordIds } },
      orderBy: { date: 'desc' },
      select: { appId: true, keywordId: true, position: true },
    });
    const latest = new Map<string, number | null>();
    for (const ranking of rankings) {
      const key = positionKey(ranking.appId, ranking.keywordId);
      if (!latest.has(key)) {
        latest.set(key, ranking.position);
      }
    }
    return latest;
  }

  async addManual(
    appId: string,
    rawKeywords: string[],
    country?: string,
  ): Promise<TrackedKeywordItem[]> {
    const app = await this.ensureApp(appId);
    const market = country ?? app.country;
    const texts = new Set(rawKeywords.map((raw) => this.normalizeKeyword(raw)));

    for (const text of texts) {
      const keyword = await this.prisma.keyword.upsert({
        where: {
          text_store_country: { text, store: app.store, country: market },
        },
        create: { text, store: app.store, country: market },
        update: {},
        select: { id: true },
      });
      await this.prisma.trackedKeyword.upsert({
        where: { appId_keywordId: { appId, keywordId: keyword.id } },
        create: {
          appId,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: true,
        },
        update: { active: true },
      });
      await this.enqueueFirstScore(keyword.id);
    }

    return this.listTracked(appId, undefined, market);
  }

  async updateKeyword(
    appId: string,
    keywordId: string,
    data: { active?: boolean; relevance?: number | null },
  ): Promise<TrackedKeywordItem> {
    await this.ensureApp(appId);
    await this.ensureTracked(appId, keywordId);
    await this.prisma.trackedKeyword.update({
      where: { appId_keywordId: { appId, keywordId } },
      data: {
        ...(data.active === undefined ? {} : { active: data.active }),
        ...('relevance' in data ? { relevance: data.relevance } : {}),
      },
    });
    return this.getTrackedItem(appId, keywordId);
  }

  async remove(appId: string, keywordId: string): Promise<void> {
    await this.ensureApp(appId);
    await this.ensureTracked(appId, keywordId);
    await this.prisma.trackedKeyword.delete({
      where: { appId_keywordId: { appId, keywordId } },
    });
  }

  async setKeywordField(
    appId: string,
    text: string,
  ): Promise<KeywordFieldResult> {
    const app = await this.ensureApp(appId);
    if (app.store !== Store.APP_STORE) {
      throw new BadRequestException(
        'The keyword field is only available for App Store apps',
      );
    }

    const parsed = text
      .split(',')
      .map((part) => normalizeText(part))
      .filter((part) => part.length > 0);
    const unique = [...new Set(parsed)];
    const duplicatesRemoved = parsed.length - unique.length;

    const previous = await this.prisma.trackedKeyword.findMany({
      where: { appId, source: 'KEYWORD_FIELD' },
      select: { keywordId: true, keyword: { select: { text: true } } },
    });

    for (const value of unique) {
      const keyword = await this.prisma.keyword.upsert({
        where: {
          text_store_country: {
            text: value,
            store: app.store,
            country: app.country,
          },
        },
        create: { text: value, store: app.store, country: app.country },
        update: {},
        select: { id: true },
      });
      await this.prisma.trackedKeyword.upsert({
        where: { appId_keywordId: { appId, keywordId: keyword.id } },
        create: {
          appId,
          keywordId: keyword.id,
          source: 'KEYWORD_FIELD',
          active: true,
        },
        update: { source: 'KEYWORD_FIELD', active: true },
      });
      await this.enqueueFirstScore(keyword.id);
    }

    const uniqueSet = new Set(unique);
    const staleKeywordIds = previous
      .filter((row) => !uniqueSet.has(row.keyword.text))
      .map((row) => row.keywordId);
    if (staleKeywordIds.length > 0) {
      await this.prisma.trackedKeyword.updateMany({
        where: { appId, keywordId: { in: staleKeywordIds } },
        data: { active: false },
      });
    }

    const rows = await this.prisma.trackedKeyword.findMany({
      where: { appId, source: 'KEYWORD_FIELD', active: true },
      ...this.trackedArgs(appId),
    });
    const [snapshotText, volatility] = await Promise.all([
      this.snapshotText(appId),
      this.serpVolatilities(rows.map((row) => row.keywordId)),
    ]);
    const tracked = rows.map((row) =>
      toTrackedKeywordItem(
        row,
        snapshotText,
        volatility.get(row.keywordId) ?? null,
      ),
    );

    return {
      tracked,
      charactersUsed: unique.join(',').length,
      charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
      duplicatesRemoved,
    };
  }

  async suggest(
    appId: string,
    strategy: KeywordSuggestionStrategy,
    limit: number,
    country?: string,
  ): Promise<KeywordSuggestion[]> {
    const app = await this.ensureApp(appId);
    const market = { ...app, country: country ?? app.country };
    const trackedTexts = await this.trackedTexts(appId);

    if (strategy === 'search') {
      return this.suggestFromSearch(appId, market, trackedTexts, limit);
    }
    if (strategy === 'similar') {
      return this.suggestFromSimilar(market, trackedTexts, limit);
    }
    if (strategy === 'competitors') {
      return this.suggestFromCompetitors(appId, trackedTexts, limit);
    }
    if (strategy === 'seasonal') {
      return seasonalSuggestions(new Date(), trackedTexts, limit);
    }
    if (strategy === 'reviews') {
      return this.suggestFromReviews(appId, trackedTexts, limit);
    }
    return this.suggestFromMetadata(appId, trackedTexts, limit);
  }

  private async suggestFromReviews(
    appId: string,
    trackedTexts: Set<string>,
    limit: number,
  ): Promise<KeywordSuggestion[]> {
    const reviews = await this.prisma.review.findMany({
      where: { appId },
      orderBy: { reviewedAt: 'desc' },
      take: REVIEW_MINING_CAP,
      select: { title: true, text: true },
    });
    return mineReviewPhrases(reviews, trackedTexts).slice(0, limit);
  }

  private async suggestFromCompetitors(
    appId: string,
    trackedTexts: Set<string>,
    limit: number,
  ): Promise<KeywordSuggestion[]> {
    const competitors = await this.prisma.app.findMany({
      where: { primaryAppId: appId },
      select: {
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
          select: { title: true, subtitle: true },
        },
      },
    });

    const counts = new Map<string, number>();
    for (const competitor of competitors) {
      const snapshot = competitor.snapshots[0];
      if (!snapshot) {
        continue;
      }
      const texts = new Set(
        extractCandidates({
          title: snapshot.title,
          subtitle: snapshot.subtitle ?? undefined,
        }).map((candidate) => candidate.text),
      );
      for (const text of texts) {
        if (trackedTexts.has(text)) {
          continue;
        }
        counts.set(text, (counts.get(text) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([text, usedByCount]) => ({
        text,
        strategy: 'competitors' as const,
        usedByCount,
      }));
  }

  private async suggestFromMetadata(
    appId: string,
    trackedTexts: Set<string>,
    limit: number,
  ): Promise<KeywordSuggestion[]> {
    const candidates = await this.latestCandidates(appId);
    return candidates
      .filter((candidate) => !trackedTexts.has(candidate.text))
      .slice(0, limit)
      .map((candidate) => ({
        text: candidate.text,
        strategy: 'metadata' as const,
      }));
  }

  private async suggestFromSearch(
    appId: string,
    app: { store: Store; country: string },
    trackedTexts: Set<string>,
    limit: number,
  ): Promise<KeywordSuggestion[]> {
    const provider = this.registry.get(app.store);
    const seeds = await this.searchSeeds(appId);
    const seedSet = new Set(seeds);
    const merged = new Map<string, number | undefined>();

    for (const seed of seeds) {
      const items = await provider.suggest(seed, app.country);
      for (const item of items) {
        const text = normalizeText(item.term);
        if (!text || trackedTexts.has(text) || seedSet.has(text)) {
          continue;
        }
        if (!merged.has(text)) {
          merged.set(text, item.priority);
        } else if ((item.priority ?? -1) > (merged.get(text) ?? -1)) {
          merged.set(text, item.priority);
        }
      }
    }

    return [...merged.entries()]
      .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
      .slice(0, limit)
      .map(([text, priority]) => ({
        text,
        strategy: 'search' as const,
        ...(priority === undefined ? {} : { priority }),
      }));
  }

  private async suggestFromSimilar(
    app: { store: Store; country: string; storeAppId: string },
    trackedTexts: Set<string>,
    limit: number,
  ): Promise<KeywordSuggestion[]> {
    const provider = this.registry.get(app.store);
    const similar = await provider.similar(app.storeAppId, app.country);
    const counts = new Map<string, number>();

    for (const item of similar) {
      const texts = new Set(
        extractCandidates({ title: item.title }).map(
          (candidate) => candidate.text,
        ),
      );
      for (const text of texts) {
        if (trackedTexts.has(text)) {
          continue;
        }
        counts.set(text, (counts.get(text) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([text, usedByCount]) => ({
        text,
        strategy: 'similar' as const,
        usedByCount,
      }));
  }

  private async searchSeeds(appId: string): Promise<string[]> {
    const tracked = await this.prisma.trackedKeyword.findMany({
      where: { appId, active: true },
      select: { source: true, keyword: { select: { text: true } } },
    });
    return tracked
      .sort((a, b) => SOURCE_WEIGHT[b.source] - SOURCE_WEIGHT[a.source])
      .slice(0, SEARCH_SEED_LIMIT)
      .map((row) => row.keyword.text);
  }

  private async latestCandidates(appId: string) {
    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
      select: { title: true, subtitle: true, summary: true },
    });
    if (!snapshot) {
      return [];
    }
    return extractCandidates({
      title: snapshot.title,
      subtitle: snapshot.subtitle ?? undefined,
      summary: snapshot.summary ?? undefined,
    });
  }

  private async trackedTexts(appId: string): Promise<Set<string>> {
    const rows = await this.prisma.trackedKeyword.findMany({
      where: { appId },
      select: { keyword: { select: { text: true } } },
    });
    return new Set(rows.map((row) => row.keyword.text));
  }

  async syncFromSnapshot(appId: string): Promise<void> {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      select: { id: true, store: true, country: true },
    });
    if (!app) {
      return;
    }

    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
      select: { title: true, subtitle: true, summary: true },
    });
    if (!snapshot) {
      return;
    }

    const candidates = extractCandidates({
      title: snapshot.title,
      subtitle: snapshot.subtitle ?? undefined,
      summary: snapshot.summary ?? undefined,
    })
      .filter(
        (candidate) =>
          candidate.source === 'TITLE' || candidate.source === 'SUBTITLE',
      )
      .slice(0, AUTO_TRACK_LIMIT);

    for (const candidate of candidates) {
      const keyword = await this.prisma.keyword.upsert({
        where: {
          text_store_country: {
            text: candidate.text,
            store: app.store,
            country: app.country,
          },
        },
        create: {
          text: candidate.text,
          store: app.store,
          country: app.country,
        },
        update: {},
        select: { id: true },
      });

      await this.prisma.trackedKeyword.upsert({
        where: { appId_keywordId: { appId: app.id, keywordId: keyword.id } },
        create: {
          appId: app.id,
          keywordId: keyword.id,
          source: candidate.source,
          active: true,
        },
        update: {},
      });
      await this.enqueueFirstScore(keyword.id);
    }
  }

  private normalizeKeyword(raw: string): string {
    const text = normalizeText(raw);
    if (!text) {
      throw new BadRequestException('Keyword must not be empty');
    }
    if (text.split(' ').length > MAX_KEYWORD_WORDS) {
      throw new BadRequestException(
        `Keyword "${text}" exceeds ${MAX_KEYWORD_WORDS} words`,
      );
    }
    return text;
  }

  private async ensureApp(appId: string): Promise<{
    id: string;
    store: Store;
    country: string;
    storeAppId: string;
  }> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true, store: true, country: true, storeAppId: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return app;
  }

  private async ensureTracked(appId: string, keywordId: string): Promise<void> {
    const tracked = await this.prisma.trackedKeyword.findUnique({
      where: { appId_keywordId: { appId, keywordId } },
      select: { appId: true },
    });
    if (!tracked) {
      throw new NotFoundException(`Keyword ${keywordId} is not tracked`);
    }
  }

  private async getTrackedItem(
    appId: string,
    keywordId: string,
  ): Promise<TrackedKeywordItem> {
    const item = (await this.listTracked(appId)).find(
      (tracked) => tracked.keywordId === keywordId,
    );
    if (!item) {
      throw new NotFoundException(`Keyword ${keywordId} is not tracked`);
    }
    return item;
  }

  private trackedArgs(appId: string) {
    return {
      orderBy: { createdAt: 'asc' as const },
      select: {
        keywordId: true,
        source: true,
        active: true,
        relevance: true,
        keyword: {
          select: {
            text: true,
            country: true,
            rankings: {
              where: { appId },
              orderBy: { date: 'desc' as const },
              take: RANKING_HISTORY_LIMIT,
              select: { position: true, date: true },
            },
            metrics: {
              orderBy: { date: 'desc' as const },
              take: 1,
              select: { traffic: true, difficulty: true, date: true },
            },
          },
        },
      },
    };
  }
}

const GAP_COMPETITOR_TOP = 10;
const GAP_PRIMARY_WORSE_THAN = 30;

function positionKey(appId: string, keywordId: string): string {
  return `${appId}:${keywordId}`;
}

function isGap(
  you: number | null,
  positions: Record<string, number | null>,
): boolean {
  const primaryWeak = you === null || you > GAP_PRIMARY_WORSE_THAN;
  if (!primaryWeak) {
    return false;
  }
  return Object.values(positions).some(
    (position) => position !== null && position <= GAP_COMPETITOR_TOP,
  );
}

function sortComparison(rows: KeywordComparisonRow[]): KeywordComparisonRow[] {
  return [...rows].sort((a, b) => {
    if (a.gap !== b.gap) {
      return a.gap ? -1 : 1;
    }
    return (b.traffic ?? 0) - (a.traffic ?? 0);
  });
}

const SORT_VALUE: Record<
  KeywordSort,
  (item: TrackedKeywordItem) => number | null
> = {
  opportunity: (item) => item.opportunity,
  traffic: (item) => item.traffic,
  difficulty: (item) => item.difficulty,
  position: (item) => item.latestPosition,
};

function sortTracked(
  items: TrackedKeywordItem[],
  sort?: KeywordSort,
): TrackedKeywordItem[] {
  if (!sort) {
    return items;
  }
  const value = SORT_VALUE[sort];
  const ascending = sort === 'position';
  return [...items].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av === null && bv === null) {
      return 0;
    }
    if (av === null) {
      return 1;
    }
    if (bv === null) {
      return -1;
    }
    return ascending ? av - bv : bv - av;
  });
}
