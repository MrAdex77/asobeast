export interface RawAppFacts {
  screenshotCount: number | null;
  ipadScreenshotCount: number | null;
  genres: string[];
  releaseNotes: string | null;
  languages: string[];
  contentRating: string | null;
}

const EMPTY_FACTS: RawAppFacts = {
  screenshotCount: null,
  ipadScreenshotCount: null,
  genres: [],
  releaseNotes: null,
  languages: [],
  contentRating: null,
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;

const arrayLength = (value: unknown): number | null =>
  Array.isArray(value) ? value.length : null;

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const nonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

export function extractAppStoreRawFacts(raw: unknown): RawAppFacts {
  const record = asRecord(raw);
  if (!record) {
    return { ...EMPTY_FACTS };
  }
  return {
    screenshotCount: arrayLength(record.screenshots),
    ipadScreenshotCount: arrayLength(record.ipadScreenshots),
    genres: stringArray(record.genres),
    releaseNotes: nonEmptyString(record.releaseNotes),
    languages: stringArray(record.languages),
    contentRating: nonEmptyString(record.contentRating),
  };
}
