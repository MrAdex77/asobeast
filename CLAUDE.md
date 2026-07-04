# CLAUDE.md — asobeast

## What this project is

**asobeast** is an open source, self hosted ASO (App Store Optimization) toolkit for indie developers and small teams. It imports an app from a store URL, stores metadata snapshots, extracts and tracks keywords, checks keyword rankings daily, scores keywords (traffic, difficulty, opportunity) and shows everything through a Next.js frontend talking to a NestJS API. All store requests run on the machine that hosts the app. Region v1: US only. **Store v1: Apple App Store only** (Google Play is architecturally prepared but stubbed).

The implementation plan lives in `docs/plan/`. Work phase by phase, step by step; each step maps to exactly one git commit whose message is given in the plan.

## Tech stack

* **Monorepo:** pnpm workspaces + Turborepo, Node.js 22+, TypeScript strict everywhere
* **apps/api:** NestJS (latest stable), Prisma + PostgreSQL 16, BullMQ + Redis 7, Jest + Supertest
* **apps/web:** Next.js (latest stable, App Router, Tailwind), consumes the API over HTTP
* **packages/shared:** `@asobeast/shared`, compiled with tsup (cjs + esm + dts), tested with Vitest
* **packages/typescript-config:** `@asobeast/typescript-config`, base tsconfigs
* Scraping: `@perttu/app-store-scraper` (App Store). No Google Play scraper is installed in v1.
* Docker + docker compose for dev services and self hosting

## Repository layout

```text
apps/
  api/                    NestJS backend
    src/
      config/             typed env configuration
      prisma/             PrismaService + module
      health/
      store-providers/    provider contract impls + registry (App Store live, Google Play stub)
      apps/               import, snapshots, refresh, competitors
      keywords/           extraction, tracked keywords, suggestions
      rankings/           rank capture + history
      scoring/            pure formulas + stats collection
      analytics/          visibility, summary
      jobs/               BullMQ queues, workers, schedulers
    prisma/               schema.prisma, migrations, seed.ts
  web/                    Next.js frontend (src/app, src/lib/api.ts)
packages/
  shared/                 @asobeast/shared: contract types, Store union, url parser, constants
  typescript-config/      @asobeast/typescript-config: base.json, nest.json, next.json
turbo.json
pnpm-workspace.yaml
docker-compose.dev.yml    Postgres + Redis for development
docker-compose.yml        full self hosted stack (Phase 10)
docs/plan/                the implementation plan (read only reference)
```

## Commands (run from the repo root)

```bash
pnpm install
pnpm dev                        # turbo run dev: shared (tsup watch) + api + web
pnpm --filter api dev           # just the API
pnpm --filter web dev           # just the frontend
pnpm build                      # turbo run build (respects the dependency graph)
pnpm lint && pnpm test          # turbo run lint / test across all packages
pnpm --filter api test:e2e
pnpm --filter api db:migrate    # prisma migrate dev (script inside apps/api)
pnpm --filter api db:studio
docker compose -f docker-compose.dev.yml up -d
```

## Git conventions (strict)

