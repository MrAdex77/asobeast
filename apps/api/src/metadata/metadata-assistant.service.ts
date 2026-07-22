import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  lintDescription,
  lintKeywordField,
  lintShortDescription,
  lintSubtitle,
  lintTitle,
  LintContext,
  LintIssue,
  MetadataAssistantResult,
  MetadataAssistantStatus,
  MetadataAuditResult,
  MetadataDraft,
  MetadataField,
  STORE_FIELD_LIMITS,
  tokenize,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { AiClient, OPENAI_CLIENT } from '../ai/openai.client';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetadataAssistantDto } from './dto/metadata-assistant.dto';
import { MetadataService } from './metadata.service';

const DEFAULT_FIELDS: Record<Store, MetadataField[]> = {
  APP_STORE: ['title', 'subtitle', 'keywordField'],
  GOOGLE_PLAY: ['title', 'shortDescription', 'description'],
};

const STORE_RULES: Record<Store, string[]> = {
  APP_STORE: [
    'Title: max 30 chars, indexed, highest weight — lead with the primary keyword.',
    'Subtitle: max 30 chars, indexed — add secondary keywords, never repeat the title.',
    'Keyword field: max 100 chars, comma-separated with NO spaces, singular forms, no words already in title or subtitle, no brand or category words.',
    'Description: not indexed — write for conversion with a strong first line.',
  ],
  GOOGLE_PLAY: [
    'Title: max 30 chars, indexed — lead with the primary keyword.',
    'Short description: max 80 chars, indexed — a natural benefit statement using key terms.',
    'Full description: max 4000 chars, indexed — front-load keywords naturally, no stuffing.',
  ],
};

const MAX_KEYWORDS = 25;

const SYSTEM_PROMPT = [
  'You are an expert App Store Optimization copywriter.',
  'Propose one optimised draft per requested metadata field, grounded only in the data provided.',
  'Follow the store rules exactly, stay within each character limit, use the tracked keywords',
  'to maximise search coverage, and keep every value natural and readable.',
  'For each field return the value and a concise one-sentence rationale. Draft only the requested fields.',
].join('\n');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const keywordScore = (item: TrackedKeywordItem): number =>
  item.opportunity ?? (item.volume ?? 0) * (item.relevance ?? 0);

const draftSchema = (fields: MetadataField[]) => ({
  name: 'metadata_drafts',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['drafts'],
    properties: {
      drafts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['field', 'value', 'rationale'],
          properties: {
            field: { type: 'string', enum: fields },
            value: { type: 'string' },
            rationale: { type: 'string' },
          },
        },
      },
    },
  },
});

const currentValue = (
  audit: MetadataAuditResult,
  field: MetadataField,
): string => audit.fields.find((item) => item.field === field)?.value ?? '';

export const buildAssistantContext = (
  store: Store,
  fields: MetadataField[],
  audit: MetadataAuditResult,
  keywords: TrackedKeywordItem[],
  competitorTitles: string[],
  instructions?: string,
): string => {
  const uncovered = new Set(
    audit.coverage.filter((row) => row.uncovered).map((row) => row.text),
  );
  const ranked = [...keywords]
    .sort((a, b) => keywordScore(b) - keywordScore(a))
    .slice(0, MAX_KEYWORDS);

  const lines = [
    `Store: ${store === Store.GOOGLE_PLAY ? 'Google Play' : 'Apple App Store'}`,
    '',
    'Store rules:',
    ...STORE_RULES[store].map((rule) => `- ${rule}`),
    '',
    'Current metadata:',
    ...(Object.keys(STORE_FIELD_LIMITS[store]) as MetadataField[]).map(
      (field) =>
        `- ${field} (max ${STORE_FIELD_LIMITS[store][field]!.limit}): ${
          currentValue(audit, field) || '(empty)'
        }`,
    ),
    '',
    'Top tracked keywords (keyword — volume / difficulty — coverage):',
    ...ranked.map(
      (item) =>
        `- ${item.text} — vol ${item.volume ?? '?'} / diff ${
          item.difficulty ?? '?'
        } — ${uncovered.has(item.text) ? 'uncovered' : 'covered'}`,
    ),
    '',
    'Competitor titles:',
    ...(competitorTitles.length > 0
      ? competitorTitles.map((title) => `- ${title}`)
      : ['- (none)']),
  ];
  if (instructions) {
    lines.push('', `Owner instructions: ${instructions}`);
  }
  lines.push('', `Draft these fields only: ${fields.join(', ')}.`);
  return lines.join('\n');
};

