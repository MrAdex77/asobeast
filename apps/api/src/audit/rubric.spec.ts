import { AUDIT_WEIGHTS, computeAudit } from './rubric';
import {
  AuditContext,
  AuditKeyword,
  previewVideoChecks,
  ratingChecks,
  titleChecks,
} from './audit-checks';

const emptyFacts = {
  screenshotCount: null,
  ipadScreenshotCount: null,
  genres: [],
  releaseNotes: null,
  languages: [],
  contentRating: null,
  genreKey: null,
  genreName: null,
  hasVideo: null,
};

const NOW = new Date('2026-07-09T00:00:00.000Z');

const emptyContext = (): AuditContext => ({
  appId: 'app1',
  store: 'APP_STORE',
  title: '',
  subtitle: null,
  description: '',
  ratingAvg: null,
  ratingCount: null,
  storeUpdatedAt: null,
  now: NOW,
  rawFacts: { ...emptyFacts },
  keywords: [],
  rankings: { top10Share: 0, rankedShare: 0, avgDelta7d: null, gapCount: 10 },
  history: { ratingAvgDelta30d: null, ratingCountDelta30d: null },
  competitorTitles: [],
  competitorNames: [],
  brandTokens: [],
  answers: {},
});

const keywordFieldEntries: AuditKeyword[] = [
  'meditation',
  'mindfulness',
  'relaxation',
  'breathing',
  'wellness',
  'journal',
  'gratitude',
  'motivation',
  'calmness',
  'focusflow',
].map((text) => ({
  text,
  source: 'KEYWORD_FIELD',
  bucket: 'longtail',
  relevance: 100,
  position: 1,
}));

const perfectContext = (): AuditContext => ({
  appId: 'app1',
  store: 'APP_STORE',
  title: 'Habit Tracker: Daily Streaks',
  subtitle: 'Streak Counter and Reminders',
  description:
    'Track your habits and reach your goals.\n• Loved by 2 million users. Download now to start today.',
  ratingAvg: 5,
  ratingCount: 1_000_000,
  storeUpdatedAt: NOW,
  now: NOW,
  rawFacts: {
    ...emptyFacts,
    screenshotCount: 10,
    releaseNotes: 'New reminders and widgets.',
  },
  keywords: [
    {
      text: 'habit tracker',
      source: 'TITLE',
      bucket: 'primary',
      relevance: 100,
      position: 1,
    },
    {
      text: 'streak counter',
      source: 'SUBTITLE',
      bucket: 'secondary',
      relevance: 90,
      position: 3,
    },
    ...keywordFieldEntries,
  ],
  rankings: { top10Share: 1, rankedShare: 1, avgDelta7d: -1, gapCount: 0 },
  history: { ratingAvgDelta30d: 0.1, ratingCountDelta30d: 100 },
  competitorTitles: [],
  competitorNames: [],
  brandTokens: [],
  answers: {
    screenshotsFirst3Compelling: true,
    screenshotsTextOverlays: true,
    screenshotsConsistent: true,
    screenshotsLocalized: true,
    screenshotsDeviceFrames: true,
    previewVideoExists: true,
    previewVideoHook: true,
    previewVideoLength: true,
    previewVideoWorksWithoutSound: true,
    reviewResponses: true,
    ratingPrompts: true,
    iconDistinctive: true,
    iconSimple: true,
    iconCategoryFit: true,
    iconNoText: true,
    promotionalText: true,
    inAppEvents: true,
    customProductPages: true,
  },
});

describe('AUDIT_WEIGHTS', () => {
  it('matches the ported factor weights', () => {
    const ios = AUDIT_WEIGHTS.APP_STORE;
    expect(ios).toMatchObject({
      title: 20,
      subtitle: 15,
      keywordField: 15,
      description: 5,
      screenshots: 15,
      previewVideo: 5,
      ratings: 15,
      icon: 5,
      rankings: 10,
      conversion: 5,
    });
    const iosSum = Object.values(ios).reduce((a, b) => a + b, 0);
    const androidSum = Object.values(AUDIT_WEIGHTS.GOOGLE_PLAY).reduce(
      (a, b) => a + b,
      0,
    );
    expect(iosSum).toBe(110);
    expect(androidSum).toBe(90);
  });
});

