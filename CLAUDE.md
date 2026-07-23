# CLAUDE.md — asobeast

## What this project is

**asobeast** is an open source, self hosted ASO (App Store Optimization) toolkit for indie developers and small teams. It imports an app from a store URL, stores metadata snapshots, extracts and tracks keywords, checks keyword rankings daily, scores keywords (traffic, difficulty, opportunity) and shows everything through a Next.js frontend talking to a NestJS API. All store requests run on the machine that hosts the app. Multi-country: an app is a **single tracking entity** with a home storefront (`app.country`, from the URL or `DEFAULT_COUNTRY`); keyword tracking carries its own country, so one app tracks keywords across many storefronts, filtered per market on the keyword monitor. **Both stores are live: Apple App Store and Google Play.** All scraping stays behind the `StoreProvider` interface (provider isolation unchanged), so a parser breakage is contained to one module.

The implementation plan lives in `docs/plan/`. Work phase by phase, step by step; each step maps to exactly one git commit whose message is given in the plan. The frontend upgrade plan lives in `docs/frontend-plan/` and follows the same rules, one branch and one PR per phase.

## Tech stack

- **Monorepo:** pnpm workspaces + Turborepo, Node.js 22+, TypeScript strict everywhere
- **apps/api:** NestJS (latest stable), Prisma + PostgreSQL 16, BullMQ + Redis 7, Jest + Supertest
- **apps/web:** Next.js (latest stable, App Router, Tailwind), consumes the API over HTTP
- **packages/shared:** `@asobeast/shared`, compiled with tsup (cjs + esm + dts), tested with Vitest
- **packages/typescript-config:** `@asobeast/typescript-config`, base tsconfigs
- Scraping: `@perttu/app-store-scraper` (App Store) and `@mradex77/google-play-scraper` (Google Play), both isolated behind the `StoreProvider` interface.
- Docker + docker compose for dev services and self hosting

## Repository layout

```text
apps/
  api/                    NestJS backend
    src/
      config/             typed env configuration
      prisma/             PrismaService + module
      health/
      store-providers/    provider contract impls + registry (App Store + Google Play, both live)
      apps/               import, snapshots, refresh, competitors
      keywords/           extraction, tracked keywords, suggestions
      rankings/           rank capture + history
      scoring/            pure formulas + stats collection
      analytics/          visibility, summary
      audit/              aso audit rubric engine + endpoints
      metadata/           metadata audit + keyword coverage
      jobs/               BullMQ queues, workers (appstore + gplay), schedulers
    prisma/               schema.prisma, migrations, seed.ts
  web/                    Next.js frontend
    src/
      app/                App Router: page/layout/loading/error/not-found per segment
                          (/, /apps/[id] + keywords, rankings, competitors, audit, metadata)
      components/
        ui/               shadcn generated primitives (owned, editable)
        layout/           SiteHeader, ThemeToggle, HealthBadge, ErrorState
        apps/ app-detail/ overview/ keywords/ rankings/ competitors/ audit/  feature + skeleton components
      lib/                api.ts (typed transport), queries.ts (query keys + options + invalidation),
                          get-query-client.ts, search-params.ts (nuqs parsers), ranges.ts, format.ts, utils.ts
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

- Conventional commits: `type(scope): subject`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`.
- Scopes: `repo` (workspace level), `api`, `web`, `shared`, `docker`, `ci`, plus API domain scopes `db`, `providers`, `apps`, `keywords`, `rankings`, `scoring`, `competitors`, `analytics`, `jobs`, `audit`, `metadata`, `changes`, `alerts` (domain scopes always mean code inside `apps/api`).
- Subject: imperative, lowercase, no trailing period, max 72 chars. One plan step = one commit with the exact message from the plan; body only for deviations.
- Before every commit: `pnpm lint && pnpm test` green (plus `pnpm build` when configs or dependencies changed).
- Never commit `.env` files, `node_modules`, `dist`, `.next`, `.turbo`.

## Coding conventions

- TypeScript `strict: true` in all packages, extending `@asobeast/typescript-config`. No `any` except where untyped scraper payloads enter the provider layer, mapped to typed structures immediately.
- Every controller input is a DTO validated with `class-validator`; global `ValidationPipe` with `whitelist: true`.
- Controllers thin, services own logic, scoring functions pure and unit tested.
- All scraping goes through the `StoreProvider` interface in `apps/api/src/store-providers/`. No other module may import a scraper library. This isolation contains parser breakage and lets a future cloud version swap in proxies or a data API.
- Store raw scraper payloads in `raw` Json columns; parsers change, raw data allows reprocessing.
- All dates UTC; daily granularity uses Postgres `date` (`@db.Date`); "today" is the UTC date.
- `installs` is `BigInt` (kept for future Google Play); JSON serialization patched in `apps/api/src/main.ts`.

