export interface PipelineHealth {
  lastDailyRunAt: string | null;
  stale: boolean;
  failedJobs: number;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  db: 'up' | 'down';
  redis: 'up' | 'down';
  pipeline: PipelineHealth | null;
}

export interface ApiErrorEnvelope {
  statusCode: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
}
