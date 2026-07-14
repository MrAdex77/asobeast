import { z } from 'zod';

/**
 * Typed environment configuration.
 *
 * The app refuses to boot on invalid config: `ConfigModule.forRoot` runs
 * `validate` (see app.module.ts) which calls `EnvSchema.parse`, so a bad value
 * (for example `PORT=abc`) throws a clear error at startup. Numbers are coerced
 * from their string env representation. Defaults follow CLAUDE.md.
 */
export const EnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://asobeast:asobeast@localhost:5432/asobeast'),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  PORT: z.coerce.number().int().positive().default(4000),
  DEFAULT_COUNTRY: z.string().min(1).default('us'),
  CRON_DAILY: z.string().min(1).default('0 3 * * *'),
  CRON_SCORING: z.string().min(1).default('0 4 * * 0'),
  SCRAPE_ITUNES_RPM: z.coerce.number().int().positive().default(15),
  ALERT_RANK_DROP_THRESHOLD: z.coerce.number().int().positive().default(5),
  ALERT_REVIEW_SCORE_MAX: z.coerce.number().int().min(1).max(4).default(2),
  RETENTION_RANKINGS_DAYS: z.coerce.number().int().min(0).default(365),
  RETENTION_SERP_DAYS: z.coerce.number().int().min(0).default(90),
  RETENTION_SNAPSHOTS_DAYS: z.coerce.number().int().min(0).default(180),
  RETENTION_CATEGORY_RANKS_DAYS: z.coerce.number().int().min(0).default(365),
  RETENTION_CHANGE_EVENTS_DAYS: z.coerce.number().int().min(0).default(0),
  RETENTION_DELIVERIES_DAYS: z.coerce.number().int().min(0).default(30),
  CRON_RETENTION: z.string().min(1).default('0 5 * * *'),
  CRON_DIGEST: z.string().min(1).default('0 8 * * 1'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  BULL_BOARD_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  BULL_BOARD_USER: z.string().min(1).optional(),
  BULL_BOARD_PASSWORD: z.string().min(1).optional(),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'log', 'debug', 'verbose'])
    .default('debug'),
});

export type Env = z.infer<typeof EnvSchema>;

/** Used as the `validate` hook in `ConfigModule.forRoot`. */
export function validateEnv(config: Record<string, unknown>): Env {
  return EnvSchema.parse(config);
}
