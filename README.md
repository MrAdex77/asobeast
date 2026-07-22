# asobeast

**Self hosted App Store Optimization (ASO) toolkit for indie developers and small teams.** Point it at an App Store or Google Play URL and asobeast imports the app, snapshots its metadata, extracts and tracks keywords, checks keyword rankings daily, and scores each keyword for traffic, difficulty and opportunity — all through a web UI backed by a documented API. Every store request runs on the machine that hosts asobeast, and your data never leaves your database. Track any storefront by country, on both the App Store and Google Play.

## Features

- **Import from a store URL** — paste an App Store or Google Play link, get the app, its icon and a first metadata snapshot.
- **Metadata snapshots & diffs** — refresh an app to capture a new snapshot and see exactly what changed.
- **Keyword tracking** — App Store apps auto track title and subtitle keywords; Google Play apps auto track title and short-description keywords. Add your own, or paste the private 100 character iOS keyword field (App Store only; it cannot be scraped).
- **Daily rankings** — one store search per keyword serves the primary app and all its competitors; positions are 1 based, `null` when the app is not found within the checked depth. Per-market keyword tracking works on both stores.
- **Keyword scoring** — traffic and difficulty persist per keyword; opportunity is computed per app from its current position. App Store scoring uses the Apple autocomplete "suggest" priority signal; Google Play scoring uses prefix-probed suggest plus an installs strength signal.
- **Competitors** — track rival apps and compare keyword coverage with gap analysis.
- **Analytics** — per app visibility score, a dashboard summary and a visibility history series.
- **Web dashboard** — a Next.js App Router frontend covering every API capability:
  - **Apps grid** — import from a store URL, delete with confirmation, skeleton/empty/error states.
  - **App overview** — stat cards, a themed visibility area chart, a rank distribution chart, keyword movers and metadata coverage; refresh (with a snapshot diff dialog) and run-daily actions.
  - **Keywords workspace** — a sortable table (position, traffic, difficulty, opportunity) with per-row toggle/score/delete, an add dialog, keyword suggestions across all strategies, and the private 100-character iOS keyword field editor.
  - **Rankings** — a multi-series ranking history chart with a reversed axis (position 1 on top, `>100` for not-found), keyword picker and date-range presets.
  - **Competitors** — competitor management plus a comparison matrix with a gap filter.
  - **Audit & metadata** — the ASO audit rubric and metadata coverage views.
  - Light/dark mode (system default), URL-addressable state (sort, ranges, selections, filters survive reload), and per-section loading and error boundaries.
- **API + Swagger** — every endpoint is documented; interactive docs at `/docs`, OpenAPI JSON at `/docs-json`.

## Quick start

