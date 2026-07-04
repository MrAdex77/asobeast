# Phase 3 — Apps Module

**Goal:** the first product feature. A user pastes an App Store URL; asobeast fetches the app, stores it with a metadata snapshot, and can refresh it later, reporting what changed. Google Play URLs are recognized and politely declined with 501.

**Contract rule (applies here and in every later phase):** response shapes the frontend will consume are defined as interfaces in `@asobeast/shared` (this phase: `AppListItem`, `AppDetail`, `SnapshotDiffResult`) and implemented by the api DTOs.

**Prerequisites:** Phase 2 complete.

---

## Step 1 — BigInt JSON serialization

Prisma returns `installs` as `BigInt` (kept for future Google Play), which `JSON.stringify` rejects. In `apps/api/src/main.ts`, before app creation:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};
```

Comment: install counts fit safely in a JS number (max observed ~1e10 vs Number.MAX_SAFE_INTEGER ~9e15).

**Verify:** build passes.

**Commit:**

```text
fix(api): serialize bigint values in json responses
```

## Step 2 — Import an app from a store URL

Create `apps/api/src/apps/` (module, controller, service, DTOs).

`POST /apps` body: `{ "url": "https://apps.apple.com/us/app/some-app/id1234567890" }`

Service logic (`importFromUrl`):

1. `parseStoreUrl(url)` from `@asobeast/shared` → `{ store, storeAppId }`; force `country = DEFAULT_COUNTRY` for v1 regardless of the URL segment and mention that in the response.
2. If `store` is not in `SUPPORTED_STORES` (shared constant) → throw `StoreNotSupportedError`, mapped to **501** with message "Google Play support is planned; asobeast currently tracks App Store apps only". This is a distinct, honest error, not a 400.
3. Otherwise fetch via `registry.get(store).getApp(storeAppId, country)`.
4. In one transaction: upsert `App` (unique on workspace+store+storeAppId+country, `workspaceId = DEFAULT_WORKSPACE_ID`), refresh `name`/`iconUrl` convenience fields, insert an `AppSnapshot` from the `NormalizedApp`. Reimporting an existing app refreshes it (idempotent import).
5. Return the app with its latest snapshot (`AppDetail` shape from shared).

Error mapping: `InvalidStoreUrlError` → 400 with a helpful message; `StoreNotSupportedError` → 501; `StoreRequestError` → 502 `{ store, message }`.

**Verify:** with dev containers running, import one real App Store app via curl; rows appear with `raw` populated; a Google Play URL returns 501 with the friendly message; garbage returns 400.

**Commit:**

```text
feat(apps): import app from store url with initial snapshot
```

## Step 3 — List, detail, delete

1. `GET /apps` → non competitor apps of the default workspace as `AppListItem[]`: id, store, name, iconUrl, latest snapshot basics (ratingAvg, ratingCount, capturedAt), counts of tracked keywords and competitors.
2. `GET /apps/:id` → `AppDetail`: app + latest snapshot + competitor list (empty for now).
3. `DELETE /apps/:id` → schema cascades remove competitors, snapshots, tracked keywords and rankings.

Prisma models never leak: a mapping layer converts to the shared shapes.

**Verify:** curl all three; delete removes dependent rows.

**Commit:**

```text
feat(apps): add list detail and delete endpoints
```

## Step 4 — Refresh with snapshot diffing

`POST /apps/:id/refresh`:

1. Fetch fresh data through the provider; insert a new `AppSnapshot`.
2. Diff against the previous snapshot across `title`, `subtitle`, `summary`, `description` (changed flag plus old/new lengths, not full texts), `ratingAvg`, `ratingCount`, `installs`, `version`.
3. Return `SnapshotDiffResult` (shared): `{ snapshotId, changes: [{ field, before, after }] }`, empty array when nothing changed.

Extract `diffSnapshots(prev, next)` as a pure function in `apps/api/src/apps/snapshot-diff.ts` with unit tests (changed title, unchanged everything, first snapshot). Keep the service method `refreshApp(appId)` reusable; the daily job (Phase 5) calls it.

**Verify:** refresh a real app twice; unit tests green.

**Commit:**

```text
feat(apps): add manual refresh with snapshot diffing
```

## Step 5 — e2e coverage with mocked providers

`apps/api/test/apps.e2e-spec.ts`:

1. Testing module overrides `StoreProviderRegistry` with a fake returning canned `NormalizedApp` fixtures (App Store) and the real stub behavior for Google Play.
2. Cover: import creates app + snapshot; reimport idempotent; Google Play URL → 501; invalid URL → 400; provider failure → 502; delete cascades.
3. Dedicated test database: `apps/api/test/.env.test` overrides `DATABASE_URL`; setup runs `prisma migrate deploy` and truncates tables between tests.

**Verify:** `pnpm --filter api test:e2e` green.

**Commit:**

```text
test(apps): e2e coverage for import refresh and delete
```

---

## Acceptance checklist

* [ ] App Store URL import works end to end; reimport is idempotent.
* [ ] Google Play URL → 501 with the planned support message; bad URL → 400; store failure → 502.
* [ ] `AppListItem`, `AppDetail`, `SnapshotDiffResult` defined in `@asobeast/shared` and implemented by api DTOs.
* [ ] Diff logic pure and unit tested; e2e green against a test database.
* [ ] Lint, tests, e2e, build green.

```text
docs: mark phase 3 complete
```
