# Phase 2 — Store Providers (App Store live, Google Play stubbed)

**Goal:** the abstraction that makes asobeast maintainable. Everything upstream talks to a `StoreProvider` interface; only this module knows scraper libraries exist. The App Store provider is fully implemented; the Google Play provider is a registered stub that throws a typed error. The URL parser lives in `@asobeast/shared` so the frontend can validate URLs client side later.

**Prerequisites:** Phase 1 complete.

**Install:**

```bash
pnpm --filter api add @perttu/app-store-scraper
```

(No Google Play scraper is installed in v1; the current packages are unmaintained and fragile, which is exactly why the stub exists.)

---

## Step 1 — Contract and shared types

`apps/api/src/store-providers/types.ts` (server side contract; uses the Prisma `Store` enum internally):

```ts
import { Store } from '@prisma/client';

export interface NormalizedApp {
  store: Store;
  storeAppId: string;
  title: string;
  subtitle?: string;      // App Store
  summary?: string;       // Google Play short description (future)
  description: string;
  iconUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
  installs?: bigint;      // Google Play (future)
  price?: number;
  version?: string;
  releasedAt?: Date;
  storeUpdatedAt?: Date;
  raw: unknown;
}

export interface SearchItem {
  storeAppId: string;
  title: string;
  developer?: string;
  ratingAvg?: number;
  ratingCount?: number;
  updatedAt?: Date;       // last store update; feeds the freshness factor in scoring
}

export interface SuggestItem {
  term: string;
  priority?: number;      // App Store: 0..10000, the popularity signal used by scoring
}

export interface StoreProvider {
  readonly store: Store;
  getApp(storeAppId: string, country: string): Promise<NormalizedApp>;
  search(term: string, country: string, num: number): Promise<SearchItem[]>;
  suggest(term: string, country: string): Promise<SuggestItem[]>;
  similar(storeAppId: string, country: string): Promise<SearchItem[]>;
}
```

Typed errors in `apps/api/src/store-providers/errors.ts`: `StoreRequestError` (store, method, cause message) and `StoreNotSupportedError` (store) — the latter is what the Google Play stub throws and what the API later maps to HTTP 501.

**Verify:** `pnpm build` passes.

**Commit:**

```text
feat(providers): define store provider contract and typed errors
```

## Step 2 — Store URL parser in `@asobeast/shared`

Add to the shared package (`packages/shared/src/url-parser.ts`, exported from the index):

`parseStoreUrl(input: string): { store: Store; storeAppId: string; country: string }` where `Store` is the shared string union.

Accepted inputs:

1. `https://apps.apple.com/us/app/anything/id1234567890` (also `itunes.apple.com`) → `APP_STORE`, numeric id from the `/idNNNN` path segment, country from the first two letter path segment, else `DEFAULT_COUNTRY`.
2. `https://play.google.com/store/apps/details?id=com.foo.bar` (optional `&gl=US`) → `GOOGLE_PLAY` (parsed correctly even though scraping is stubbed, so the API can answer "recognized, not yet supported" instead of "invalid").
3. Bare numeric id → `APP_STORE`; bare reverse domain package name → `GOOGLE_PLAY`.
4. Anything else → throw `InvalidStoreUrlError` (exported from shared).

Exhaustive Vitest specs in the shared package: every accepted shape, trailing slashes, uppercase country, query noise, garbage input.

In the api, add a tiny mapper `toPrismaStore(shared: SharedStore): PrismaStore` with a runtime guard (values are identical strings; the guard keeps the boundary honest).

**Verify:** `pnpm --filter @asobeast/shared test` green; `pnpm build` green.

**Commit:**

```text
feat(shared): add store url parser with unit tests
```

## Step 3 — App Store provider (live)

`apps/api/src/store-providers/app-store.provider.ts` using `@perttu/app-store-scraper`:

1. `getApp` → `app({ id, country, ratings: true })`; map `trackId`/`id` → `storeAppId` (string), `title`, `description`, `subtitle` when present, `score` → `ratingAvg`, ratings/reviews count → `ratingCount`, `updated` → `storeUpdatedAt`, `released` → `releasedAt`, `price`, `icon` → `iconUrl`, full payload → `raw`. `installs` stays undefined.
2. `search` → `search({ term, country, num })`; map ids to string, include `ratingAvg`, `ratingCount` and `updatedAt` (from the lookup's current version release date field) when present.
3. `suggest` → map results to `{ term, priority }`, preserving the 0..10000 priority untouched; it is the direct popularity signal for scoring.
4. `similar` → mapped like search.
5. Wrap every call in a small `withRetry` helper (2 retries, 2s/5s delays) rethrowing `StoreRequestError`. Heavy rate limiting lives in the BullMQ worker (Phase 5), not here.
6. Inject the library through the constructor (a thin `AppStoreLib` token) so unit tests pass a fake.

Unit test the field mapping with a mocked library, including: numeric ids stringified, missing subtitle tolerated, priority preserved.

**Verify:** tests green; optional manual smoke via a throwaway script calling `getApp('553834731','us')` (do not commit the script).

**Commit:**

```text
feat(providers): implement app store provider with suggest priority
```

## Step 4 — Google Play provider (stub)

`apps/api/src/store-providers/google-play.provider.ts`: implements `StoreProvider`, every method throws `StoreNotSupportedError(Store.GOOGLE_PLAY)`.

Add a header comment for the future implementer:

```text
Google Play scraping is intentionally deferred. When implementing:
1. Pick a maintained scraper (the classic google-play-scraper is ESM only and
   loosely maintained; expect parser breakage and wrap imports accordingly).
2. Implement this class, register a 'gplay' BullMQ worker with its own
   SCRAPE_GPLAY_RPM limiter, and remove the 501 mapping test.
Nothing outside store-providers/ and jobs/ should need to change.
```

Unit test: each method rejects with `StoreNotSupportedError`.

**Verify:** tests green.

**Commit:**

```text
feat(providers): add google play stub provider pending future support
```

## Step 5 — Provider registry module

`StoreProvidersModule` exposing `StoreProviderRegistry.get(store: Store): StoreProvider` backed by a Map with both providers (the stub included, so lookups never return undefined). Export the registry; import the module where needed (apps, keywords, jobs, scoring).

Unit test: registry returns the right instance per enum value; `get(Store.GOOGLE_PLAY).getApp(...)` rejects with `StoreNotSupportedError`.

**Verify:** tests green.

**Commit:**

```text
feat(providers): expose provider registry for dependency injection
```

---

## Acceptance checklist

* [ ] No file outside `apps/api/src/store-providers/` imports a scraper package.
* [ ] URL parser lives in `@asobeast/shared`, parses both stores plus bare ids, fully tested.
* [ ] App Store provider returns `NormalizedApp` with `raw` populated and preserves suggest priority; `SearchItem.updatedAt` mapped.
* [ ] Google Play stub throws `StoreNotSupportedError` from every method and documents the future path.
* [ ] Lint, tests, build green.

```text
docs: mark phase 2 complete
```
