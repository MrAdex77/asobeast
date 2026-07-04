# Phase 10 — Polish, Docker, Docs, CI, Release

**Goal:** turn a working monorepo into a shippable open source project: strict validation, OpenAPI, per app Docker images built with `turbo prune`, a one command full stack compose, a proper README, CI through Turborepo, and the v0.1.0 tag.

**Prerequisites:** Phases 0..9 complete.

---

## Step 1 — Global validation and error envelope (api)

1. `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))`.
2. Audit every DTO for `class-validator` decorators (urls, arrays, enums, ranges, date strings).
3. Global exception filter producing the `ApiErrorEnvelope` from `@asobeast/shared`: `{ statusCode, error, message, path, timestamp }`. Map domain errors: `InvalidStoreUrlError` → 400, `StoreNotSupportedError` → 501, `StoreRequestError` → 502, Prisma `P2025` → 404.

**Verify:** e2e asserts the envelope for a bad body, an unknown id, a Google Play import and a mocked store failure.

**Commit:**

```text
feat(api): global validation and consistent error envelope
```

## Step 2 — OpenAPI documentation

```bash
pnpm --filter api add @nestjs/swagger
```

Tag every endpoint (`apps`, `keywords`, `rankings`, `scoring`, `competitors`, `analytics`, `jobs`, `health`), add `@ApiOperation` summaries and typed response DTOs; serve UI at `/docs`, JSON at `/docs-json`; title `asobeast API`, version from `package.json`.

**Verify:** `/docs` renders with every route and schema.

**Commit:**

```text
feat(api): openapi documentation at /docs
```

## Step 3 — Production Docker images via `turbo prune`

`turbo prune <app> --docker` generates an `out/` directory with a `json` folder (just the package.json files, for a cacheable install layer), a `full` folder (pruned source) and a pruned lockfile, so a dependency change in one app no longer invalidates the other app's image.

**`apps/api/Dockerfile`** (build context is the repo root):

```dockerfile
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=$PNPM_HOME:$PATH TURBO_TELEMETRY_DISABLED=1
RUN corepack enable && apk add --no-cache libc6-compat openssl
# openssl: Prisma engines require it on alpine

FROM base AS pruner
WORKDIR /repo
RUN pnpm add -g turbo@^2
COPY . .
RUN turbo prune api --docker

FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /repo/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=api

FROM base AS runner
WORKDIR /repo
COPY --from=builder /repo .
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && (npx prisma db seed || true) && node dist/main.js"]
```

(The api build script already runs `prisma generate` before `nest build`, so the client exists in the image. If image size matters later, a `pnpm --filter api deploy` production stage is the follow up; correctness first.)

**`apps/web/Dockerfile`**: same base/pruner/builder pattern with `turbo prune web --docker`, plus:

1. Set `output: 'standalone'` in `apps/web/next.config.ts` so Next emits a self contained server.
2. Runner copies `apps/web/.next/standalone`, `apps/web/.next/static` and `apps/web/public`, then `CMD ["node", "apps/web/server.js"]`, `EXPOSE 3000`.
3. `NEXT_PUBLIC_API_URL` is inlined at build time: accept it as an `ARG`/`ENV` in the builder stage (default `http://localhost:4000`) and document this in the README (self hosters exposing the api elsewhere must rebuild or front both apps with one reverse proxy).

Add a root `.dockerignore`: `node_modules`, `**/dist`, `**/.next`, `.turbo`, `.git`, `**/.env*`, `coverage`, `docs`.

**Verify:** `docker build -f apps/api/Dockerfile .` and `docker build -f apps/web/Dockerfile .` both succeed from a clean tree.

**Commit:**

```text
feat(docker): production images for api and web via turbo prune
```

## Step 4 — Full stack compose

Root `docker-compose.yml`: `postgres` and `redis` (definitions from the dev file, no published ports needed), `api` (build context `.`, dockerfile `apps/api/Dockerfile`, env wired to the services, `4000:4000`, `depends_on` with `condition: service_healthy`), `web` (dockerfile `apps/web/Dockerfile`, `3000:3000`, build arg `NEXT_PUBLIC_API_URL=http://localhost:4000`, depends on api).

