import {
  AlertBatchAppSection,
  AlertBatchPayload,
  DigestWeeklyPayload,
  MetadataChangedPayload,
  RankDroppedPayload,
  RankImprovedPayload,
  ReviewNegativePayload,
} from '@asobeast/shared';
import { formatBatchEmail, formatEmail } from './email-format';

const metadata: MetadataChangedPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App', isCompetitor: false },
  changes: [
    { field: 'title', before: 'A', after: 'B' },
    { field: 'icon', before: null, after: 'y' },
  ],
};

const dropped: RankDroppedPayload = {
  event: 'rank.dropped',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App' },
  keyword: { id: 'kw_1', text: 'fitness app' },
  from: 4,
  to: 12,
  threshold: 5,
};

const droppedOut: RankDroppedPayload = { ...dropped, from: 3, to: null };

const improved: RankImprovedPayload = {
  event: 'rank.improved',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App' },
  keyword: { id: 'kw_1', text: 'habit tracker' },
  from: 20,
  to: 7,
  threshold: 5,
};

const negative: ReviewNegativePayload = {
  event: 'review.negative',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App' },
  review: {
    score: 1,
    title: 'Bad',
    text: 'Crashes on <launch>',
    version: '2.0.0',
    reviewedAt: '2026-07-10T00:00:00.000Z',
  },
};

const digest: DigestWeeklyPayload = {
  event: 'digest.weekly',
  occurredAt: '2026-07-13T08:00:00.000Z',
  window: { from: '2026-07-06', to: '2026-07-13' },
  apps: Array.from({ length: 12 }, (_, i) => ({
    id: `app_${i}`,
    name: `App ${i}`,
    visibility: { current: 40 + i, delta7d: i % 2 === 0 ? 2.5 : null },
    moversUp: [],
    moversDown: [],
    changes: i,
    negativeReviews: null,
    audit: i === 0 ? { current: 78, delta7d: 3 } : null,
  })),
  groups: [],
};

const digestWithGroups: DigestWeeklyPayload = {
  ...digest,
  groups: [
    {
      id: 'grp_1',
      name: 'Habit',
      visibility: { current: 61.4, delta7d: -2.5 },
    },
  ],
};

describe('formatEmail', () => {
  it('subjects a rank drop with bare positions', () => {
    const email = formatEmail(dropped);
    expect(email.subject).toBe('[asobeast] Rank drop: "fitness app" 4 → 12');
    expect(email.text).toContain('From: 4');
    expect(email.text).toContain('To: 12');
    expect(email.html).toContain('<table');
  });

  it('renders a drop out of the top 100 as >100', () => {
    expect(formatEmail(droppedOut).subject).toBe(
      '[asobeast] Rank drop: "fitness app" 3 → >100',
    );
  });

  it('subjects a rank improvement', () => {
    expect(formatEmail(improved).subject).toBe(
      '[asobeast] Rank up: "habit tracker" 20 → 7',
    );
  });

  it('lists the changed fields for a metadata change', () => {
    const email = formatEmail(metadata);
    expect(email.subject).toBe('[asobeast] My App changed title, icon');
    expect(email.text).toContain('title: A → B');
    expect(email.text).toContain('icon: — → y');
  });

  it('renders stars and version for a negative review', () => {
    const email = formatEmail(negative);
    expect(email.subject).toBe('[asobeast] ★☆☆☆☆ review (v2.0.0) for My App');
    expect(email.text).toContain('Crashes on <launch>');
  });

  it('escapes html in review content', () => {
    expect(formatEmail(negative).html).toContain('Crashes on &lt;launch&gt;');
  });

  it('caps the weekly digest at ten apps with a more line', () => {
    const email = formatEmail(digest);
    expect(email.subject).toBe('[asobeast] Weekly digest: 12 apps');
    expect(email.text).toContain('+2 more');
    expect(email.text).toContain('Window: 2026-07-06 → 2026-07-13');
  });

  it('omits the linked apps section when the digest has no groups', () => {
    expect(formatEmail(digest).text).not.toContain('Linked apps');
  });

  it('appends the audit score and delta to the app line', () => {
    expect(formatEmail(digest).text).toContain('Audit 78 (+3)');
  });

  it('renders linked apps before the per-app lines', () => {
    const { text } = formatEmail(digestWithGroups);
    expect(text).toContain('Linked apps');
    expect(text).toContain('Habit: vis 61 (-2.5)');
    expect(text.indexOf('Linked apps')).toBeLessThan(text.indexOf('App 0:'));
  });
});

