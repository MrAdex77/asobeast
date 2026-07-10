# Changelog

All notable changes to asobeast are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## 0.2.0

The full ASO dashboard: the web app now surfaces every capability the API
exposes, built on TanStack Query, nuqs URL state, shadcn/ui and Recharts, with
light/dark mode. The backend is unchanged.

### Added

- **Apps dashboard** — apps grid rebuilt on the query layer, import dialog,
  delete with confirmation, and skeleton/empty/error states.
- **App overview** — a nested app layout with section navigation, stat cards, a
  themed visibility area chart, a rank distribution chart, keyword movers and
  metadata coverage, plus refresh (with a snapshot diff dialog) and run-daily
  actions.
- **Keywords workspace** — a URL-sorted table with per-row toggle/score/delete,
  an add dialog, keyword suggestions across all strategies, and the private iOS
  keyword field editor.
- **Rankings** — a multi-series ranking history chart with a reversed axis
  (`>100` for not found), keyword picker and date-range presets.
- **Competitors** — competitor management and a comparison matrix with a gap
  filter.
- **Polish** — per-route loading and error boundaries that recover via retry,
  per-section Suspense fallbacks, a responsive and accessibility pass, and dark
  mode via `next-themes`.

### Changed

- Server state and cache invalidation now flow through TanStack Query;
  `router.refresh()` is gone, the query cache owns freshness.

## 0.1.0

First public release: a self hosted App Store Optimization toolkit for indie
iOS developers. App Store and US region only; Google Play is architecturally
prepared but stubbed.

### Added

- **Monorepo base** — pnpm workspaces + Turborepo, TypeScript strict everywhere,
  `@asobeast/shared` contract package (tsup) and shared tsconfigs.
- **Database layer** — Prisma + PostgreSQL 16 schema for workspaces, apps,
  snapshots, keywords, metrics and rankings, with a seeded default workspace.
- **Store providers** — a `StoreProvider` abstraction isolating all scraping;
  the App Store provider is live, Google Play is a stub returning HTTP 501.
- **Apps** — import from a store URL, metadata snapshots, refresh with snapshot
  diffs, and delete.
- **Keywords** — automatic title/subtitle extraction, manual tracking, the
  private 100 character iOS keyword field, and keyword suggestions.
- **Jobs and rankings** — BullMQ + Redis queues, a rate limited App Store worker,
  daily and weekly schedulers, and daily rank capture with history (one search
  serving the primary app and all competitors).
- **Scoring** — pure traffic and difficulty formulas using the Apple suggest
  priority signal, with per app opportunity computed in the read layer.
- **Competitors** — track rival apps and compare keyword coverage with gap
  analysis.
- **Analytics** — visibility score, dashboard summary and visibility history.
- **Web UI** — Next.js App Router frontend for imports, keywords, competitors
  and summaries.
- **Polish and release** — global validation with a consistent `ApiErrorEnvelope`,
  OpenAPI docs at `/docs`, production Docker images built via `turbo prune`, a
  one command full stack `docker compose`, a project README, and CI running
  lint, test, build and e2e through Turborepo.
