import { KeywordSource, Store } from '@prisma/client';
import {
  AuditAiStatus,
  AuditCheckKind,
  AuditCheckResult,
  AuditCheckStatus,
  KeywordBucket,
  lintDescription,
  lintKeywordField,
  lintSubtitle,
  lintTitle,
  LintIssue,
  STORE_FIELD_LIMITS,
  tokenize,
} from '@asobeast/shared';
import { clamp, logScale } from '../scoring/formulas';
import { RawAppFacts } from '../store-providers/raw-facts';
import { AiAuditChecks } from './audit-ai.service';

export interface AuditKeyword {
  text: string;
  source: KeywordSource;
  bucket: KeywordBucket | null;
  relevance: number;
  position: number | null;
}

export interface AuditContext {
  appId: string;
  store: Store;
  title: string;
  subtitle: string | null;
  description: string;
  ratingAvg: number | null;
  ratingCount: number | null;
  storeUpdatedAt: Date | null;
  now: Date;
  rawFacts: RawAppFacts;
  keywords: AuditKeyword[];
  rankings: {
    top10Share: number;
    rankedShare: number;
    avgDelta7d: number | null;
    gapCount: number;
  };
  history: {
    ratingAvgDelta30d: number | null;
    ratingCountDelta30d: number | null;
  };
  competitorTitles: string[];
  competitorNames: string[];
  brandTokens: string[];
  aiChecks: AiAuditChecks;
  aiStatus: AuditAiStatus;
}

const TITLE_FULL_CHARS = 27;
const TITLE_PARTIAL_CHARS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const FRESH_DAYS = 30;

const statusFromScore = (score: number | null): AuditCheckStatus => {
  if (score === null) return 'unanswered';
  if (score >= 7) return 'pass';
  if (score >= 4) return 'warn';
  return 'fail';
};

const check = (
  id: string,
  label: string,
  kind: AuditCheckKind,
  score: number | null,
  detail: string,
): AuditCheckResult => ({
  id,
  label,
  kind,
  score,
  status: statusFromScore(score),
  detail,
});

const aiCheck = (
  id: string,
  label: string,
  ai: AiAuditChecks,
): AuditCheckResult => {
  const found = ai[id];
  if (!found) {
    return check(id, label, 'ai', null, 'Run the AI audit to score this.');
  }
  const score = found.score === null ? null : clamp(found.score, 0, 10);
  return check(id, label, 'ai', score, found.detail);
};

const lintScore = (issues: LintIssue[]): number => {
  let score = 10;
  for (const issue of issues) {
    if (issue.severity === 'error') score -= 4;
    else if (issue.severity === 'warn') score -= 2;
    else score -= 1;
  }
  return clamp(score, 0, 10);
};

const charUsageScore = (len: number, full: number, partial: number): number => {
  if (len >= full) return 10;
  if (len >= partial) return 7;
  return clamp((len / partial) * 7, 0, 7);
};

const keywordMatchScore = (title: string, keywords: string[]): number => {
  const haystack = title.toLowerCase();
  let best = 0;
  for (const keyword of keywords) {
    const phrase = keyword.toLowerCase().trim();
    if (!phrase) continue;
    if (haystack.includes(phrase)) return 10;
    const words = phrase.split(/\s+/);
    const present = words.filter((word) => haystack.includes(word)).length;
    if (present === words.length) best = Math.max(best, 7);
    else if (present > 0) best = Math.max(best, 4);
  }
  return best;
};

const uniquenessScore = (title: string, competitors: string[]): number => {
  const mine = new Set(tokenize(title));
  if (competitors.length === 0 || mine.size === 0) return 10;
  let maxOverlap = 0;
  for (const competitor of competitors) {
    const theirs = new Set(tokenize(competitor));
    const shared = [...mine].filter((token) => theirs.has(token)).length;
    maxOverlap = Math.max(maxOverlap, shared / mine.size);
  }
  return clamp((1 - maxOverlap) * 10, 0, 10);
};

const presenceShare = (fields: string, keywords: string[]): number => {
  if (keywords.length === 0) return 0;
  const haystack = fields.toLowerCase();
  const present = keywords.filter((keyword) =>
    haystack.includes(keyword.toLowerCase()),
  ).length;
  return clamp((present / keywords.length) * 10, 0, 10);
};

const ratingAverageScore = (avg: number): number => {
  if (avg >= 4.5) return clamp(9 + (avg - 4.5) / 0.5, 9, 10);
  if (avg >= 4.0) return clamp(5 + ((avg - 4.0) / 0.5) * 3, 5, 8);
  return clamp((avg / 4.0) * 4, 0, 4);
};

const trendScore = (
  delta: number | null,
  goodWhenPositive: boolean,
): number | null => {
  if (delta === null) return null;
  if (delta === 0) return 5;
  const good = goodWhenPositive ? delta > 0 : delta < 0;
  return good ? 10 : 0;
};