const emptySection = (
  app: AlertBatchAppSection['app'],
): AlertBatchAppSection => ({
  app,
  rankDrops: [],
  rankImprovements: [],
  serpEntrants: [],
  changes: [],
  negativeReviews: [],
  competitors: [],
});

const alpha: AlertBatchAppSection = {
  ...emptySection({
    id: 'a',
    name: 'Alpha',
    store: 'APP_STORE',
    country: 'us',
  }),
  rankDrops: [
    {
      event: 'rank.dropped',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: 'a', name: 'Alpha' },
      keyword: { id: 'k1', text: 'game' },
      from: 3,
      to: 12,
      threshold: 5,
    },
  ],
  changes: [
    {
      event: 'metadata.changed',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: 'a', name: 'Alpha', isCompetitor: false },
      changes: [{ field: 'title', before: 'x'.repeat(200), after: 'short' }],
    },
  ],
  competitors: [
    {
      app: { id: 'c', name: 'Charlie', store: 'APP_STORE', country: 'us' },
      changes: [
        {
          event: 'metadata.changed',
          occurredAt: '2026-07-22T10:00:00.000Z',
          app: { id: 'c', name: 'Charlie', isCompetitor: true },
          changes: [{ field: 'subtitle', before: 'a', after: 'b' }],
        },
      ],
    },
  ],
};

const bravo: AlertBatchAppSection = {
  ...emptySection({
    id: 'b',
    name: 'Bravo',
    store: 'GOOGLE_PLAY',
    country: 'gb',
  }),
  serpEntrants: [
    {
      event: 'serp.entrant',
      occurredAt: '2026-07-22T10:00:00.000Z',
      keyword: { id: 'k2', text: 'planner' },
      date: '2026-07-22',
      entrants: [
        {
          position: 4,
          storeAppId: 'x',
          title: 'Newcomer',
          appId: null,
          isCompetitor: false,
        },
      ],
    },
  ],
};

const batch: AlertBatchPayload = {
  event: 'alerts.batch',
  occurredAt: '2026-07-22T11:00:00.000Z',
  window: { from: '2026-07-22T09:00:00.000Z', to: '2026-07-22T11:00:00.000Z' },
  totals: { events: 4, apps: 2 },
  apps: [alpha, bravo],
  events: [],
};

describe('formatBatchEmail', () => {
  it('counts each category in the subject with plurals', () => {
    const email = formatBatchEmail(batch);
    expect(email.subject).toBe(
      '[asobeast] 1 rank drop, 1 entrant, 1 metadata change, 1 competitor change across 2 apps',
    );
  });

  it('uses plural app wording for multiple apps and singular otherwise', () => {
    const single = formatBatchEmail({
      ...batch,
      apps: [bravo],
      totals: { events: 1, apps: 1 },
    });
    expect(single.subject).toBe('[asobeast] 1 entrant across 1 app');
  });

  it('omits empty sections from the rendered card', () => {
    const email = formatBatchEmail(batch);
    expect(email.text).toContain('Rank drops');
    expect(email.text).not.toContain('Rank improvements');
    expect(email.text).toContain('New entrants');
  });

  it('nests competitor activity under the primary app', () => {
    const email = formatBatchEmail(batch);
    expect(email.text).toContain('Competitor activity — Charlie · App Store');
    expect(email.html).toContain('Competitor · Charlie · App Store');
  });

  it('truncates long metadata values', () => {
    const email = formatBatchEmail(batch);
    expect(email.text).toContain('…');
    expect(email.text).not.toContain('x'.repeat(200));
  });

  it('labels each app with its store and country', () => {
    const email = formatBatchEmail(batch);
    expect(email.text).toContain('Alpha · App Store · US');
    expect(email.text).toContain('Bravo · Google Play · GB');
  });
});
