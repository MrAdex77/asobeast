import {
  MetadataChangedPayload,
  RankDroppedPayload,
  ReviewNegativePayload,
  SerpEntrantPayload,
} from '@asobeast/shared';
import { outboxRows } from './outbox-rows';

describe('outboxRows', () => {
  it('splits a multi-field metadata change into one row per field', () => {
    const payload: MetadataChangedPayload = {
      event: 'metadata.changed',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: 'app1', name: 'App One', isCompetitor: false },
      changes: [
        { field: 'title', before: 'a', after: 'b' },
        { field: 'subtitle', before: 'c', after: 'd' },
      ],
    };

    const rows = outboxRows(payload);

    expect(rows).toHaveLength(2);
    expect(rows[0].dedupeKey).toBe('change:app1:title:2026-07-22');
    expect(rows[1].dedupeKey).toBe('change:app1:subtitle:2026-07-22');
    expect((rows[0].payload as MetadataChangedPayload).changes).toHaveLength(1);
    expect(rows[0].appId).toBe('app1');
  });

  it('keys a rank alert by app, keyword and day', () => {
    const payload: RankDroppedPayload = {
      event: 'rank.dropped',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: 'app1', name: 'App One' },
      keyword: { id: 'kw1', text: 'game' },
      from: 3,
      to: 12,
      threshold: 5,
    };

    const [row] = outboxRows(payload);

    expect(row.dedupeKey).toBe('rank:app1:kw1:2026-07-22');
    expect(row.appId).toBe('app1');
  });

  it('keys a serp entrant by keyword and its date, with no app', () => {
    const payload: SerpEntrantPayload = {
      event: 'serp.entrant',
      occurredAt: '2026-07-22T10:00:00.000Z',
      keyword: { id: 'kw1', text: 'game' },
      date: '2026-07-22',
      entrants: [],
    };

    const [row] = outboxRows(payload);

    expect(row.dedupeKey).toBe('entrant:kw1:2026-07-22');
    expect(row.appId).toBeNull();
  });

  it('fingerprints a review so distinct reviews do not collide', () => {
    const base: ReviewNegativePayload = {
      event: 'review.negative',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: 'app1', name: 'App One' },
      review: {
        score: 1,
        title: 'Bad',
        text: 'crashes',
        version: '1.0',
        reviewedAt: '2026-07-22T09:00:00.000Z',
      },
    };
    const other: ReviewNegativePayload = {
      ...base,
      review: { ...base.review, text: 'freezes' },
    };

    expect(outboxRows(base)[0].dedupeKey).not.toBe(
      outboxRows(other)[0].dedupeKey,
    );
    expect(outboxRows(base)[0].dedupeKey).toBe(outboxRows(base)[0].dedupeKey);
  });
});