const bucketTexts = (
  keywords: AuditKeyword[],
  bucket: KeywordBucket,
): string[] =>
  keywords.filter((keyword) => keyword.bucket === bucket).map((k) => k.text);

const lintContext = (context: AuditContext) => ({
  titleWords: tokenize(context.title),
  subtitleWords: tokenize(context.subtitle ?? ''),
  brandTokens: context.brandTokens,
  competitorNames: context.competitorNames,
});

export const titleChecks = (context: AuditContext): AuditCheckResult[] => {
  const primary = bucketTexts(context.keywords, 'primary');
  return [
    check(
      'title-keyword',
      'Primary keyword in title',
      'auto',
      keywordMatchScore(context.title, primary),
      primary.length === 0
        ? 'No primary keywords tracked to match.'
        : 'Matched primary keywords against the title.',
    ),
    check(
      'title-char-usage',
      'Character usage',
      'auto',
      charUsageScore(
        context.title.length,
        TITLE_FULL_CHARS,
        TITLE_PARTIAL_CHARS,
      ),
      `${context.title.length} of 30 characters used.`,
    ),
    check(
      'title-lint',
      'Readability and formatting',
      'heuristic',
      lintScore(lintTitle(context.title)),
      'Checked for stuffing and special characters.',
    ),
    check(
      'title-uniqueness',
      'Distinct from competitors',
      'auto',
      uniquenessScore(context.title, context.competitorTitles),
      'Compared title tokens against competitor titles.',
    ),
  ];
};

export const subtitleChecks = (context: AuditContext): AuditCheckResult[] => {
  const subtitle = context.subtitle ?? '';
  const secondary = bucketTexts(context.keywords, 'secondary');
  return [
    check(
      'subtitle-keyword',
      'Secondary keywords present',
      'auto',
      presenceShare(subtitle, secondary),
      'Checked subtitle for secondary keywords.',
    ),
    check(
      'subtitle-no-repetition',
      'No repetition of the title',
      'heuristic',
      lintScore(lintSubtitle(subtitle, lintContext(context))),
      'Checked subtitle for repeated title words.',
    ),
    check(
      'subtitle-char-usage',
      'Character usage',
      'auto',
      charUsageScore(subtitle.length, TITLE_FULL_CHARS, TITLE_PARTIAL_CHARS),
      `${subtitle.length} of 30 characters used.`,
    ),
  ];
};

export const keywordFieldChecks = (
  context: AuditContext,
): AuditCheckResult[] | null => {
  const entries = context.keywords.filter(
    (keyword) => keyword.source === KeywordSource.KEYWORD_FIELD,
  );
  if (entries.length === 0) {
    return null;
  }
  const value = entries.map((entry) => entry.text).join(',');
  const limit = STORE_FIELD_LIMITS.APP_STORE.keywordField!.limit;
  const relevanceAvg =
    entries.reduce((sum, entry) => sum + entry.relevance, 0) / entries.length;
  return [
    check(
      'keyword-field-lint',
      'Keyword field hygiene',
      'heuristic',
      lintScore(lintKeywordField(value, lintContext(context), limit)),
      'Checked for repetition, spaces and generic words.',
    ),
    check(
      'keyword-field-char-usage',
      'Character usage',
      'auto',
      clamp((value.length / limit) * 10, 0, 10),
      `${value.length} of ${limit} characters used.`,
    ),
    check(
      'keyword-field-relevance',
      'Keyword relevance',
      'auto',
      clamp(relevanceAvg / 10, 0, 10),
      'Average relevance of keyword field entries.',
    ),
  ];
};

export const descriptionChecks = (
  context: AuditContext,
): AuditCheckResult[] => {
  const limit = STORE_FIELD_LIMITS.APP_STORE.description!.limit;
  const issues = lintDescription(context.description, limit);
  const empty = context.description.trim().length === 0;
  const has = (rule: string): boolean =>
    issues.some((issue) => issue.rule === rule);
  const binary = (present: boolean): number => (empty || present ? 0 : 10);
  return [
    check(
      'description-hook',
      'Strong opening hook',
      'heuristic',
      binary(has('weak-hook')),
      'Checked the first lines for a weak hook.',
    ),
    check(
      'description-cta',
      'Call to action',
      'heuristic',
      binary(has('no-cta')),
      'Checked for a clear call to action.',
    ),
    check(
      'description-social-proof',
      'Social proof',
      'heuristic',
      binary(has('no-social-proof')),
      'Checked for awards, press or user counts.',
    ),
    check(
      'description-formatting',
      'Readable formatting',
      'heuristic',
      binary(has('no-formatting')),
      'Checked for line breaks and bullets.',
    ),
  ];
};

