import type { Store } from '../index';

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

export interface StoreDailyBudget {
  store: Store;
  apps: number;
  keywords: number;
  categories: number;
  reviews: number;
  total: number;
  capacityPerDay: number;
  utilization: number;
}

export interface DailyBudget {
  apps: number;
  keywords: number;
  categories: number;
  reviews: number;
  total: number;
  capacityPerDay: number;
  utilization: number;
  stores: StoreDailyBudget[];
}