You need only [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
git clone https://github.com/MrAdex77/asobeast.git
cd asobeast
cp apps/api/.env.example apps/api/.env
docker compose up --build
```

Then open:

- Web UI — http://localhost:3000
- API docs — http://localhost:4000/docs
- Health — http://localhost:4000/health

`docker compose up` starts Postgres, Redis, the API (which runs database migrations and seeds the default workspace on boot) and the web app. Import an App Store or Google Play app from the UI and its keywords start tracking immediately.

> Expose only the web app; it proxies the API. The browser talks to the web origin at `/api/backend/*`, which forwards to `API_INTERNAL_URL` (default `http://localhost:4000`, set to `http://api:4000` by `docker-compose.yml`). The web image is environment-agnostic — point it at any API address at runtime, no rebuild.

## Development

asobeast is a pnpm + Turborepo monorepo (Node.js 22+, TypeScript strict everywhere).

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d   # Postgres + Redis for dev
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter api db:migrate                      # apply migrations + seed
pnpm dev                                          # shared (watch) + api + web
```

Common commands, all from the repo root:

```bash
pnpm dev                 # turbo run dev across shared, api, web
pnpm build               # build respecting the dependency graph
pnpm lint && pnpm test   # lint and unit tests across all packages
pnpm --filter api test:e2e
pnpm --filter web test:e2e   # playwright browser tests against a typed mock api
pnpm --filter api db:studio
```

The web end-to-end suite is hermetic: a tiny `node:http` mock API (typed by `@asobeast/shared` contracts) runs on port 4100 and serves both server-side prefetching and browser fetches, so no Postgres, Redis or store calls are needed. Playwright reuses a running dev server locally and builds the production bundle in CI. Install the browser once with `pnpm --filter web exec playwright install chromium`.

To exercise email alerts locally, run [Mailpit](https://mailpit.axllent.org/) as a throwaway SMTP sink and point the API at it:

```bash
docker run -p 1025:1025 -p 8025:8025 axllent/mailpit   # SMTP on 1025, web UI on 8025
```

Then set `SMTP_HOST=localhost`, `SMTP_PORT=1025` and `SMTP_FROM=asobeast <alerts@localhost>` in `apps/api/.env`, add an email alert on the settings page, and watch messages arrive at http://localhost:8025.

### Layout

```text
apps/
  api/        NestJS + Prisma + BullMQ backend
  web/        Next.js App Router frontend
packages/
  shared/             @asobeast/shared: contract types, Store union, url parser, helpers
  typescript-config/  shared base tsconfigs
docker-compose.dev.yml  Postgres + Redis for development
docker-compose.yml      full self hosted stack
```

### Where types live

Every request and response shape the frontend consumes lives in `@asobeast/shared` (for example `AppListItem`, `TrackedKeywordItem`, `AppSummary`, `RankingSeries`, `ApiErrorEnvelope`). The API's DTO classes implement those interfaces and the web app types its fetch calls with them; Prisma generated types never cross the `apps/api` boundary. `@asobeast/shared` also owns the `Store` union, the store URL parser and normalization helpers, and is compiled with tsup so NestJS's CommonJS build can consume it cleanly. Never import across packages by relative path.

## Configuration

`apps/api/.env`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://asobeast:asobeast@localhost:5432/asobeast` | PostgreSQL connection string. |
| `REDIS_HOST` | `localhost` | Redis host for the BullMQ queues. |
| `REDIS_PORT` | `6379` | Redis port. |
| `REDIS_DB` | `0` | Redis database index for the queues (e2e tests use a separate index). |
| `PORT` | `4000` | API listen port. |
| `DEFAULT_COUNTRY` | `us` | Fallback storefront for imports from a bare iTunes id or a URL without a country segment. |
| `CRON_DAILY` | `0 3 * * *` | Cron for the daily ranking pipeline (UTC). |
| `CRON_SCORING` | `0 4 * * 0` | Cron for weekly keyword scoring (UTC, Sunday). |
| `SCRAPE_ITUNES_RPM` | `15` | iTunes requests per minute; the App Store worker runs concurrency 1 behind this limiter. |
| `SCRAPE_GPLAY_RPM` | `10` | Google Play job-starts per minute; the `gplay` worker runs concurrency 1 behind this limiter. A Play score job makes ≈15–18 requests (1 search + ≤7 suggests + 10 detail fetches) against ≈2 for Apple; self-hosters with hundreds of Play keywords should lower this or expect the weekly scoring window to stretch. |
| `CRON_RETENTION` | `0 5 * * *` | Cron for the data retention pruning job (UTC). |
| `CRON_DIGEST` | `0 8 * * 1` | Cron for the weekly digest webhook (UTC, Monday 08:00). |
| `ALERT_DELIVERY` | `batched` | `batched` collects events into an outbox and sends one grouped email/POST per channel per flush; `instant` is the pre-phase-36 per-event delivery. |
| `CRON_ALERT_FLUSH` | `0 7 * * *` | Cron for the grouped alert flush (UTC), after the daily pipeline drains; set hourly for lower latency. |
| `RETENTION_RANKINGS_DAYS` | `365` | Prune keyword rankings older than N days; `0` keeps forever. |
| `RETENTION_SERP_DAYS` | `90` | Prune SERP entries older than N days; `0` keeps forever. |
| `RETENTION_SNAPSHOTS_DAYS` | `180` | Prune app snapshots older than N days; the newest snapshot per app is always kept; `0` keeps forever. |
| `RETENTION_CATEGORY_RANKS_DAYS` | `365` | Prune category ranks older than N days; `0` keeps forever. |
| `RETENTION_CHANGE_EVENTS_DAYS` | `0` | Prune change events older than N days; `0` keeps forever. |
| `RETENTION_DELIVERIES_DAYS` | `30` | Prune alert delivery log rows older than N days; `0` keeps forever. |
| `RETENTION_ALERT_EVENTS_DAYS` | `30` | Prune flushed alert outbox rows older than N days; `0` keeps forever. |
| `SMTP_HOST` | — | SMTP server host. Set together with `SMTP_FROM` to enable email alerts; leave empty to disable. |
| `SMTP_PORT` | `587` | SMTP server port (`465` with `SMTP_SECURE=true`). |
| `SMTP_SECURE` | `false` | `true` wraps the connection in TLS (port 465). |
| `SMTP_USER` | — | SMTP username; leave empty for unauthenticated relays. |
| `SMTP_PASSWORD` | — | SMTP password. |
| `SMTP_FROM` | — | From address, e.g. `asobeast <alerts@example.com>`. Required to enable email alerts. |
| `BULL_BOARD_ENABLED` | `true` | Serve the Bull Board queue dashboard at `/admin/queues`. |
| `BULL_BOARD_USER` | — | Set together with `BULL_BOARD_PASSWORD` to protect `/admin/queues` with HTTP basic auth. |
| `BULL_BOARD_PASSWORD` | — | Basic-auth password for `/admin/queues`; the guard activates only when both are set. |
| `LOG_LEVEL` | `debug` | `error`, `warn`, `log`, `debug` or `verbose`. |

Alerts fan out to two channels: **webhooks** (Slack, Discord, ntfy or any endpoint) and **email** (SMTP, enabled only when `SMTP_HOST` and `SMTP_FROM` are set). Both carry the same events and record every attempt in a delivery log, surfaced per channel on the settings page so failed deliveries are visible instead of silently retrying.

### Grouped delivery

By default (`ALERT_DELIVERY=batched`) alerts are **collected, not streamed**. Every alert-producing signal — rank changes, SERP entrants, metadata changes, negative reviews — is driven by the daily pipeline, which has daily granularity, so per-event delivery is noise, not timeliness. Instead of enqueueing one email and one webhook POST per event, batched mode writes each event to an outbox and the flush job (`CRON_ALERT_FLUSH`, default `0 7 * * *` UTC, after the 03:00 pipeline drains) sends **one professional email and one webhook POST per channel**, grouped by app → store → section, with competitor activity nested under its primary app. Re-runs and multi-market checks that emit the same fact twice are deduplicated within the window (latest values win). The guarantee is one email and one POST per channel **per flush** — set `CRON_ALERT_FLUSH` hourly if you want lower latency, and use **Flush now** on the settings page to send immediately. This is why a full daily pipeline gives you one grouped email instead of thirty single-line ones. Channel subscriptions still apply: a channel's batch contains only the event types it subscribed to, and a channel whose filtered batch is empty gets nothing. The weekly digest is already a digest and bypasses the outbox on its own schedule.

To restore the pre-phase-36 behavior set `ALERT_DELIVERY=instant`, which delivers each event immediately, one notification per event — byte-identical to before. This is a **breaking change for webhook consumers** that parse the granular event shapes: either switch that consumer to `instant`, or parse the batch body's flat `events[]` array, which carries the same per-event payloads alongside the grouped `apps` tree. Flushed outbox rows are pruned by `RETENTION_ALERT_EVENTS_DAYS` (default 30) so yesterday's grouped email stays debuggable without growing forever.

`apps/web/.env`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `API_INTERNAL_URL` | `http://localhost:4000` | API base URL read at runtime. Server-rendered pages call it directly; browser requests reach it through the `/api/backend/*` proxy. |

## Tracking multiple countries

You import an app **once**. Its home storefront comes from the store URL — `apps.apple.com/de/app/...` imports a `de` home market — with an override in the import dialog; a bare iTunes id or a URL without a country segment falls back to `DEFAULT_COUNTRY`. The home storefront drives the app's metadata, category ranks and reviews.

Keyword tracking is where markets live. On the keyword monitor you switch markets with a filter (each shows its keyword count), and add keywords into whichever market you choose — a market with none yet shows an empty state with an **Add keywords** button. The same phrase tracked in `us` and `pl` is two keyword rows checked by two searches, so rankings, difficulty and traffic are per storefront. Each keyword's ranking search serves your app and all its competitors in that market from a single request. Codes are two lowercase letters (`us`, `gb`, `de`, …) validated by shape, so any live Apple storefront works without maintaining a country list.

Because every market multiplies the daily search volume against the same `SCRAPE_ITUNES_RPM` budget, the **settings page shows a daily request budget card** — estimated requests broken down by kind, your capacity, and a utilization meter — and the dashboard warns when the daily pipeline would exceed 85% of that capacity. When it does, remove keywords or markets, or raise `SCRAPE_ITUNES_RPM` at your own risk. Category charts count toward the same budget: every app is scheduled against the grossing chart as well as its own free or paid chart, so category jobs run at roughly twice the count of the price-collection alone. They remain the smallest slice of the daily budget, and the budget card reports the real number.

## Limitations

- **Per-store caveats.** Both stores are live, but their public data differs. Google Play's suggest endpoint carries no priority signal (asobeast prefix-probes it instead), Play search results carry no rating counts (so SERP rating columns stay empty for Play), and `released` dates are best-effort outside the `en` storefront. The iOS keyword field and subtitle are App Store concepts with no Play equivalent; Google Play's indexed 80-character short description takes their place.
- **Scrapers can break.** asobeast reads public store endpoints; when Apple or Google change them a parser can fail. Parse failures fail the job (BullMQ retries with backoff) and never take down request handling.
- **Informal rate limits.** The iTunes and Google Play endpoints tolerate only modest request rates per IP; asobeast stays well under that by design. Do not point many instances at the stores from one IP.
- **Protect Bull Board before exposing it.** The `/admin/queues` dashboard is unauthenticated by default; set both `BULL_BOARD_USER` and `BULL_BOARD_PASSWORD` for HTTP basic auth, or `BULL_BOARD_ENABLED=false` to disable it. Even with auth, prefer keeping it off the public internet.
- **No authentication or multi tenancy in v1.** Tenant owned rows carry a `workspaceId` and v1 uses a single seeded workspace.

## Roadmap

- More regions.
- Alerts on rank drops and competitor metadata changes.
- Authentication and real multi workspace tenancy for a hosted version.

## License

[AGPL-3.0](LICENSE). If you run a modified version as a network service, the AGPL requires you to offer that modified source to its users.
