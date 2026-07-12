# asobeast

**Self hosted App Store Optimization (ASO) toolkit for indie iOS developers and small teams.** Point it at an App Store URL and asobeast imports the app, snapshots its metadata, extracts and tracks keywords, checks keyword rankings daily, and scores each keyword for traffic, difficulty and opportunity — all through a web UI backed by a documented API. Every store request runs on the machine that hosts asobeast, and your data never leaves your database. Google Play is architecturally prepared but stubbed for now; region v1 is US only.

## Features

- **Import from a store URL** — paste an App Store link, get the app, its icon and a first metadata snapshot.
- **Metadata snapshots & diffs** — refresh an app to capture a new snapshot and see exactly what changed.
- **Keyword tracking** — title and subtitle keywords are auto tracked; add your own, or paste the private 100 character iOS keyword field (it cannot be scraped).
- **Daily rankings** — one store search per keyword serves the primary app and all its competitors; positions are 1 based, `null` when the app is not found within the checked depth.
- **Keyword scoring** — traffic and difficulty persist per keyword; opportunity is computed per app from its current position. Scoring uses the Apple autocomplete "suggest" priority signal.
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

`docker compose up` starts Postgres, Redis, the API (which runs database migrations and seeds the default workspace on boot) and the web app. Import an App Store app from the UI and its keywords start tracking immediately.

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
pnpm --filter api db:studio
```

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
| `DEFAULT_COUNTRY` | `us` | Store region for imports and searches (US only in v1). |
| `CRON_DAILY` | `0 3 * * *` | Cron for the daily ranking pipeline (UTC). |
| `CRON_SCORING` | `0 4 * * 0` | Cron for weekly keyword scoring (UTC, Sunday). |
| `SCRAPE_ITUNES_RPM` | `15` | iTunes requests per minute; the App Store worker runs concurrency 1 behind this limiter. |
| `CRON_RETENTION` | `0 5 * * *` | Cron for the data retention pruning job (UTC). |
| `RETENTION_RANKINGS_DAYS` | `365` | Prune keyword rankings older than N days; `0` keeps forever. |
| `RETENTION_SERP_DAYS` | `90` | Prune SERP entries older than N days; `0` keeps forever. |
| `RETENTION_SNAPSHOTS_DAYS` | `180` | Prune app snapshots older than N days; the newest snapshot per app is always kept; `0` keeps forever. |
| `RETENTION_CATEGORY_RANKS_DAYS` | `365` | Prune category ranks older than N days; `0` keeps forever. |
| `RETENTION_CHANGE_EVENTS_DAYS` | `0` | Prune change events older than N days; `0` keeps forever. |
| `BULL_BOARD_ENABLED` | `true` | Serve the Bull Board queue dashboard at `/admin/queues`. |
| `LOG_LEVEL` | `debug` | `error`, `warn`, `log`, `debug` or `verbose`. |

`apps/web/.env`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `API_INTERNAL_URL` | `http://localhost:4000` | API base URL read at runtime. Server-rendered pages call it directly; browser requests reach it through the `/api/backend/*` proxy. |

## Limitations

- **App Store and US only for now.** The schema, shared `Store` union and URL parser already know Google Play, but its provider is stubbed and returns HTTP 501; other regions are not scheduled yet.
- **Scrapers can break.** asobeast reads public store endpoints; when Apple changes them a parser can fail. Parse failures fail the job (BullMQ retries with backoff) and never take down request handling.
- **Informal rate limits.** The iTunes endpoints tolerate roughly 20 requests per minute per IP; asobeast stays well under that by design. Do not point many instances at the store from one IP.
- **Bull Board has no auth.** The `/admin/queues` dashboard is unauthenticated — keep it off the public internet or set `BULL_BOARD_ENABLED=false`.
- **No authentication or multi tenancy in v1.** Tenant owned rows carry a `workspaceId` and v1 uses a single seeded workspace.

## Roadmap

- Google Play support (implement the stubbed provider, add a `gplay` worker and its rate limit).
- More regions.
- Alerts on rank drops and competitor metadata changes.
- Authentication and real multi workspace tenancy for a hosted version.

## License

[AGPL-3.0](LICENSE). If you run a modified version as a network service, the AGPL requires you to offer that modified source to its users.
