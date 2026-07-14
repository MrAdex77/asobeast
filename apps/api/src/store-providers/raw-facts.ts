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

export function screenshotsCount(raw: unknown): number | null {
  return arrayLength(asRecord(raw)?.screenshots);
}

export function primaryGenreId(raw: unknown): number | null {
  const value = asRecord(raw)?.primaryGenreId;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function primaryGenreName(raw: unknown): string | null {
  return nonEmptyString(asRecord(raw)?.primaryGenre);
}

export function isPaid(raw: unknown): boolean {
  const value = asRecord(raw)?.price;
  return typeof value === 'number' && value > 0;
}

export function releaseNotes(raw: unknown): string | null {
  const value = asRecord(raw)?.releaseNotes;
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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
