import {
  MetadataChangedPayload,
  RankDroppedPayload,
  RankImprovedPayload,
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
});

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
});
