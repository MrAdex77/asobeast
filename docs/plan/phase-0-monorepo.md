# Phase 0 — Monorepo Base

**Goal:** a professional pnpm + Turborepo workspace containing four packages: `api` (NestJS), `web` (Next.js), `@asobeast/shared` (compiled tsup package) and `@asobeast/typescript-config`. Plus dev containers and a health endpoint. After this phase, `pnpm dev` boots everything and the shared package flows into both apps.

**Prerequisites:** empty git repository containing `CLAUDE.md` and `docs/plan/`. Node 22+, pnpm 10+ installed (`corepack enable` or standalone install), Docker available.

---

## Step 1 — Repository hygiene

Create root `.gitignore`:

```text
node_modules/
dist/
.next/
.turbo/
coverage/
.env
.env.*.local
*.log
.DS_Store
```

And a root `README.md` stub:

```markdown
# asobeast

Open source, self hosted ASO toolkit. App Store first, Google Play planned.
Monorepo: NestJS API + Next.js web + shared TypeScript packages.
Work in progress. See docs/plan for the implementation plan.
```

**Verify:** `git status` shows only intended files.

**Commit:**

```text
chore: initialize repository with gitignore and readme stub
```

## Step 2 — pnpm workspace + Turborepo

1. Root `package.json` (private, no app code at root):

```json
{
  "name": "asobeast",
  "private": true,
  "packageManager": "pnpm@10.12.1",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\""
  }
}
```

(Use the currently installed pnpm 10.x version in `packageManager`.)

2. `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

3. `pnpm add -D -w turbo prettier` and create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "persistent": true,
      "cache": false
    },
    "lint": {},
    "test": { "dependsOn": ["^build"] },
    "test:e2e": { "dependsOn": ["^build"], "cache": false }
  }
}
```

4. Create empty `apps/` and `packages/` directories (with `.gitkeep`).

**Verify:** `pnpm install` succeeds; `pnpm turbo --version` prints a 2.x version.

**Commit:**

```text
feat(repo): configure pnpm workspace with turborepo
```

## Step 3 — Shared TypeScript config package

`packages/typescript-config/` with `package.json`:

```json
{
  "name": "@asobeast/typescript-config",
  "version": "0.0.0",
  "private": true,
  "files": ["*.json"]
}
```

Three configs:

1. `base.json` — `strict: true`, `esModuleInterop`, `skipLibCheck`, `forceConsistentCasingInFileNames`, `moduleResolution: "bundler"` is NOT used here; keep `"module": "commonjs"` out of base (apps decide), set `target: "ES2022"`, `lib: ["ES2022"]`, `declaration: true`, `resolveJsonModule: true`.
2. `nest.json` — extends base; `module: "commonjs"`, `emitDecoratorMetadata: true`, `experimentalDecorators: true`, `outDir` left to the app.
3. `next.json` — extends base; `jsx: "preserve"`, `module: "esnext"`, `moduleResolution: "bundler"`, `noEmit: true`, `lib` adds `dom`.

**Verify:** `pnpm install` links the package (it will be consumed in the next steps).

**Commit:**

```text
feat(repo): add shared typescript config package
```

## Step 4 — `@asobeast/shared` (compiled package)

`packages/shared/`:

```json
{
  "name": "@asobeast/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts --clean",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "test": "vitest run",
    "lint": "eslint src"
  },
  "devDependencies": {
    "@asobeast/typescript-config": "workspace:*",
    "tsup": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

`tsconfig.json` extends `@asobeast/typescript-config/base.json`. First real content in `src/index.ts`:

```ts
export const STORES = ['APP_STORE', 'GOOGLE_PLAY'] as const;
export type Store = (typeof STORES)[number];

/** Stores actively scraped in this version. */
export const SUPPORTED_STORES: readonly Store[] = ['APP_STORE'];