## Shared code rules (monorepo discipline)

1. **Contract types live in `@asobeast/shared`.** Any request or response shape the frontend consumes is defined there (for example `AppListItem`, `TrackedKeywordItem`, `AppSummary`, `RankingSeries`, `ApiErrorEnvelope`). API DTO classes implement these interfaces (`implements X` or `satisfies`); the web app types its fetch calls with them. **Prisma generated types never cross the `apps/api` boundary.**
2. `@asobeast/shared` also owns the `Store` string union (`'APP_STORE' | 'GOOGLE_PLAY'`, values identical to the Prisma enum), the store URL parser, and normalization helpers reused by both apps. It must stay dependency light and runtime agnostic: no Nest, no Next, no Node only APIs.
3. `@asobeast/shared` is a **compiled package** (tsup, cjs + esm + dts). Do not switch it to raw TS exports; NestJS's CommonJS build cannot consume just in time TS packages cleanly.
4. Internal dependencies use `"@asobeast/shared": "workspace:*"`. Turborepo's `build` task has `"dependsOn": ["^build"]`, so consumers always see fresh output; `pnpm dev` keeps tsup in watch mode.
5. Never import across packages by relative path.

## Frontend rules (apps/web)

1. **One transport, typed by shared.** `src/lib/api.ts` is the only place that talks to the API (typed `apiFetch` + one function per endpoint, every call typed by an `@asobeast/shared` contract). Never redefine a response shape locally and never import Prisma types.
2. **The query cache owns freshness.** `src/lib/queries.ts` holds the `appKeys` hierarchy, the `queryOptions` factories and the mutation invalidation helpers (`invalidateKeywordMutation`, `invalidateCompetitorMutation`, …) — the single place invalidation sets are written down. Pages prefetch into a shared `getQueryClient()` and render a `HydrationBoundary`; client feature components use `useSuspenseQuery`/`useMutation`. **`router.refresh()` is banned** — after a mutation, invalidate or seed the cache.
3. **URL is the state.** Sort, date-range presets, selected keyword ids and filters live in `searchParams` via `nuqs` parsers in `src/lib/search-params.ts` (built from shared unions). No duplicate `useState` for view state.
4. **Boundaries per section.** Every route segment has `loading.tsx` (geometry-matched skeleton) and `error.tsx` (shared `ErrorState`, recovers via `unstable_retry`); every `useSuspenseQuery` consumer sits under a local `Suspense` boundary, not the whole page.
5. **Domain rendering.** Position is 1-based; `null` means "checked, not found within depth 100" → render `>100`, never `0`. Ranking charts use a reversed Y axis (1 on top). Dates are UTC `date` strings formatted with `Intl.DateTimeFormat` pinned to UTC. Traffic/difficulty/opportunity are 0–100 scores. `refresh` returns a snapshot diff to show; `run-daily` and `score` return 202 queued — toast "queued" and let the cache refetch.
6. **Theming & a11y.** shadcn primitives live in `components/ui` (owned, editable); dark mode via `next-themes` class strategy. Icon-only buttons carry `aria-label`, dialogs carry a description, tables carry a caption, charts keep `accessibilityLayer`, and colour is never the only signal.

## Domain rules that are easy to get wrong

