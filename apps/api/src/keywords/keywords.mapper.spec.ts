import { toTrackedKeywordItem, TrackedKeywordRow } from './keywords.mapper';

const row = (
  overrides: Partial<TrackedKeywordRow> = {},
): TrackedKeywordRow => ({
  keywordId: 'k1',
  source: 'COMPETITOR',
  active: true,
  relevance: null,
  keyword: {
    text: 'habit tracker',
    rankings: [],
    metrics: [{ traffic: 8, difficulty: 4, date: new Date('2026-07-01') }],
  },
  ...overrides,
});

describe('toTrackedKeywordItem', () => {
  it('derives volume, difficulty and a default relevance', () => {
    const item = toTrackedKeywordItem(row(), 'daily habit tracker');
    expect(item.volume).toBeCloseTo(80, 2);
    expect(item.relevance).toBe(60);
    expect(item.opportunity).toBeCloseTo(80 * 0.4 + 60 * 0.3 + 60 * 0.3, 1);
  });

  it('lets a manual relevance override beat the default', () => {
    const item = toTrackedKeywordItem(
      row({ relevance: 95 }),
      'daily habit tracker',
    );
    expect(item.relevance).toBe(95);
  });

  it('returns a null opportunity for unscored keywords', () => {
    const item = toTrackedKeywordItem(
      row({ keyword: { text: 'habit tracker', rankings: [], metrics: [] } }),
      '',
    );
    expect(item.volume).toBeNull();
    expect(item.opportunity).toBeNull();
  });
});
