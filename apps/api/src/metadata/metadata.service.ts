import { Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  KeywordCoverageRow,
  KeywordFieldSuggestion,
  lintDescription,
  lintKeywordField,
  lintSubtitle,
  lintTitle,
  LintContext,
  MetadataAuditResult,
  MetadataField,
  MetadataFieldAudit,
  normalizeText,
  STORE_FIELD_LIMITS,
  tokenize,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { StoreNotSupportedError } from '../store-providers/errors';

const KEYWORD_FIELD_LIMIT = STORE_FIELD_LIMITS.APP_STORE.keywordField!.limit;

const covers = (field: string, keyword: string): boolean =>
  ` ${normalizeText(field)} `.includes(` ${keyword} `);

const singularize = (text: string): string =>
  tokenize(text)
    .map((word) =>
      word.length > 3 && word.endsWith('s') && !word.endsWith('ss')
        ? word.slice(0, -1)
        : word,
    )
    .join(' ');

@Injectable()
export class MetadataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keywords: KeywordsService,
  ) {}

  async audit(appId: string): Promise<MetadataAuditResult> {
    const app = await this.ensureAppStoreApp(appId);
    const [snapshot, tracked, competitors] = await Promise.all([
      this.prisma.appSnapshot.findFirst({
        where: { appId },
        orderBy: { capturedAt: 'desc' },
        select: { title: true, subtitle: true, description: true },
      }),
      this.keywords.listTracked(appId),
      this.prisma.app.findMany({
        where: { primaryAppId: appId },
        select: { name: true },
      }),
    ]);

    const active = tracked.filter((item) => item.active);
    const title = snapshot?.title ?? '';
    const subtitle = snapshot?.subtitle ?? '';
    const description = snapshot?.description ?? '';
    const keywordFieldValue = active
      .filter((item) => item.source === 'KEYWORD_FIELD')
      .map((item) => item.text)
      .join(',');

    const context: LintContext = {
      titleWords: tokenize(title),
      subtitleWords: tokenize(subtitle),
      brandTokens: tokenize(app.name ?? ''),
      competitorNames: competitors
        .map((competitor) => competitor.name)
        .filter((name): name is string => Boolean(name)),
      trackedKeywords: active.map((item) => item.text),
    };

    const fields: MetadataFieldAudit[] = [
      this.field('title', title, lintTitle(title, 30)),
      this.field('subtitle', subtitle, lintSubtitle(subtitle, context, 30)),
    ];
    if (keywordFieldValue.length > 0) {
      fields.push(
        this.field(
          'keywordField',
          keywordFieldValue,
          lintKeywordField(keywordFieldValue, context, KEYWORD_FIELD_LIMIT),
        ),
      );
    }
    fields.push(
      this.field(
        'description',
        description,
        lintDescription(
          description,
          STORE_FIELD_LIMITS.APP_STORE.description!.limit,
        ),
      ),
    );

    const coverage = active.map((item) =>
      this.coverageRow(item, title, subtitle, keywordFieldValue),
    );

    return {
      appId,
      store: app.store,
      fields,
      coverage,
      keywordFieldSuggestion: this.suggestion(active, coverage),
    };
  }

  private field(
    field: MetadataField,
    value: string,
    issues: MetadataFieldAudit['issues'],
  ): MetadataFieldAudit {
    const limit = STORE_FIELD_LIMITS.APP_STORE[field]!;
    return {
      field,
      value,
      chars: value.length,
      limit: limit.limit,
      indexed: limit.indexed,
      issues,
    };
  }

  private coverageRow(
    item: TrackedKeywordItem,
    title: string,
    subtitle: string,
    keywordField: string,
  ): KeywordCoverageRow {
    const inTitle = covers(title, item.text);
    const inSubtitle = covers(subtitle, item.text);
    const inKeywordField = covers(keywordField, item.text);
    return {
      keywordId: item.keywordId,
      text: item.text,
      bucket: item.bucket,
      inTitle,
      inSubtitle,
      inKeywordField,
      uncovered: !inTitle && !inSubtitle && !inKeywordField,
    };
  }

  private suggestion(
    tracked: TrackedKeywordItem[],
    coverage: KeywordCoverageRow[],
  ): KeywordFieldSuggestion {
    const uncovered = new Set(
      coverage.filter((row) => row.uncovered).map((row) => row.keywordId),
    );
    const candidates = tracked
      .filter((item) => uncovered.has(item.keywordId))
      .map((item) => ({
        text: singularize(item.text),
        score: (item.volume ?? 0) * (item.relevance ?? 0),
      }))
      .sort((a, b) => b.score - a.score);

    const added: string[] = [];
    let value = '';
    for (const candidate of candidates) {
      if (!candidate.text || added.includes(candidate.text)) {
        continue;
      }
      const next =
        value.length === 0 ? candidate.text : `${value},${candidate.text}`;
      if (next.length > KEYWORD_FIELD_LIMIT) {
        continue;
      }
      value = next;
      added.push(candidate.text);
    }

    return {
      value,
      charactersUsed: value.length,
      charactersLimit: KEYWORD_FIELD_LIMIT,
      addedTerms: added,
    };
  }

  private async ensureAppStoreApp(
    appId: string,
  ): Promise<{ id: string; store: Store; name: string | null }> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true, store: true, name: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    if (app.store !== Store.APP_STORE) {
      throw new StoreNotSupportedError(app.store);
    }
    return app;
  }
}