**Verify:** on a machine with only Docker: `docker compose up --build` → web on 3000 loads, imports an App Store app, run daily works, rankings appear; `/docs` and `/health` on 4000 answer.

**Commit:**

```text
feat(docker): one command full stack compose
```

## Step 5 — Project README

Rewrite the root `README.md` for the open source audience:

1. One paragraph pitch: self hosted ASO for indie iOS developers (Google Play planned); your machine makes the store requests; your data stays yours.
2. Feature list mapped to reality (import, tracking, daily ranks, scores with the Apple suggest priority signal, competitors, summary, web UI, API + Swagger).
3. Quick start: `git clone`, `cp apps/api/.env.example apps/api/.env`, `docker compose up`.
4. Development section: pnpm + Turborepo commands, monorepo layout diagram, "where do types live" (the shared package rule).
5. Configuration reference: every env var with default and meaning.
6. Honest limitations: App Store + US only for now, scrapers can break when the store changes, informal rate limits respected by design, Bull Board has no auth (keep it off the public internet), `NEXT_PUBLIC_API_URL` baked at build time.
7. Roadmap (Google Play, more regions, charts, alerts, hosted version) and license. Recommendation for the stated open core plan: **AGPL-3.0**; add the `LICENSE` file.

**Verify:** a stranger could go from clone to first ranking in the web UI using only the README.

**Commit:**

```text
docs: project readme with quick start and configuration reference
```

## Step 6 — Continuous integration

`.github/workflows/ci.yml` on push + PR to `main`:

1. Job `checks`: checkout, `pnpm/action-setup`, Node 22 with pnpm cache, `pnpm install --frozen-lockfile`, `pnpm turbo run lint test build`. Cache `.turbo` between runs (actions/cache keyed on the lockfile + git sha fallback) so unchanged packages replay from cache.
2. Job `e2e`: service containers `postgres:16-alpine` and `redis:7-alpine`, `pnpm --filter api run db:deploy`, `pnpm --filter api test:e2e`.

**Verify:** push a branch; both jobs green; a second run on the same commit shows Turborepo cache hits.

**Commit:**

```text
ci: turborepo lint test build and e2e workflow
```

## Step 7 — Release v0.1.0

1. Set `"version": "0.1.0"` in the root and app package.json files.
2. `CHANGELOG.md` summarizing the phases as the initial feature set.
3. Tag after committing:

```bash
git tag -a v0.1.0 -m "asobeast 0.1.0: app store tracking, keywords, daily rankings, scoring, competitors, analytics, web ui"
git push --tags
```

**Commit (before tagging):**

```text
chore(release): v0.1.0
```

---

## Acceptance checklist

* [ ] Error envelope + validation verified by e2e; `/docs` complete.
* [ ] Both images build via `turbo prune`; `docker compose up --build` works end to end on a clean machine.
* [ ] README enables a cold start; LICENSE present.
* [ ] CI green with Turborepo caching; tag `v0.1.0` pushed.

```text
docs: mark phase 10 complete
```

---

## Backlog (park ideas here, do not build now)

* **Google Play support**: implement the stub provider with a maintained scraper, register a `gplay` worker + `SCRAPE_GPLAY_RPM`, extend scoring with installs strength and prefix probing suggest score (documented in `formulas.ts`), remove the 501 mapping.
* More regions (schema ready: `country` everywhere; needs per country scheduling and UI).
* Frontend charts: Recharts over `RankingSeries` and `VisibilityHistory`; shadcn/ui adoption.
* Review mining for keyword ideas; SERP snapshots (persist full top 10 per keyword per day).
* Alerts (rank drops, competitor metadata changes) — natural first premium feature.
* Auth + real multi workspace tenancy for the hosted version; runtime configurable API URL for the web image.
* `packages/database` split if a second service ever needs Prisma.
