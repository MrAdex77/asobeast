# asobeast — Implementation Plan for Claude Code (Monorepo Edition)

This folder contains the complete, phased implementation plan for **asobeast**: an open source, self hosted ASO (App Store Optimization) tool for indie developers. It is a **TypeScript monorepo** holding a **NestJS API** and a **Next.js frontend** that share code through internal packages, orchestrated with **pnpm workspaces + Turborepo**, persisted with **Prisma + PostgreSQL**, scheduled with **BullMQ + Redis**, and shipped via **Docker**.

**Store scope for v0.1.0: Apple App Store only.** The architecture, database schema, URL parser and provider contract are built for both stores from day one, but only the App Store provider is implemented. Google Play is a registered stub that returns a clear "not yet supported" error. Rationale: the maintained App Store scraping ecosystem (TypeScript rewrite, official iTunes endpoints, the suggest priority popularity signal) is healthy, while the Google Play packages are stale and fragile. Adding Google Play later means implementing one provider class and registering one worker; nothing else changes.

## Monorepo decisions (researched, do not relitigate mid build)

1. **pnpm workspaces** for package management: strict node_modules (no phantom dependencies), a content addressable store, and the `workspace:*` protocol for internal packages.
2. **Turborepo** for task orchestration: task graph (`build` depends on `^build`), local caching, and `turbo prune --docker` for lean per app Docker builds.
3. **Layout:** `apps/` for deployables (`api`, `web`), `packages/` for shared code and tooling (`shared`, `typescript-config`). Never reach across packages with `../`; always import through the package name.
4. **`@asobeast/shared` is a compiled package** built with tsup (cjs + esm + type declarations). Just in time TS sharing works for Next.js but conflicts with the CommonJS build NestJS requires, so compiling once and consuming built output everywhere is the deterministic choice. Turborepo rebuilds it in watch mode during `pnpm dev`.
5. **Contract types live in `@asobeast/shared`.** Every API response shape the frontend needs is defined there; the API implements those types in its DTOs; the web app types its fetches with them. **Prisma types never leave `apps/api`.**
6. **Prisma stays inside `apps/api`** (single consumer). A `packages/database` split is a future refactor only if a second service ever needs the client.
7. **Ports:** api `4000`, web `3000`.

## How to use this plan with Claude Code

1. Create an empty project folder (for example `asobeast`).
2. Copy `CLAUDE.md` from this plan into the project root (Claude Code reads it every session).
3. Copy this whole folder into the project as `docs/plan/`.
4. Drive Claude Code one phase at a time:

```text
Read CLAUDE.md and docs/plan/phase-0-monorepo.md.
Execute the phase step by step, in order.
After each step: run the verification commands, fix anything that fails,
then create exactly one git commit using the commit message given in the step.
Do not continue to the next step until the current one is verified and committed.
When all steps are done, run the acceptance checklist and report the results.
```

### Rules of engagement

1. **One phase per session** (`/clear` between phases).
2. **One step, one commit**, using the exact message from the plan.
3. **Verify before committing**; review the diff before approving.
4. Tick the phase checklist at the end and commit `docs: mark phase N complete`.
5. If a library API differs from the plan, the plan describes intent; fix reality, keep intent, note the deviation in the commit body.

## Phase map

1. `phase-0-monorepo.md` — pnpm + Turborepo workspace, tooling packages, `@asobeast/shared`, NestJS and Next.js scaffolds, dev Docker, health endpoint.
2. `phase-1-database.md` — Prisma inside `apps/api`, full schema (both stores), migration, seed.
3. `phase-2-store-providers.md` — Provider contract, shared URL parser, **App Store provider (live)**, **Google Play provider (stub)**.
4. `phase-3-apps.md` — Import by store URL, snapshots, refresh with diffing, CRUD.
5. `phase-4-keywords.md` — Extraction, tracked keywords, the manual iOS keyword field, suggestion strategies.
6. `phase-5-jobs-rankings.md` — BullMQ, rate limited App Store worker, daily scheduler, rank capture, history endpoint.
7. `phase-6-scoring.md` — Traffic and difficulty for App Store keywords, weekly scoring, opportunity at read time.
8. `phase-7-competitors.md` — Competitor apps, shared rank capture, comparison and gaps.
9. `phase-8-analytics.md` — Visibility score, app summary, visibility history.
10. `phase-9-frontend-base.md` — Next.js base: typed API client from shared contracts, layout, apps list with import form, app detail with keyword table.
11. `phase-10-polish.md` — Validation, Swagger, `turbo prune` Docker images, full stack compose, README, CI, v0.1.0.

## Definition of done (whole project)

* [ ] `docker compose up` starts web, api, Postgres and Redis; migrations run; `/health` answers; the web UI loads.
* [ ] Pasting an App Store URL imports an app with a metadata snapshot; a Google Play URL returns a friendly 501.
* [ ] Keywords are extracted, trackable and manually addable, including the private iOS keyword field.
* [ ] A daily job records positions (depth 100) for every tracked keyword, app and competitors alike, from one search per keyword.
* [ ] Weekly traffic/difficulty scores exist; opportunity is computed per app at read time.
* [ ] The web app lists apps, imports by URL and shows a keyword table with scores using shared contract types.
* [ ] OpenAPI at `/docs`; CI runs lint, tests and builds through Turborepo.
* [ ] Git history is conventional commits mapped one to one to plan steps.

## Scope guard for v0.1.0

US region only, one workspace, no auth, App Store scraping only, minimal frontend (the owner focuses on backend). Multi tenancy is prepared in the schema, Google Play is prepared in the types, both are switched off. Cloud features (teams, alerts, hosted scraping, billing) live in the backlog at the end of `phase-10-polish.md`.
