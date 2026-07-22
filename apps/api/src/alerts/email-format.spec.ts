import {
  DigestWeeklyPayload,
  MetadataChangedPayload,
  RankDroppedPayload,
  RankImprovedPayload,
  ReviewNegativePayload,
} from '@asobeast/shared';
import { formatEmail } from './email-format';

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
