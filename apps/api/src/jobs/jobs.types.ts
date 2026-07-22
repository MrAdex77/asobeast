import { AlertPayload, CategoryCollection, Store } from '@asobeast/shared';

export const QUEUES = {
  PIPELINE: 'pipeline',
  APP_STORE: 'appstore',
  GPLAY: 'gplay',
  ALERTS: 'alerts',
} as const;

export const LAST_DAILY_RUN_KEY = 'asobeast:last-daily-run';

export function queueNameForStore(store: Store): string {
  return store === 'GOOGLE_PLAY' ? QUEUES.GPLAY : QUEUES.APP_STORE;
}

export const JOBS = {
  DAILY: 'daily-pipeline',
  SCORING: 'weekly-scoring',
  RETENTION: 'data-retention',
  DIGEST: 'weekly-digest',
  AUDIT_SNAPSHOT: 'audit-snapshot',
  REFRESH_APP: 'refresh-app',
  CHECK_KEYWORD: 'check-keyword',
  CHECK_CATEGORY: 'check-category',
  SCORE_KEYWORD: 'score-keyword',
  SPIDER_PROBE: 'spider-probe',
  SYNC_REVIEWS: 'sync-reviews',
  DELIVER_ALERT: 'deliver-alert',
  DELIVER_EMAIL: 'deliver-email',
} as const;

export interface RefreshAppPayload {
  appId: string;
}

export interface DeliverAlertPayload {
  webhookId: string;
  payload: AlertPayload;
}

export interface DeliverEmailPayload {
  emailAlertId: string;
  payload: AlertPayload;
}

export interface CheckKeywordPayload {
  keywordId: string;
}

export interface CheckCategoryPayload {
  collection: CategoryCollection;
  genre: string;
  country: string;
  store: Store;
}

export interface ScoreKeywordPayload {
  keywordId: string;
}

export interface SpiderProbePayload {
  appId: string;
  term: string;
  probe: string;
}

export interface SyncReviewsPayload {
  appId: string;
  pages: number;
  backfill: boolean;
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
  return `score~${keywordId}~${bucket}`;
}

export function spiderJobId(
  appId: string,
  term: string,
  probe: string,
  date: string,
): string {
  const slug = `${term}~${probe || '_'}~${date}`.replace(/:/g, '-');
  return `spider~${appId}~${slug}`;
}

export function reviewsJobId(appId: string, date: string): string {
  return `reviews~${appId}~${date}`;
}

export function reviewsBackfillJobId(appId: string): string {
  return `reviews~${appId}~backfill`;
}

export function categoryJobId(
  collection: CategoryCollection,
  genre: string,
  country: string,
  date: string,
): string {
  return `category~${collection}~${genre}~${country}~${date}`;
}
