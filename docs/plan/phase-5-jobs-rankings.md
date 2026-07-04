# Phase 5 — Jobs, Scheduler and Rank Tracking

**Goal:** the beating heart. BullMQ queues, a rate limited App Store worker, a daily scheduler that fans out work, rank capture recording positions for every tracked keyword, and a history endpoint feeding charts. The `gplay` queue is deliberately absent; its future shape is documented where it will live.

**Contract rule:** `RankingSeries` (chart data) is defined in `@asobeast/shared`.

**Prerequisites:** Phase 4 complete; Redis running.

**Install:**

```bash
pnpm --filter api add @nestjs/bullmq bullmq
```

---

## Step 1 — Queue infrastructure

Create `apps/api/src/jobs/`:

1. `BullModule.forRootAsync` reading `REDIS_HOST`/`REDIS_PORT`, with `defaultJobOptions`:

```ts
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
}
```

2. Register two queues: `pipeline` (orchestration, no store traffic) and `appstore` (all App Store HTTP work). Add a comment where queue names are declared: a `gplay` queue with its own limiter joins here when Google Play support lands.
3. Job names and payload types in `apps/api/src/jobs/jobs.types.ts`:

```ts
export const JOBS = {
  DAILY: 'daily-pipeline',
  SCORING: 'weekly-scoring',        // handler arrives in Phase 6
  REFRESH_APP: 'refresh-app',       // { appId }
  CHECK_KEYWORD: 'check-keyword',   // { keywordId }
  SCORE_KEYWORD: 'score-keyword',   // { keywordId }  (Phase 6)
} as const;
```

**Verify:** api boots with Redis up; `redis-cli keys 'bull:*'` shows queue metadata.

**Commit:**

```text
feat(jobs): configure bullmq queues and redis connection
```

## Step 2 — Rate limited App Store worker

One worker class for the `appstore` queue using `@Processor` from `@nestjs/bullmq` (extend `WorkerHost`):

```ts
@Processor('appstore', {
  concurrency: 1,
  limiter: { max: config.SCRAPE_ITUNES_RPM, duration: 60_000 },
})
```

Switch on `job.name`:

1. `REFRESH_APP` → `AppsService.refreshApp(appId)` (Phase 3; also resyncs keywords via Phase 4).
2. `CHECK_KEYWORD` → `RankingsService.checkKeyword(keywordId)` (Step 3).
3. `SCORE_KEYWORD` → throws "not implemented until Phase 6" for now.
4. Unknown → throw.

Log start/finish/duration at debug; failures at warn with the store error message. Concurrency stays 1 so the limiter shapes a polite serial request stream (informal iTunes tolerance is roughly 20 requests per minute per IP; 15 keeps margin).

**Verify:** enqueue a `REFRESH_APP` manually (temporary endpoint or Nest REPL); worker processes it, snapshot appears.

**Commit:**

```text
feat(jobs): add rate limited app store worker
```

## Step 3 — Rank capture

`apps/api/src/rankings/rankings.service.ts` with `checkKeyword(keywordId)`:

1. Load the keyword and every **active** `TrackedKeyword` joined to apps of the same store+country, **plus all competitors of those apps** (competitor creation arrives in Phase 7; the logic is competitor aware from day one).
2. Run **one** provider search: `search(keyword.text, country, 100)`.
3. Build `positionByStoreAppId` from result order (index + 1).
4. For each relevant app (primaries tracking the keyword + their competitors), upsert one `KeywordRanking` for today's UTC date: found position or `null`, `depth: 100`. The composite primary key makes same day reruns idempotent.

The one search per keyword rule is the efficiency core: competitor tracking costs zero extra requests. Budget check: 100 tracked keywords at 15 rpm ≈ 7 minutes of daily store traffic.

Unit test with a mocked provider: primary at 7, competitor at 31, another competitor absent → rows 7, 31, null from one search call.

**Verify:** unit tests green; a manually enqueued `CHECK_KEYWORD` writes rows.

**Commit:**

```text
feat(rankings): capture daily keyword positions from a single search
```

## Step 4 — Daily scheduler and fan out

1. On module init, upsert a BullMQ Job Scheduler (the modern replacement for repeatable jobs) on `pipeline`:

```ts
await this.pipelineQueue.upsertJobScheduler(
  'daily',
  { pattern: this.config.CRON_DAILY, tz: 'UTC' },
  { name: JOBS.DAILY },
);
```

2. The `pipeline` worker handles `DAILY` by fanning out:
   * one `REFRESH_APP` per app in the workspace (primaries and competitors), routed by `app.store` (v1: everything lands on `appstore`);
   * one `CHECK_KEYWORD` per distinct active tracked keyword, `jobId: 'check:' + keywordId + ':' + utcDate` so reruns cannot double enqueue.
3. Log a fan out summary `{ apps, keywords }`.

**Verify:** temporarily set `CRON_DAILY='*/2 * * * *'`, watch one full cycle (refreshes + rank rows), restore. Rerunning within the same day adds no duplicates.

**Commit:**

```text
feat(jobs): add daily pipeline scheduler with idempotent fan out
```

## Step 5 — Manual trigger

`POST /apps/:id/run-daily` → enqueues `REFRESH_APP` for the app and its competitors plus `CHECK_KEYWORD` for its active keywords (same jobId scheme); responds `202 { enqueued: { apps, keywords } }`. Instant gratification for new users instead of waiting for 03:00 UTC.

**Verify:** curl right after importing a fresh app; rankings appear within minutes.

**Commit:**

```text
feat(jobs): manual pipeline trigger per app
```

## Step 6 — Bull Board

```bash
pnpm --filter api add @bull-board/api @bull-board/nestjs @bull-board/express
```

Mount at `/admin/queues` for both queues, gated by `BULL_BOARD_ENABLED`. No auth in v1 (self hosted, single user); the README will tell self hosters to keep it off the public internet.

**Verify:** dashboard lists queues; a forced failure (bad appId) shows 3 retries then failed.

**Commit:**

```text
feat(jobs): mount bull board dashboard behind config flag
```

## Step 7 — Ranking history endpoint

`GET /apps/:id/rankings?from=2026-06-01&to=2026-07-04&keywordIds=a,b,c`

1. Defaults: last 30 days, all active tracked keywords.
2. Response is `RankingSeries` (shared), grouped for direct charting:

```json
{
  "series": [
    {
      "keywordId": "kw_1",
      "text": "habit tracker",
      "points": [{ "date": "2026-07-01", "position": 12 }, { "date": "2026-07-02", "position": null }]
    }
  ]
}
```

3. Dates without a capture are absent; `position: null` means checked but not found.

**Verify:** after a few pipeline runs (or seeded fixtures), coherent series.

**Commit:**

```text
feat(rankings): ranking history endpoint for charts
```

---

## Acceptance checklist

* [ ] All store traffic flows through the `appstore` queue, concurrency 1, limiter from `SCRAPE_ITUNES_RPM`.
* [ ] Daily Job Scheduler exists with UTC cron from config; fan out is idempotent per day.
* [ ] One search per keyword yields rows for primary and competitors (unit tested).
* [ ] Failed jobs retry 3 times with backoff, visible in Bull Board.
* [ ] Manual trigger works; `RankingSeries` contract in shared; history endpoint returns it.
* [ ] Lint, tests, build green.

```text
docs: mark phase 5 complete
```
