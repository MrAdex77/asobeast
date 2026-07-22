import {
  MetadataChangedPayload,
  RankDroppedPayload,
  ReviewNegativePayload,
  SerpEntrantPayload,
} from '@asobeast/shared';
import {
  assembleBatch,
  filterBatch,
  OutboxEvent,
  ResolvedApp,
} from './alert-batch';

const primaryA: ResolvedApp = {
  id: 'a',
  name: 'Alpha',
  store: 'APP_STORE',
  country: 'us',
  isCompetitor: false,
  primaryAppId: null,
};
const primaryB: ResolvedApp = {
  id: 'b',
  name: 'Bravo',
  store: 'GOOGLE_PLAY',
  country: 'gb',
  isCompetitor: false,
  primaryAppId: null,
};
const competitor: ResolvedApp = {
  id: 'c',
  name: 'Charlie',
  store: 'APP_STORE',
  country: 'us',
  isCompetitor: true,
  primaryAppId: 'a',
};

const rank: RankDroppedPayload = {
  event: 'rank.dropped',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'b', name: 'Bravo' },
  keyword: { id: 'kw1', text: 'game' },
  from: 3,
  to: 12,
  threshold: 5,
};
const review: ReviewNegativePayload = {
  event: 'review.negative',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'a', name: 'Alpha' },
  review: {
    score: 1,
    title: null,
    text: 'bad',
    version: '1.0',
    reviewedAt: null,
  },
};
const competitorChange: MetadataChangedPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'c', name: 'Charlie', isCompetitor: true },
  changes: [{ field: 'title', before: 'x', after: 'y' }],
};
const entrant: SerpEntrantPayload = {
  event: 'serp.entrant',
  occurredAt: '2026-07-22T10:00:00.000Z',
  keyword: { id: 'kw1', text: 'game' },
  date: '2026-07-22',
  entrants: [],
};

const event = (
  payload: OutboxEvent['payload'],
  appId: string | null,
): OutboxEvent => ({
  event: payload.event,
  appId,
  payload,
  createdAt: new Date('2026-07-22T09:00:00.000Z'),
});

const appById = new Map<string, ResolvedApp>([
  ['a', primaryA],
  ['b', primaryB],
  ['c', competitor],
]);

describe('assembleBatch', () => {
  it('groups events by primary app and nests competitor activity', () => {
    const batch = assembleBatch({
      events: [
        event(rank, 'b'),
        event(review, 'a'),
        event(competitorChange, 'c'),
        event(entrant, null),
      ],
      appById,
      serpPrimariesByKeyword: new Map([['kw1', ['b']]]),
      now: new Date('2026-07-22T11:00:00.000Z'),
    });

    expect(batch.event).toBe('alerts.batch');
    expect(batch.totals).toEqual({ events: 4, apps: 2 });
    expect(batch.window).toEqual({
      from: '2026-07-22T09:00:00.000Z',
      to: '2026-07-22T11:00:00.000Z',
    });
    expect(batch.apps.map((a) => a.app.id)).toEqual(['a', 'b']);

    const alpha = batch.apps[0];
    expect(alpha.negativeReviews).toHaveLength(1);
    expect(alpha.competitors).toHaveLength(1);
    expect(alpha.competitors[0].app.id).toBe('c');
    expect(alpha.competitors[0].changes).toHaveLength(1);

    const bravo = batch.apps[1];
    expect(bravo.rankDrops).toHaveLength(1);
    expect(bravo.serpEntrants).toHaveLength(1);
  });

  it('drops events whose app cannot be resolved', () => {
    const batch = assembleBatch({
      events: [event(rank, 'b')],
      appById: new Map(),
      serpPrimariesByKeyword: new Map(),
      now: new Date('2026-07-22T11:00:00.000Z'),
    });
    expect(batch.apps).toHaveLength(0);
    expect(batch.events).toHaveLength(1);
  });
});

describe('filterBatch', () => {
  const batch = assembleBatch({
    events: [
      event(rank, 'b'),
      event(review, 'a'),
      event(competitorChange, 'c'),
    ],
    appById,
    serpPrimariesByKeyword: new Map(),
    now: new Date('2026-07-22T11:00:00.000Z'),
  });

  it('keeps only subscribed event types and prunes empty sections', () => {
    const filtered = filterBatch(batch, new Set(['rank.dropped']));

    expect(filtered.events).toHaveLength(1);
    expect(filtered.apps.map((a) => a.app.id)).toEqual(['b']);
    expect(filtered.apps[0].negativeReviews).toHaveLength(0);
    expect(filtered.totals).toEqual({ events: 1, apps: 1 });
  });

  it('drops competitor activity when metadata is not subscribed', () => {
    const filtered = filterBatch(batch, new Set(['review.negative']));

    expect(filtered.apps.map((a) => a.app.id)).toEqual(['a']);
    expect(filtered.apps[0].competitors).toHaveLength(0);
  });
});
