# Phase 1 — Database Layer

**Goal:** the complete Prisma schema inside `apps/api` (designed up front for both stores, so later phases rarely touch tables), the initial migration, a global `PrismaService`, and a seeded default workspace.

**Prerequisites:** Phase 0 complete; dev Postgres running. All commands in this phase run against the `api` package (`pnpm --filter api ...` from the root, or plain commands inside `apps/api/`).

---

## Step 1 — Install and initialize Prisma

```bash
pnpm --filter api add -D prisma
pnpm --filter api add @prisma/client
pnpm --filter api exec prisma init
```

Ensure `apps/api/.env` `DATABASE_URL` matches the dev compose credentials. Add convenience scripts to `apps/api/package.json`:

```json
"db:migrate": "prisma migrate dev",
"db:deploy": "prisma migrate deploy",
"db:studio": "prisma studio",
"db:seed": "prisma db seed"
```

Also make the api build self sufficient: `"build": "prisma generate && nest build"` (Turborepo caches the dist output; client generation must precede compilation).

**Verify:** `pnpm --filter api exec prisma validate` reports a valid (still empty) postgresql datasource.

**Commit:**

```text
feat(db): initialize prisma with postgresql datasource
```

## Step 2 — Full schema + initial migration

Replace `apps/api/prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Store {
  GOOGLE_PLAY
  APP_STORE
}

enum KeywordSource {
  TITLE
  SUBTITLE
  DESCRIPTION
  KEYWORD_FIELD
  SUGGESTED
  MANUAL
  COMPETITOR
}

model Workspace {
  id        String   @id @default(cuid())
  name      String   @default("Default")
  apps      App[]
  createdAt DateTime @default(now())
}

model App {
  id           String    @id @default(cuid())
  workspaceId  String
  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  store        Store
  storeAppId   String    // App Store numeric trackId (string) or Google Play package name (future)
  country      String    @default("us")
  name         String?   // convenience copy of the latest title
  iconUrl      String?
  isCompetitor Boolean   @default(false)
  primaryAppId String?   // set when this row is a competitor of another app
  primaryApp   App?      @relation("AppCompetitors", fields: [primaryAppId], references: [id], onDelete: Cascade)
  competitors  App[]     @relation("AppCompetitors")
  snapshots    AppSnapshot[]
  tracked      TrackedKeyword[]
  rankings     KeywordRanking[]
  createdAt    DateTime  @default(now())

  @@unique([workspaceId, store, storeAppId, country])
  @@index([workspaceId])
  @@index([primaryAppId])
}

model AppSnapshot {
  id             String    @id @default(cuid())
  appId          String
  app            App       @relation(fields: [appId], references: [id], onDelete: Cascade)
  title          String
  subtitle       String?   // App Store subtitle
  summary        String?   // Google Play short description (future)
  description    String
  ratingAvg      Float?
  ratingCount    Int?
  installs       BigInt?   // Google Play only (future); null for App Store
  price          Float?
  version        String?
  releasedAt     DateTime?
  storeUpdatedAt DateTime?
  raw            Json      // full scraper payload, for reprocessing
  capturedAt     DateTime  @default(now())

  @@index([appId, capturedAt])
}

model Keyword {
  id        String           @id @default(cuid())
  text      String
  store     Store
  country   String           @default("us")
  metrics   KeywordMetric[]
  tracked   TrackedKeyword[]
  rankings  KeywordRanking[]
  createdAt DateTime         @default(now())

  @@unique([text, store, country])
}

model TrackedKeyword {
  appId     String
  app       App           @relation(fields: [appId], references: [id], onDelete: Cascade)
  keywordId String
  keyword   Keyword       @relation(fields: [keywordId], references: [id], onDelete: Cascade)
  source    KeywordSource
  active    Boolean       @default(true)
  createdAt DateTime      @default(now())

  @@id([appId, keywordId])
  @@index([keywordId])
}

model KeywordMetric {
  keywordId  String
  keyword    Keyword  @relation(fields: [keywordId], references: [id], onDelete: Cascade)
  date       DateTime @db.Date
  traffic    Float?   // 0..10
  difficulty Float?   // 0..10
  stats      Json?    // raw factor values, kept for retuning the formulas
  createdAt  DateTime @default(now())

  @@id([keywordId, date])
}

model KeywordRanking {
  appId     String
  app       App      @relation(fields: [appId], references: [id], onDelete: Cascade)
  keywordId String
  keyword   Keyword  @relation(fields: [keywordId], references: [id], onDelete: Cascade)
  date      DateTime @db.Date
  position  Int?     // 1 based; null = not found within depth
  depth     Int      @default(100)
  createdAt DateTime @default(now())

  @@id([appId, keywordId, date])
  @@index([keywordId, date])
  @@index([appId, date])
}
```

Then `pnpm --filter api run db:migrate -- --name init` (or run `prisma migrate dev --name init` inside `apps/api`). Commit schema and migration together.

Design notes to preserve as code comments:

1. Both stores exist in the schema even though only APP_STORE is scraped in v1; the Prisma enum values match the `Store` union in `@asobeast/shared` exactly, which lets the API map by string with a runtime guard.
2. `KeywordMetric` is per keyword (store+country scoped); opportunity is derived per app at read time.
3. Composite primary keys on the time series tables make daily upserts idempotent.

**Verify:** migration applies; `pnpm --filter api run db:studio` shows all tables.

**Commit:**

```text
feat(db): add core schema and initial migration
```

## Step 3 — Global PrismaService

`apps/api/src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

Wrap in a `@Global()` `PrismaModule` exporting the service; import once in `AppModule`.

**Verify:** api boots with the database up.

**Commit:**

```text
feat(db): add global prisma service module
```

## Step 4 — Database aware health check

Extend `GET /health` to run `SELECT 1` through Prisma: `{ status, db: "up" | "down" }`, HTTP 503 when down. Define the response type `HealthStatus` in `@asobeast/shared` (first contract type; the web footer will consume it in Phase 9).

**Verify:** healthy with Postgres up; stop the container → 503; start again.

**Commit:**

```text
feat(api): include database status in health check
```

## Step 5 — Seed the default workspace

`apps/api/prisma/seed.ts` upserting a fixed id workspace:

```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.workspace.upsert({
    where: { id: 'ws_default' },
    update: {},
    create: { id: 'ws_default', name: 'Default' },
  });
}

main().finally(() => prisma.$disconnect());
```

Wire in `apps/api/package.json`:

```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```

(add `ts-node` as a dev dependency if missing). Export `DEFAULT_WORKSPACE_ID = 'ws_default'` from `apps/api/src/common/workspace.ts`; all v1 services use it instead of resolving tenants.

**Verify:** `pnpm --filter api run db:seed` twice; idempotent; row visible in Studio.

**Commit:**

```text
feat(db): seed default workspace for single tenant v1
```

---

## Acceptance checklist

* [ ] From scratch (`docker compose -f docker-compose.dev.yml down -v` then up): migrate + seed succeed.
* [ ] Tables, enums, uniques and indexes match the schema above; `Store` enum values equal the shared union values.
* [ ] `/health` reflects real database connectivity and returns the shared `HealthStatus` shape.
* [ ] `pnpm build` still passes (prisma generate wired into the api build).
* [ ] Lint, tests, build green.

```text
docs: mark phase 1 complete
```
