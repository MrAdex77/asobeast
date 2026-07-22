import { ConflictException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { AiClient } from '../ai/openai.client';
import {
  AiAuditInput,
  AuditAiService,
  buildAuditContent,
  validateAuditChecks,
} from './audit-ai.service';

const baseInput = (overrides: Partial<AiAuditInput> = {}): AiAuditInput => ({
  store: Store.APP_STORE,
  title: 'Habit Tracker',
  subtitle: 'Daily Streaks',
  summary: null,
  description: 'Build better habits every day.',
  genreName: 'Productivity',
  languages: ['EN'],
  releaseNotes: 'Bug fixes.',
  hasVideo: null,
  ratingAvg: 4.5,
  ratingCount: 100,
  iconUrl: null,
  screenshotUrls: [],
  ...overrides,
});

describe('validateAuditChecks', () => {
  it('keeps known ids, clamps scores, dedupes and defaults blank detail', () => {
    const out = validateAuditChecks({
      checks: [
        { id: 'icon-simple', score: -3, detail: '  Clean.  ' },
        { id: 'icon-simple', score: 9, detail: 'duplicate ignored' },
        { id: 'screenshots-consistent', score: 12, detail: 'Great.' },
        { id: 'not-a-real-check', score: 5, detail: 'dropped' },
        { id: 'icon-no-text', score: 4.6, detail: '' },
        'garbage',
      ],
    });
    expect(out).toEqual({
      'icon-simple': { score: 0, detail: 'Clean.' },
      'screenshots-consistent': { score: 10, detail: 'Great.' },
      'icon-no-text': { score: 5, detail: 'No rationale provided.' },
    });
  });

  it('tolerates non-object input without throwing', () => {
    expect(validateAuditChecks(null)).toEqual({});
    expect(validateAuditChecks({ checks: 'nope' })).toEqual({});
    expect(validateAuditChecks(42)).toEqual({});
  });
});

describe('buildAuditContent', () => {
  it('emits a text block then the icon and up to six screenshots', () => {
    const parts = buildAuditContent(
      baseInput({
        iconUrl: 'https://cdn/icon.png',
        screenshotUrls: Array.from(
          { length: 8 },
          (_, i) => `https://cdn/s${i}`,
        ),
      }),
    );
    expect(parts[0].type).toBe('text');
    const images = parts.filter((part) => part.type === 'image');
    expect(images).toHaveLength(7);
    expect(images[0]).toEqual({ type: 'image', url: 'https://cdn/icon.png' });
  });

  it('omits image parts when no creative is available', () => {
    const parts = buildAuditContent(baseInput());
    expect(parts.every((part) => part.type === 'text')).toBe(true);
  });
});

describe('AuditAiService', () => {
  it('rejects when no client is configured', async () => {
    const service = new AuditAiService(null);
    expect(service.configured).toBe(false);
    await expect(service.generate(baseInput())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('sends the creative and returns validated checks', async () => {
    const structured = jest.fn().mockResolvedValue({
      checks: [
        { id: 'icon-simple', score: 9, detail: 'Clean.' },
        { id: 'screenshots-consistent', score: 12, detail: 'Cohesive.' },
      ],
    });
    const client: AiClient = { model: 'gpt-4o', structured };
    const service = new AuditAiService(client);

    const result = await service.generate(
      baseInput({
        iconUrl: 'https://cdn/icon.png',
        screenshotUrls: ['https://cdn/s0', 'https://cdn/s1'],
      }),
    );

    expect(service.configured).toBe(true);
    expect(service.model).toBe('gpt-4o');
    expect(result).toEqual({
      'icon-simple': { score: 9, detail: 'Clean.' },
      'screenshots-consistent': { score: 10, detail: 'Cohesive.' },
    });
    const calls = structured.mock.calls as Array<
      [{ content: Array<{ type: string; url?: string }> }]
    >;
    const imageUrls = calls[0][0].content
      .filter((part) => part.type === 'image')
      .map((part) => part.url);
    expect(imageUrls).toEqual([
      'https://cdn/icon.png',
      'https://cdn/s0',
      'https://cdn/s1',
    ]);
  });
});
