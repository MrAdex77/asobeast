import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import { AiClient, AiContentPart, OPENAI_CLIENT } from '../ai/openai.client';

export interface AiAuditInput {
  store: Store;
  title: string;
  subtitle: string | null;
  summary: string | null;
  description: string;
  genreName: string | null;
  languages: string[];
  releaseNotes: string | null;
  hasVideo: boolean | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  iconUrl: string | null;
  screenshotUrls: string[];
}

export type AiAuditChecks = Record<string, { score: number; detail: string }>;

interface SubjectiveCheck {
  id: string;
  guidance: string;
}

const SUBJECTIVE_CHECKS: SubjectiveCheck[] = [
  {
    id: 'screenshots-first-three',
    guidance:
      'Do the first three screenshots lead with the strongest, most benefit-driven features?',
  },
  {
    id: 'screenshots-text-overlays',
    guidance:
      'Do the screenshots carry clear, readable captions that communicate benefits rather than bare UI?',
  },
  {
    id: 'screenshots-consistent',
    guidance:
      'Do the screenshots share a cohesive visual design language (colour, type, layout)?',
  },
  {
    id: 'screenshots-localized',
    guidance:
      'Do the screenshots appear localised for the target market language?',
  },
  {
    id: 'screenshots-device-frames',
    guidance:
      'Do the screenshots use modern device frames or a clean frameless style?',
  },
  {
    id: 'preview-video-exists',
    guidance:
      'Is there evidence of an app preview video? Score 0 when none is provided.',
  },
  {
    id: 'preview-video-hook',
    guidance:
      'If a preview video exists, does it hook the viewer within the first three seconds?',
  },
  {
    id: 'preview-video-length',
    guidance: 'Is the preview video an optimal 15 to 30 seconds long?',
  },
  {
    id: 'preview-video-sound',
    guidance:
      'Does the preview video work muted, using captions or on-screen text?',
  },
  {
    id: 'ratings-responses',
    guidance:
      'From the listing signals, does the developer appear to respond to negative reviews?',
  },
  {
    id: 'ratings-prompts',
    guidance:
      'Does the app appear to use strategic in-app rating prompts, inferred from rating volume?',
  },
  {
    id: 'icon-distinctive',
    guidance: 'Does the icon stand out in search results and browse?',
  },
  {
    id: 'icon-simple',
    guidance: 'Is the icon clear and legible at small sizes?',
  },
  {
    id: 'icon-category-fit',
    guidance:
      'Does the icon match category expectations while staying distinctive?',
  },
  {
    id: 'icon-no-text',
    guidance: 'Does the icon avoid small, unreadable text?',
  },
  {
    id: 'conversion-promo',
    guidance:
      'Does the listing use promotional text or timely messaging effectively?',
  },
  {
    id: 'conversion-events',
    guidance:
      'Does the app appear to use in-app events for visibility? Score 0 when unused.',
  },
  {
    id: 'conversion-cpp',
    guidance:
      'Does the app appear to use custom product pages for different audiences?',
  },
];

export const SUBJECTIVE_CHECK_IDS = SUBJECTIVE_CHECKS.map((item) => item.id);

const SUBJECTIVE_IDS = new Set(SUBJECTIVE_CHECK_IDS);

const MAX_SCREENSHOTS = 6;
const MAX_DESCRIPTION_CHARS = 1500;

const AUDIT_SCHEMA = {
  name: 'aso_subjective_audit',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['checks'],
    properties: {
      checks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'score', 'detail'],
          properties: {
            id: { type: 'string', enum: [...SUBJECTIVE_IDS] },
            score: { type: 'integer' },
            detail: { type: 'string' },
          },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = [
  'You are an expert App Store Optimization (ASO) auditor.',
  'Score each subjective listing factor below on a 0-10 integer scale',
  '(10 excellent, 7-9 good, 4-6 needs work, 0-3 poor or absent),',
  'grounded only in the metadata and creative provided (icon and screenshot images,',
  'description, ratings, release notes). Give each factor a concise one-sentence rationale',
  'referencing what you observed. When a factor cannot be determined from the provided data,',
  'score it conservatively around 4-5 and say so. Do not invent facts. Return every factor exactly once.',
  '',
  'Factors:',
  ...SUBJECTIVE_CHECKS.map((item) => `- ${item.id}: ${item.guidance}`),
].join('\n');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const clampScore = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(10, Math.max(0, Math.round(numeric)));
};

const storeLabel = (store: Store): string =>
  store === Store.GOOGLE_PLAY ? 'Google Play' : 'Apple App Store';

export const buildAuditContent = (input: AiAuditInput): AiContentPart[] => {
  const lines = [
    `Store: ${storeLabel(input.store)}`,
    `Title: ${input.title || '(empty)'}`,
    input.store === Store.GOOGLE_PLAY
      ? `Short description: ${input.summary ?? '(none)'}`
      : `Subtitle: ${input.subtitle ?? '(none)'}`,
    `Category: ${input.genreName ?? '(unknown)'}`,
    `Languages: ${input.languages.length ? input.languages.join(', ') : '(unknown)'}`,
    `Rating: ${input.ratingAvg ?? 'n/a'} from ${input.ratingCount ?? 0} ratings`,
    `Has preview video: ${
      input.hasVideo === null ? 'unknown' : input.hasVideo ? 'yes' : 'no'
    }`,
    `Release notes: ${input.releaseNotes ?? '(none)'}`,
    `Description:\n${input.description.slice(0, MAX_DESCRIPTION_CHARS)}`,
  ];
  const parts: AiContentPart[] = [{ type: 'text', text: lines.join('\n') }];
  if (input.iconUrl) {
    parts.push({ type: 'text', text: 'App icon:' });
    parts.push({ type: 'image', url: input.iconUrl });
  }
  const shots = input.screenshotUrls.slice(0, MAX_SCREENSHOTS);
  if (shots.length > 0) {
    parts.push({ type: 'text', text: `Screenshots (first ${shots.length}):` });
    for (const url of shots) {
      parts.push({ type: 'image', url });
    }
  }
  return parts;
};

export const validateAuditChecks = (raw: unknown): AiAuditChecks => {
  const result: AiAuditChecks = {};
  const checks = isRecord(raw) && Array.isArray(raw.checks) ? raw.checks : [];
  for (const entry of checks) {
    if (!isRecord(entry)) {
      continue;
    }
    const id = typeof entry.id === 'string' ? entry.id : null;
    if (!id || !SUBJECTIVE_IDS.has(id) || id in result) {
      continue;
    }
    const detail =
      typeof entry.detail === 'string' && entry.detail.trim().length > 0
        ? entry.detail.trim()
        : 'No rationale provided.';
    result[id] = { score: clampScore(entry.score), detail };
  }
  return result;
};

@Injectable()
export class AuditAiService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: AiClient | null,
  ) {}

  get configured(): boolean {
    return this.client !== null;
  }

  get model(): string | null {
    return this.client?.model ?? null;
  }

  async generate(input: AiAuditInput): Promise<AiAuditChecks> {
    if (!this.client) {
      throw new ConflictException('AI features require OPENAI_API_KEY');
    }
    const raw = await this.client.structured({
      system: SYSTEM_PROMPT,
      content: buildAuditContent(input),
      schema: AUDIT_SCHEMA,
    });
    return validateAuditChecks(raw);
  }
}
