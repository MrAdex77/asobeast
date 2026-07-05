export interface HealthStatus {
  status: 'ok' | 'error';
  db: 'up' | 'down';
}

export interface ApiErrorEnvelope {
  statusCode: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
}