* Conventional commits: `type(scope): subject`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`.
* Scopes: `repo` (workspace level), `api`, `web`, `shared`, `docker`, `ci`, plus API domain scopes `db`, `providers`, `apps`, `keywords`, `rankings`, `scoring`, `competitors`, `analytics`, `jobs` (domain scopes always mean code inside `apps/api`).
* Subject: imperative, lowercase, no trailing period, max 72 chars. One plan step = one commit with the exact message from the plan; body only for deviations.
* Before every commit: `pnpm lint && pnpm test` green (plus `pnpm build` when configs or dependencies changed).
* Never commit `.env` files, `node_modules`, `dist`, `.next`, `.turbo`.

## Coding conventions

* TypeScript `strict: true` in all packages, extending `@asobeast/typescript-config`. No `any` except where untyped scraper payloads enter the provider layer, mapped to typed structures immediately.
* Every controller input is a DTO validated with `class-validator`; global `ValidationPipe` with `whitelist: true`.
* Controllers thin, services own logic, scoring functions pure and unit tested.
* All scraping goes through the `StoreProvider` interface in `apps/api/src/store-providers/`. No other module may import a scraper library. This isolation contains parser breakage and lets a future cloud version swap in proxies or a data API.
* Store raw scraper payloads in `raw` Json columns; parsers change, raw data allows reprocessing.
* All dates UTC; daily granularity uses Postgres `date` (`@db.Date`); "today" is the UTC date.
* `installs` is `BigInt` (kept for future Google Play); JSON serialization patched in `apps/api/src/main.ts`.

## Shared code rules (monorepo discipline)

1. **Contract types live in `@asobeast/shared`.** Any request or response shape the frontend consumes is defined there (for example `AppListItem`, `TrackedKeywordItem`, `AppSummary`, `RankingSeries`, `ApiErrorEnvelope`). API DTO classes implement these interfaces (`implements X` or `satisfies`); the web app types its fetch calls with them. **Prisma generated types never cross the `apps/api` boundary.**
2. `@asobeast/shared` also owns the `Store` string union (`'APP_STORE' | 'GOOGLE_PLAY'`, values identical to the Prisma enum), the store URL parser, and normalization helpers reused by both apps. It must stay dependency light and runtime agnostic: no Nest, no Next, no Node only APIs.
3. `@asobeast/shared` is a **compiled package** (tsup, cjs + esm + dts). Do not switch it to raw TS exports; NestJS's CommonJS build cannot consume just in time TS packages cleanly.
4. Internal dependencies use `"@asobeast/shared": "workspace:*"`. Turborepo's `build` task has `"dependsOn": ["^build"]`, so consumers always see fresh output; `pnpm dev` keeps tsup in watch mode.
5. Never import across packages by relative path.

## Domain rules that are easy to get wrong

1. **App Store only, by design, for now.** The Prisma enum, shared `Store` union and URL parser know both stores. The Google Play provider is a stub throwing `StoreNotSupportedError`, surfaced by the API as HTTP 501 with a friendly message. Adding Google Play later = implement the provider + register a `gplay` worker + add its rate limit env. Do not remove Google Play from types or schema, and do not implement its scraping in v1.
2. **The iOS keyword field (100 chars) is private.** It never appears on the store page and cannot be scraped; the owner pastes it manually (source `KEYWORD_FIELD`).
3. **Rate limits.** The iTunes endpoints informally tolerate roughly 20 requests per minute per IP; the `appstore` worker runs concurrency 1 with a limiter from `SCRAPE_ITUNES_RPM` (default 15). Never call store endpoints in bulk outside the queue (the only exception: small, user initiated suggestion lookups).
4. **One search serves everyone.** A single store search per keyword yields positions for the primary app and all its competitors. Never one search per app.
5. **Opportunity is per app, not per keyword.** Traffic and difficulty persist in `KeywordMetric`; opportunity depends on the app's current position and is computed in the read layer only.
6. **Position semantics.** 1 based; `null` means "checked, not found within `depth`" (default 100). Store the row even when null.
7. **Multi tenancy is prepared, not implemented.** Tenant owned rows carry `workspaceId`; v1 uses the seeded default workspace; no auth in v1.
8. **Scrapers break.** Parse failures fail the job (BullMQ retries with backoff) and must never take down request handling.

## Environment variables

`apps/api/.env`:

```bash
DATABASE_URL=postgresql://asobeast:asobeast@localhost:5432/asobeast
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=4000
DEFAULT_COUNTRY=us
CRON_DAILY=0 3 * * *        # daily pipeline, UTC
CRON_SCORING=0 4 * * 0      # weekly scoring, UTC (Sunday)
SCRAPE_ITUNES_RPM=15
BULL_BOARD_ENABLED=true
LOG_LEVEL=debug
```

`apps/web/.env`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## What NOT to do

* No features outside the current phase; park ideas in the backlog section of `docs/plan/phase-10-polish.md`.
* No alternative ORMs, queue systems, HTTP clients, package managers or task runners; the stack is fixed.
* No store calls in tests; providers are mocked in unit and e2e tests.
* No manual SQL migrations; always `prisma migrate dev`.
* No Google Play scraping code in v1.
