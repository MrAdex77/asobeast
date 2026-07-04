import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  KeywordFieldResult,
  normalizeText,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { PrismaService } from '../prisma/prisma.service';
import { extractCandidates } from './extraction';
import { toTrackedKeywordItem } from './keywords.mapper';

const AUTO_TRACK_LIMIT = 15;
const MAX_KEYWORD_WORDS = 5;
const RANKING_HISTORY_LIMIT = 60;
const KEYWORD_FIELD_CHAR_LIMIT = 100;

@Injectable()
export class KeywordsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTracked(appId: string): Promise<TrackedKeywordItem[]> {
    await this.ensureApp(appId);
    const rows = await this.prisma.trackedKeyword.findMany({
      where: { appId },
      ...this.trackedArgs(appId),
    });
    return rows.map(toTrackedKeywordItem);
  }

  async addManual(
    appId: string,
    rawKeywords: string[],
  ): Promise<TrackedKeywordItem[]> {
    const app = await this.ensureApp(appId);
    const texts = new Set(rawKeywords.map((raw) => this.normalizeKeyword(raw)));

    for (const text of texts) {
      const keyword = await this.prisma.keyword.upsert({
        where: {
          text_store_country: { text, store: app.store, country: app.country },
        },
        create: { text, store: app.store, country: app.country },
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
    }

    return this.listTracked(appId);
  }

  async toggle(
    appId: string,
    keywordId: string,
    active: boolean,
  ): Promise<TrackedKeywordItem> {
    await this.ensureApp(appId);
    await this.ensureTracked(appId, keywordId);
    await this.prisma.trackedKeyword.update({
      where: { appId_keywordId: { appId, keywordId } },
      data: { active },
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

    const tracked = (
      await this.prisma.trackedKeyword.findMany({
        where: { appId, source: 'KEYWORD_FIELD', active: true },
        ...this.trackedArgs(appId),
      })
    ).map(toTrackedKeywordItem);

    return {
      tracked,
      charactersUsed: unique.join(',').length,
      charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
      duplicatesRemoved,
    };
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

  private async ensureApp(
    appId: string,
  ): Promise<{ id: string; store: Store; country: string }> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true, store: true, country: true },
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
    const row = await this.prisma.trackedKeyword.findFirst({
      where: { appId, keywordId },
      ...this.trackedArgs(appId),
    });
    if (!row) {
      throw new NotFoundException(`Keyword ${keywordId} is not tracked`);
    }
    return toTrackedKeywordItem(row);
  }

  private trackedArgs(appId: string) {
    return {
      orderBy: { createdAt: 'asc' as const },
      select: {
        keywordId: true,
        source: true,
        active: true,
        keyword: {
          select: {
            text: true,
            rankings: {
              where: { appId },
              orderBy: { date: 'desc' as const },
              take: RANKING_HISTORY_LIMIT,
              select: { position: true, date: true },
            },
            metrics: {
              orderBy: { date: 'desc' as const },
              take: 1,
              select: { traffic: true, difficulty: true },
            },
          },
        },
      },
    };
  }
}
