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
