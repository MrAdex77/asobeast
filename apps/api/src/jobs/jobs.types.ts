export const QUEUES = {
  PIPELINE: 'pipeline',
  APP_STORE: 'appstore',
} as const;

export const JOBS = {
  DAILY: 'daily-pipeline',
  SCORING: 'weekly-scoring',
  REFRESH_APP: 'refresh-app',
  CHECK_KEYWORD: 'check-keyword',
  SCORE_KEYWORD: 'score-keyword',
} as const;

export interface RefreshAppPayload {
  appId: string;
}

export interface CheckKeywordPayload {
  keywordId: string;
}

export interface ScoreKeywordPayload {
  keywordId: string;
}

export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isoWeekKey(date = new Date()): string {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function scoreJobId(keywordId: string, bucket: string): string {
  return `score:${keywordId}:${bucket}`;
}