const lintFor = (
  field: MetadataField,
  value: string,
  context: LintContext,
  limit: number,
): LintIssue[] => {
  switch (field) {
    case 'title':
      return lintTitle(value, limit);
    case 'subtitle':
      return lintSubtitle(value, context, limit);
    case 'keywordField':
      return lintKeywordField(value, context, limit);
    case 'shortDescription':
      return lintShortDescription(value, context, limit);
    case 'description':
      return lintDescription(value, limit);
    default:
      return [];
  }
};

export const validateDrafts = (
  raw: unknown,
  store: Store,
  fields: MetadataField[],
  context: LintContext,
): MetadataDraft[] => {
  const allowed = new Set(fields);
  const seen = new Set<MetadataField>();
  const drafts: MetadataDraft[] = [];
  const items = isRecord(raw) && Array.isArray(raw.drafts) ? raw.drafts : [];
  for (const item of items) {
    if (!isRecord(item) || typeof item.field !== 'string') {
      continue;
    }
    const field = item.field as MetadataField;
    if (!allowed.has(field) || seen.has(field)) {
      continue;
    }
    const limit = STORE_FIELD_LIMITS[store][field]!.limit;
    const value = (typeof item.value === 'string' ? item.value : '').slice(
      0,
      limit,
    );
    seen.add(field);
    drafts.push({
      field,
      value,
      chars: value.length,
      limit,
      issues: lintFor(field, value, context, limit),
      rationale: typeof item.rationale === 'string' ? item.rationale : '',
    });
  }
  return drafts;
};

@Injectable()
export class MetadataAssistantService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: AiClient | null,
    private readonly prisma: PrismaService,
    private readonly keywords: KeywordsService,
    private readonly metadata: MetadataService,
  ) {}

  status(): MetadataAssistantStatus {
    return {
      configured: this.client !== null,
      model: this.client?.model ?? null,
    };
  }

  async generate(
    appId: string,
    dto: MetadataAssistantDto,
  ): Promise<MetadataAssistantResult> {
    if (!this.client) {
      throw new ConflictException('AI features require OPENAI_API_KEY');
    }
    const app = await this.ensureApp(appId);
    const fields = this.resolveFields(app.store, dto.fields);
    const [audit, tracked, competitors] = await Promise.all([
      this.metadata.audit(appId),
      this.keywords.listTracked(appId),
      this.prisma.app.findMany({
        where: { primaryAppId: appId },
        select: {
          name: true,
          snapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 1,
            select: { title: true },
          },
        },
      }),
    ]);

    const active = tracked.filter((item) => item.active);
    const competitorTitles = competitors
      .map((competitor) => competitor.snapshots[0]?.title)
      .filter((title): title is string => Boolean(title));
    const competitorNames = competitors
      .map((competitor) => competitor.name)
      .filter((name): name is string => Boolean(name));

    const raw = await this.client.structured({
      system: SYSTEM_PROMPT,
      content: [
        {
          type: 'text',
          text: buildAssistantContext(
            app.store,
            fields,
            audit,
            active,
            competitorTitles,
            dto.instructions,
          ),
        },
      ],
      schema: draftSchema(fields),
    });

    const context: LintContext = {
      titleWords: tokenize(currentValue(audit, 'title')),
      subtitleWords: tokenize(currentValue(audit, 'subtitle')),
      brandTokens: tokenize(app.name ?? ''),
      competitorNames,
      trackedKeywords: active.map((item) => item.text),
    };

    return {
      model: this.client.model,
      drafts: validateDrafts(raw, app.store, fields, context),
    };
  }

  private resolveFields(
    store: Store,
    requested?: MetadataField[],
  ): MetadataField[] {
    const supported = new Set(
      Object.keys(STORE_FIELD_LIMITS[store]) as MetadataField[],
    );
    const chosen = (requested ?? DEFAULT_FIELDS[store]).filter((field) =>
      supported.has(field),
    );
    return chosen.length > 0 ? [...new Set(chosen)] : DEFAULT_FIELDS[store];
  }

  private async ensureApp(
    appId: string,
  ): Promise<{ id: string; store: Store; name: string | null }> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true, store: true, name: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return app;
  }
}
