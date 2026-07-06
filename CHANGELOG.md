# Changelog

All notable changes to asobeast are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

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
