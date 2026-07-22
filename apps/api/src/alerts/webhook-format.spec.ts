import {
  DigestWeeklyPayload,
  MetadataChangedPayload,
  RankDroppedPayload,
  RankImprovedPayload,
  ReviewNegativePayload,
} from '@asobeast/shared';
import { formatWebhookBody, renderMessage } from './webhook-format';

const metadata: MetadataChangedPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App', isCompetitor: false },
  changes: [
    { field: 'title', before: 'A', after: 'B' },
    { field: 'icon', before: 'x', after: 'y' },
  ],
};

const dropped: RankDroppedPayload = {
  event: 'rank.dropped',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App' },
  keyword: { id: 'kw_1', text: 'habit tracker' },
  from: 3,
  to: null,
  threshold: 5,
};

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
    text: 'Crashes on launch',
    version: '2.0.0',
    reviewedAt: '2026-07-10T00:00:00.000Z',
  },
};

describe('renderMessage', () => {
  it('summarizes a metadata change with the changed fields', () => {
    expect(renderMessage(metadata)).toBe('📝 My App changed: title, icon');
  });

  it('marks competitor metadata changes', () => {
    expect(
      renderMessage({
        ...metadata,
        app: { ...metadata.app, isCompetitor: true },
      }),
    ).toBe('📝 My App (competitor) changed: title, icon');
  });

  it('describes a drop out of the top 100', () => {
    expect(renderMessage(dropped)).toBe(
      '📉 My App dropped for "habit tracker": #3 → outside top 100',
    );
  });

  it('describes an improvement', () => {
    expect(renderMessage(improved)).toBe(
      '📈 My App improved for "habit tracker": #20 → #7',
    );
  });

  it('describes a negative review with stars and version', () => {
    expect(renderMessage(negative)).toBe(
      '⚠️ My App got a ★☆☆☆☆ review (v2.0.0): "Crashes on launch"',
    );
  });
});

const digest: DigestWeeklyPayload = {
  event: 'digest.weekly',
  occurredAt: '2026-07-13T08:00:00.000Z',
  window: { from: '2026-07-06', to: '2026-07-13' },
  apps: Array.from({ length: 12 }, (_, i) => ({
    id: `app_${i}`,
    name: `App ${i}`,
    visibility: { current: 40 + i, delta7d: i % 2 === 0 ? 2.5 : null },
    moversUp: [{ keywordId: `k${i}`, text: `up ${i}`, from: 20, to: 4 }],
    moversDown: [{ keywordId: `d${i}`, text: `down ${i}`, from: 5, to: 12 }],
    changes: i,
    negativeReviews: 1,
    audit: null,
  })),
  groups: [],
};

describe('formatWebhookBody', () => {
  it('wraps the message in a content field for discord', () => {
    const body = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      metadata,
    );
    expect(JSON.parse(body)).toEqual({ content: renderMessage(metadata) });
  });

  it('wraps the message in a text field for slack', () => {
    const body = formatWebhookBody(
      'https://hooks.slack.com/services/T/B/x',
      metadata,
    );
    expect(JSON.parse(body)).toEqual({ text: renderMessage(metadata) });
  });

  it('sends the raw payload for generic receivers', () => {
    const body = formatWebhookBody('https://hooks.example.com/x', metadata);
    expect(JSON.parse(body)).toEqual(metadata);
  });

  it('formats a negative review for discord', () => {
    const body = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      negative,
    );
    expect(JSON.parse(body)).toEqual({ content: renderMessage(negative) });
  });

  it('formats a negative review for slack', () => {
    const body = formatWebhookBody(
      'https://hooks.slack.com/services/T/B/x',
      negative,
    );
    expect(JSON.parse(body)).toEqual({ text: renderMessage(negative) });
  });

  it('builds a discord embed truncated to the top 10 apps', () => {
    const body = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      digest,
    );
    const parsed = JSON.parse(body) as {
      embeds: { title: string; description: string }[];
    };
    const lines = parsed.embeds[0].description.split('\n');

    expect(parsed.embeds).toHaveLength(1);
    expect(parsed.embeds[0].title).toContain('2026-07-06 → 2026-07-13');
    expect(lines).toHaveLength(11);
    expect(lines[lines.length - 1]).toBe('+2 more');
    expect(lines[0]).toContain('App 0 — vis 40 (+2.5)');
    expect(lines[1]).toContain('App 1 — vis 41 (—)');
    expect(body.length).toBeLessThan(6000);
  });

  it('builds slack blocks truncated to the top 10 apps', () => {
    const body = formatWebhookBody(
      'https://hooks.slack.com/services/T/B/x',
      digest,
    );
    const parsed = JSON.parse(body) as {
      blocks: Array<{ type: string; text: { text: string } }>;
    };
    const section = parsed.blocks.find((block) => block.type === 'section')!;
    const lines = section.text.text.split('\n');

    expect(parsed.blocks[0].type).toBe('header');
    expect(lines).toHaveLength(11);
    expect(lines[lines.length - 1]).toBe('+2 more');
  });

  it('sends the raw digest payload for generic receivers', () => {
    const body = formatWebhookBody('https://hooks.example.com/x', digest);
    expect(JSON.parse(body)).toEqual(digest);
  });
});