describe('computeAudit', () => {
  it('scores a perfect listing 100 with full coverage', () => {
    const result = computeAudit(perfectContext());
    expect(result.overall).toBe(100);
    expect(result.coveredWeight).toBe(110);
    expect(result.totalWeight).toBe(110);
    expect(result.factors.every((factor) => factor.score === 10)).toBe(true);
    expect(result.factors.some((factor) => factor.needsInput)).toBe(false);
  });

  it('scores an empty listing near zero and renormalizes over covered weight', () => {
    const result = computeAudit(emptyContext());
    expect(result.overall).not.toBeNull();
    expect(result.overall as number).toBeLessThan(35);
    expect(result.coveredWeight).toBe(55);
    expect(result.totalWeight).toBe(110);
  });

  it('marks factors with no resolvable checks as needsInput', () => {
    const result = computeAudit(emptyContext());
    const keywordField = result.factors.find((f) => f.id === 'keywordField');
    const ratings = result.factors.find((f) => f.id === 'ratings');
    expect(keywordField?.needsInput).toBe(true);
    expect(keywordField?.score).toBeNull();
    expect(ratings?.needsInput).toBe(true);
  });

  it('produces recommendations for failing checks', () => {
    const result = computeAudit(emptyContext());
    const all = [
      ...result.recommendations.quickWins,
      ...result.recommendations.highImpact,
      ...result.recommendations.strategic,
    ];
    expect(all.length).toBeGreaterThan(0);
    expect(
      result.recommendations.quickWins.some((r) => r.factorId === 'title'),
    ).toBe(true);
  });
});

describe('factor bands', () => {
  const withContext = (overrides: Partial<AuditContext>): AuditContext => ({
    ...emptyContext(),
    ...overrides,
  });

  it('scores an exact title phrase match higher than a partial match', () => {
    const primary: AuditKeyword = {
      text: 'habit tracker',
      source: 'TITLE',
      bucket: 'primary',
      relevance: 100,
      position: 1,
    };
    const phrase = titleChecks(
      withContext({ title: 'Habit Tracker Pro', keywords: [primary] }),
    ).find((c) => c.id === 'title-keyword');
    const partial = titleChecks(
      withContext({ title: 'Habit Builder', keywords: [primary] }),
    ).find((c) => c.id === 'title-keyword');
    expect(phrase?.score).toBe(10);
    expect(partial?.score).toBe(4);
  });

  it('maps rating averages onto the skill bands', () => {
    const scoreFor = (avg: number) =>
      ratingChecks(withContext({ ratingAvg: avg })).find(
        (c) => c.id === 'ratings-average',
      )?.score ?? 0;
    expect(scoreFor(4.8)).toBeGreaterThanOrEqual(9);
    expect(scoreFor(4.2)).toBeGreaterThanOrEqual(5);
    expect(scoreFor(4.2)).toBeLessThanOrEqual(8);
    expect(scoreFor(3.5)).toBeLessThanOrEqual(4);
  });

  const previewExists = (context: AuditContext) =>
    previewVideoChecks(context).find((c) => c.id === 'preview-video-exists');

  it('scores the preview video from data when hasVideo is known', () => {
    const present = previewExists(
      withContext({ rawFacts: { ...emptyFacts, hasVideo: true } }),
    );
    const absent = previewExists(
      withContext({ rawFacts: { ...emptyFacts, hasVideo: false } }),
    );
    expect(present?.kind).toBe('auto');
    expect(present?.score).toBe(10);
    expect(absent?.kind).toBe('auto');
    expect(absent?.score).toBe(0);
  });

  it('falls back to the manual answer when hasVideo is null', () => {
    const answered = previewExists(
      withContext({
        rawFacts: { ...emptyFacts, hasVideo: null },
        answers: { previewVideoExists: true },
      }),
    );
    const unanswered = previewExists(
      withContext({ rawFacts: { ...emptyFacts, hasVideo: null } }),
    );
    expect(answered?.kind).toBe('manual');
    expect(answered?.score).toBe(10);
    expect(unanswered?.score).toBeNull();
  });
});