export const screenshotChecks = (context: AuditContext): AuditCheckResult[] => {
  const count = context.rawFacts.screenshotCount;
  const ai = context.aiChecks;
  return [
    check(
      'screenshots-count',
      'All slots used',
      'auto',
      count === null ? null : clamp(count, 0, 10),
      count === null
        ? 'Screenshot count unavailable.'
        : `${count} of 10 slots used.`,
    ),
    aiCheck('screenshots-first-three', 'First three most compelling', ai),
    aiCheck('screenshots-text-overlays', 'Benefit-driven captions', ai),
    aiCheck('screenshots-consistent', 'Consistent design', ai),
    aiCheck('screenshots-localized', 'Localized', ai),
    aiCheck('screenshots-device-frames', 'Modern device frames', ai),
  ];
};

export const previewVideoChecks = (
  context: AuditContext,
): AuditCheckResult[] => {
  const ai = context.aiChecks;
  const hasVideo = context.rawFacts.hasVideo;
  const previewVideoExists =
    hasVideo === null
      ? aiCheck('preview-video-exists', 'Preview video exists', ai)
      : check(
          'preview-video-exists',
          'Preview video exists',
          'auto',
          hasVideo ? 10 : 0,
          hasVideo ? 'Has a preview video.' : 'Add a preview video.',
        );
  return [
    previewVideoExists,
    aiCheck('preview-video-hook', 'Hook in first 3 seconds', ai),
    aiCheck('preview-video-length', 'Optimal length', ai),
    aiCheck('preview-video-sound', 'Works without sound', ai),
  ];
};

export const ratingChecks = (context: AuditContext): AuditCheckResult[] => {
  const trend = trendScore(
    context.history.ratingCountDelta30d ?? context.history.ratingAvgDelta30d,
    true,
  );
  return [
    check(
      'ratings-average',
      'Average rating',
      'auto',
      context.ratingAvg === null ? null : ratingAverageScore(context.ratingAvg),
      context.ratingAvg === null
        ? 'No rating yet.'
        : `Average rating is ${context.ratingAvg.toFixed(2)}.`,
    ),
    check(
      'ratings-count',
      'Rating count',
      'auto',
      context.ratingCount === null
        ? null
        : logScale(context.ratingCount, 100, 1_000_000),
      context.ratingCount === null
        ? 'No ratings yet.'
        : `${context.ratingCount} ratings.`,
    ),
    check(
      'ratings-trend',
      '30 day trend',
      'auto',
      trend,
      trend === null
        ? 'No 30 day history yet.'
        : 'Compared ratings to 30 days ago.',
    ),
    aiCheck('ratings-responses', 'Responds to reviews', context.aiChecks),
    aiCheck('ratings-prompts', 'Strategic rating prompts', context.aiChecks),
  ];
};

export const iconChecks = (context: AuditContext): AuditCheckResult[] => {
  const ai = context.aiChecks;
  return [
    aiCheck('icon-distinctive', 'Distinctive', ai),
    aiCheck('icon-simple', 'Simple', ai),
    aiCheck('icon-category-fit', 'Category fit', ai),
    aiCheck('icon-no-text', 'No text', ai),
  ];
};

export const rankingChecks = (context: AuditContext): AuditCheckResult[] => {
  const { top10Share, rankedShare, avgDelta7d, gapCount } = context.rankings;
  return [
    check(
      'rankings-top10',
      'Top 10 presence',
      'auto',
      clamp(top10Share * 10, 0, 10),
      `${Math.round(top10Share * 100)}% of keywords in the top 10.`,
    ),
    check(
      'rankings-coverage',
      'Keyword coverage',
      'auto',
      clamp(rankedShare * 10, 0, 10),
      `${Math.round(rankedShare * 100)}% of keywords ranked.`,
    ),
    check(
      'rankings-trend',
      'Ranking trend',
      'auto',
      trendScore(avgDelta7d, false),
      avgDelta7d === null
        ? 'No 7 day trend yet.'
        : 'Average 7 day position change.',
    ),
    check(
      'rankings-gap',
      'Competitor gap',
      'auto',
      clamp(10 - gapCount, 0, 10),
      `${gapCount} keywords where competitors lead.`,
    ),
  ];
};

export const conversionChecks = (context: AuditContext): AuditCheckResult[] => {
  const hasNotes = Boolean(context.rawFacts.releaseNotes);
  const fresh =
    context.storeUpdatedAt !== null &&
    context.now.getTime() - context.storeUpdatedAt.getTime() <=
      FRESH_DAYS * DAY_MS;
  const freshnessScore = (hasNotes ? 5 : 0) + (fresh ? 5 : 0);
  return [
    check(
      'conversion-freshness',
      "What's New freshness",
      'auto',
      freshnessScore,
      `Release notes ${hasNotes ? 'present' : 'missing'}, updated ${
        fresh ? 'recently' : 'over 30 days ago'
      }.`,
    ),
    aiCheck('conversion-promo', 'Promotional text', context.aiChecks),
    aiCheck('conversion-events', 'In-app events', context.aiChecks),
    aiCheck('conversion-cpp', 'Custom product pages', context.aiChecks),
  ];
};
