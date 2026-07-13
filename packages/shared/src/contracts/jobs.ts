export interface FanOutSummary {
  apps: number;
  keywords: number;
  categories: number;
  reviews: number;
}

export interface RunDailyResult {
  enqueued: FanOutSummary;
}

export interface ScoreEnqueueResult {
  enqueued: true;
}