export const DEFAULT_COUNTRY = 'us';
```

Add a trivial Vitest spec asserting `SUPPORTED_STORES` contains only `APP_STORE`, plus a minimal eslint flat config for the package.

Design rule (comment it at the top of `index.ts`): this package is runtime agnostic and dependency light; it holds contract types, the `Store` union, the URL parser (Phase 2), normalization helpers and constants. Never Nest, Next or Prisma imports.

**Verify:** `pnpm --filter @asobeast/shared build` produces `dist/index.js`, `dist/index.mjs`, `dist/index.d.ts`; `pnpm --filter @asobeast/shared test` green.

**Commit:**

```text
feat(shared): scaffold compiled shared package with tsup and vitest
```

## Step 5 — NestJS app (`apps/api`)

1. From `apps/`: `pnpm dlx @nestjs/cli@latest new api --package-manager pnpm --skip-git`. Set the package name in `apps/api/package.json` to `"api"`.
2. `tsconfig.json` extends `@asobeast/typescript-config/nest.json` (keep Nest specific compiler options the CLI generated that the shared config does not cover).
3. Add the shared dependency and prove the link: `pnpm --filter api add "@asobeast/shared@workspace:*"`, then log `SUPPORTED_STORES` once at bootstrap in `main.ts`.
4. Listen on `process.env.PORT ?? 4000` (final config handling arrives in Step 7).
5. Strip demo controller/service tests to a minimal green suite.
6. Ensure `apps/api/package.json` scripts exist: `dev` (nest start --watch), `build`, `lint`, `test`, `test:e2e`.

**Verify:** `pnpm --filter api dev` boots on 4000 and logs the shared constant (Turborepo builds `@asobeast/shared` first thanks to `dependsOn: ["^build"]`).

**Commit:**

```text
feat(api): scaffold nestjs application in monorepo
```

## Step 6 — Next.js app (`apps/web`)

1. From the root: `pnpm create next-app@latest apps/web --typescript --eslint --app --src-dir --tailwind --import-alias "@/*" --use-pnpm`. Set the package name to `"web"`.
2. `tsconfig.json` extends `@asobeast/typescript-config/next.json`, preserving the Next plugin entries the scaffold generated.
3. `pnpm --filter web add "@asobeast/shared@workspace:*"`; on the home page render a small "supported stores: APP_STORE" line imported from shared, proving the compiled package is consumed by the frontend too.
4. Web runs on port 3000 (Next default); scripts `dev`, `build`, `lint` exist.

**Verify:** `pnpm dev` from the root runs shared (watch), api (4000) and web (3000) together; the home page shows the shared constant; editing `packages/shared/src/index.ts` propagates after the tsup rebuild.

**Commit:**

```text
feat(web): scaffold nextjs application in monorepo
```

## Step 7 — Typed environment configuration (api)

1. `pnpm --filter api add @nestjs/config zod`.
2. `apps/api/src/config/env.ts`: zod schema for DATABASE_URL, REDIS_HOST, REDIS_PORT, PORT (default 4000), DEFAULT_COUNTRY, CRON_DAILY, CRON_SCORING, SCRAPE_ITUNES_RPM (default 15), BULL_BOARD_ENABLED, LOG_LEVEL (defaults per `CLAUDE.md`). Numbers via `z.coerce.number()`.
3. `ConfigModule.forRoot({ isGlobal: true, validate: (env) => EnvSchema.parse(env) })` so the app refuses to boot on invalid config.
4. `apps/api/.env.example` with every variable; local `.env` untracked. Also create `apps/web/.env.example` with `NEXT_PUBLIC_API_URL=http://localhost:4000`.

**Verify:** break `PORT=abc`, confirm a clear startup error, restore.

**Commit:**

```text
feat(api): add typed environment configuration with zod validation
```

## Step 8 — Dev containers for Postgres and Redis

Root `docker-compose.dev.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: asobeast
      POSTGRES_PASSWORD: asobeast
      POSTGRES_DB: asobeast
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U asobeast"]
      interval: 5s
      timeout: 3s
      retries: 10
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10
volumes:
  pgdata:
```

**Verify:** `docker compose -f docker-compose.dev.yml up -d` → both healthy.

**Commit:**

```text
feat(docker): add development compose for postgres and redis
```

## Step 9 — Health endpoint (api)

`apps/api/src/health/` with `GET /health` returning `{ status: "ok", uptime, timestamp }`. Database and Redis checks are added when those connections exist.

**Verify:** `curl -s http://localhost:4000/health`.

**Commit:**

```text
feat(api): add health check endpoint
```

---

## Acceptance checklist

* [x] `pnpm lint`, `pnpm test`, `pnpm build` pass from the root through Turborepo.
* [x] `pnpm dev` runs shared (watch) + api (4000) + web (3000); both apps import from `@asobeast/shared`.
* [x] Turborepo caches: a second `pnpm build` with no changes is a full cache hit.
* [x] Dev Postgres and Redis healthy; `/health` answers; `.env.example` files exist in both apps.
* [x] Nine commits above, in order.

```text
docs: mark phase 0 complete
```
