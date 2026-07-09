import { extractAppStoreRawFacts } from './raw-facts';

const realPayload = {
  id: 1234567890,
  title: 'Habit Tracker: Daily Goals',
  description: 'Build better habits every day.',
  icon: 'https://example.com/icon.png',
  genres: ['Health & Fitness', 'Productivity'],
  genreIds: ['6013', '6007'],
  primaryGenre: 'Health & Fitness',
  contentRating: '4+',
  languages: ['EN', 'ES', 'FR'],
  releaseNotes: 'Bug fixes and performance improvements.',
  version: '2.4.1',
  screenshots: ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'],
  ipadScreenshots: ['ipad-a.png', 'ipad-b.png'],
  appletvScreenshots: [],
};

describe('extractAppStoreRawFacts', () => {
  it('extracts facts from a real payload shape', () => {
    expect(extractAppStoreRawFacts(realPayload)).toEqual({
      screenshotCount: 5,
      ipadScreenshotCount: 2,
      genres: ['Health & Fitness', 'Productivity'],
      releaseNotes: 'Bug fixes and performance improvements.',
      languages: ['EN', 'ES', 'FR'],
      contentRating: '4+',
    });
  });

  it('returns empty facts for garbage without throwing', () => {
    for (const garbage of [null, undefined, 42, 'nope', [], {}]) {
      expect(() => extractAppStoreRawFacts(garbage)).not.toThrow();
    }
    expect(extractAppStoreRawFacts({})).toEqual({
      screenshotCount: null,
      ipadScreenshotCount: null,
      genres: [],
      releaseNotes: null,
      languages: [],
      contentRating: null,
    });
  });

  it('ignores non-string array entries and blank strings', () => {
    const facts = extractAppStoreRawFacts({
      genres: ['Games', 42, null],
      languages: 'EN',
      releaseNotes: '   ',
      screenshots: 'not-an-array',
    });
    expect(facts.genres).toEqual(['Games']);
    expect(facts.languages).toEqual([]);
    expect(facts.releaseNotes).toBeNull();
    expect(facts.screenshotCount).toBeNull();
  });
});
