export interface FanOutSummary {
  apps: number;
  keywords: number;
  categories: number;
}

export interface RunDailyResult {
  enqueued: FanOutSummary;
}

export interface ScoreEnqueueResult {
  enqueued: true;
}
