export interface FanOutSummary {
  apps: number;
  keywords: number;
}

export interface RunDailyResult {
  enqueued: FanOutSummary;
}

export interface ScoreEnqueueResult {
  enqueued: true;
}