1. **Both stores are live.** The Prisma enum, shared `Store` union and URL parser cover App Store and Google Play, and `SUPPORTED_STORES` lists both. Play search indexes **title (30), short description (80) and long description (4000)** — there is no subtitle and no keyword field, so those two stay Apple-only concepts everywhere (types, lints, audit weight 0, hidden in the web). Play's indexed 80-char short description (`summary`) is its equivalent surface: it is auto-tracked (`DESCRIPTION` source), linted (`lintShortDescription`) and coverage-checked. The 501 `StoreNotSupportedError` path stays wired for any *future* store, not for Play.
2. **The iOS keyword field (100 chars) is private.** It never appears on the store page and cannot be scraped; the owner pastes it manually (source `KEYWORD_FIELD`).
3. **Rate limits.** The iTunes endpoints informally tolerate roughly 20 requests per minute per IP; the `appstore` worker runs concurrency 1 with a limiter from `SCRAPE_ITUNES_RPM` (default 15). Google Play is more sensitive: the `gplay` worker runs concurrency 1 with a limiter from `SCRAPE_GPLAY_RPM` (default 10) that spaces **job starts**, because a single Play score job fans out to ≈15–18 sequential requests (1 search + ≤7 prefix-probe suggests + 10 detail `getApp` enrichments) versus ≈2 for Apple. Never call store endpoints in bulk outside the queue (the only exception: small, user initiated suggestion lookups).
4. **One app, per-market keyword tracking; one search serves everyone.** An app is a single row; countries live on keyword tracking (`Keyword` is scoped by `text, store, country`), so a single app owns keywords across storefronts, added and filtered per market on the keyword monitor. `checkKeyword` searches `keyword.country` (not `app.country`) and records positions for the primary app and all its competitors in that storefront from one search — never one search per app. The same phrase tracked in two markets is two keyword rows checked by two searches; rankings differ per storefront. Each added market multiplies daily search volume against the same `SCRAPE_ITUNES_RPM` budget; `GET /jobs/budget` estimates the fan-out and the settings budget card surfaces it. The iOS keyword field, category ranks, reviews, snapshots and auto-tracked keywords stay on the home market in v1 (a full per-market app-detail switcher is backlog).
5. **Opportunity is per app, not per keyword.** Traffic and difficulty persist in `KeywordMetric`; opportunity depends on the app's keyword relevance and is computed in the read layer only (aso-skills formula).
6. **Position semantics.** 1 based; `null` means "checked, not found within `depth`" (default 100). Store the row even when null.
7. **Multi tenancy is prepared, not implemented.** Tenant owned rows carry `workspaceId`; v1 uses the seeded default workspace; no auth in v1.
8. **Scrapers break.** Parse failures fail the job (BullMQ retries with backoff) and must never take down request handling.

## Environment variables

`apps/api/.env`:

```bash
DATABASE_URL=postgresql://asobeast:asobeast@localhost:5432/asobeast
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0                   # bull queue db index; e2e tests use a separate index
PORT=4000
DEFAULT_COUNTRY=us
CRON_DAILY=0 3 * * *        # daily pipeline, UTC
CRON_SCORING=0 4 * * 0      # weekly scoring, UTC (Sunday)
SCRAPE_ITUNES_RPM=15
SCRAPE_GPLAY_RPM=10         # google play job-starts/minute; each Play score job fans out to ~15-18 requests
ALERT_RANK_DROP_THRESHOLD=5  # positions a primary app must move to fire a rank alert
ALERT_DELIVERY=batched              # batched: one grouped email/POST per flush; instant: pre-phase-36 per-event delivery
CRON_ALERT_FLUSH=0 7 * * *          # grouped alert flush, UTC (after the daily pipeline drains)
CRON_RETENTION=0 5 * * *            # data retention pruning, UTC
RETENTION_RANKINGS_DAYS=365         # keyword rankings; 0 keeps forever
RETENTION_SERP_DAYS=90              # serp entries; 0 keeps forever
RETENTION_SNAPSHOTS_DAYS=180        # app snapshots; newest per app always kept; 0 keeps forever
RETENTION_CATEGORY_RANKS_DAYS=365   # category ranks; 0 keeps forever
RETENTION_CHANGE_EVENTS_DAYS=0      # change events; 0 keeps forever
RETENTION_DELIVERIES_DAYS=30        # alert delivery log rows; 0 keeps forever
RETENTION_AUDIT_SCORES_DAYS=0       # audit score rows; 0 keeps forever
RETENTION_ALERT_EVENTS_DAYS=30      # flushed alert outbox rows; 0 keeps forever
OPENAI_API_KEY=                     # optional; enables the AI audit + metadata drafts. Empty = AI actions disabled (endpoints 409), drafts card hidden, audit shows a setup hint
AI_MODEL=gpt-4o                     # OpenAI model with vision + structured outputs
BULL_BOARD_ENABLED=true
LOG_LEVEL=debug
```

`apps/web/.env`:

```bash
API_INTERNAL_URL=http://localhost:4000
```

## What NOT to do

- No features outside the current phase; park ideas in the backlog section of `docs/plan/phase-10-polish.md`.
- No alternative ORMs, queue systems, HTTP clients, package managers or task runners; the stack is fixed.
- No store calls in tests; providers are mocked in unit and e2e tests.
- No manual SQL migrations; always `prisma migrate dev`.
- No scraper imports outside the `StoreProvider` interface; all scraping goes through the provider layer.
- No comments inside code. DRY, KISS, CLEAN CODE.
