# Phase 9 — Frontend Base (Next.js)

**Goal:** a deliberately small but real frontend proving the monorepo contract end to end: a typed API client built on `@asobeast/shared` types, a layout shell, an apps list with URL import, and an app detail page with the keyword table. No chart library yet, no design system yet; the owner's focus stays on the backend. Everything here is App Router with server components fetching by default and small client components only where interaction demands it.

**Prerequisites:** Phase 8 complete; api running on 4000.

---

## Step 1 — Consolidate the shared API contracts

Before building UI, audit `@asobeast/shared` and make sure every contract the frontend needs actually lives there (they were introduced phase by phase; consolidate now):

`HealthStatus`, `AppListItem`, `AppDetail`, `SnapshotDiffResult`, `TrackedKeywordItem`, `KeywordFieldResult`, `KeywordSuggestion`, `RankingSeries`, `CompetitorItem`, `KeywordComparison`, `AppSummary`, `VisibilityHistory`, plus `ApiErrorEnvelope` (`{ statusCode, error, message, path, timestamp }`, formalized in Phase 10 Step 1 but declared now).

Group them under `packages/shared/src/contracts/` with a barrel export; verify each api DTO `implements` its contract (fix drift where found). No behavior changes.

**Verify:** `pnpm build` and all tests green; `grep` shows no frontend relevant response type defined only inside `apps/api`.

**Commit:**

```text
refactor(shared): consolidate api contract types
```

## Step 2 — Typed API client

`apps/web/src/lib/api.ts`:

```ts
import type { ApiErrorEnvelope } from '@asobeast/shared';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public readonly envelope: ApiErrorEnvelope) {
    super(envelope.message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(await res.json());
  return res.json() as Promise<T>;
}
```

Plus thin typed wrappers (`getApps(): Promise<AppListItem[]>`, `getApp(id)`, `importApp(url)`, `getKeywords(appId, sort?)`, `getSummary(appId)`) so pages never call `apiFetch` with string literals twice. `cache: 'no-store'` everywhere for v1 (live dashboard data; revisit caching later).

**Verify:** a temporary server component logging `getApps()` renders without type casts.

**Commit:**

```text
feat(web): typed api client with error handling
```

## Step 3 — Layout shell

1. Root layout: header with the asobeast wordmark linking home, a muted footer showing API status via `HealthStatus` (server fetched, `try/catch` to "api unreachable").
2. Tailwind only, no component library (backlog: shadcn/ui). Keep a tiny `components/` folder: `Card`, `Badge`, `EmptyState`.
3. Sensible metadata (`title: 'asobeast'`), dark friendly neutral palette, nothing fancy.

**Verify:** `pnpm --filter web dev` renders the shell; killing the api flips the footer status.

**Commit:**

```text
feat(web): base layout and navigation shell
```

## Step 4 — Apps list with import form

Page `/` (server component):

1. Fetch `getApps()`; render cards (icon, name, rating, tracked keyword count, competitor count) linking to `/apps/[id]`; `EmptyState` when none.
2. `ImportAppForm` (client component): one URL input + submit; calls `importApp(url)`; on success `router.refresh()`; on `ApiError` show `envelope.message` inline. The 501 Google Play message ("support is planned") must render as an informative note, not a scary error; branch on `statusCode === 501`.
3. Validate before submitting using `parseStoreUrl` from `@asobeast/shared` in a `try/catch`: instant client side feedback, same logic as the server, zero duplication. This is the shared package earning its keep.

**Verify:** import a real App Store URL from the browser; the list updates; a Google Play URL shows the friendly note; garbage shows the parser message without a network call.

**Commit:**

```text
feat(web): apps list with store url import form
```

## Step 5 — App detail with keyword table

Page `/apps/[id]` (server component):

1. Header: icon, name, store badge, buttons calling `POST /apps/:id/refresh` and `POST /apps/:id/run-daily` (small client components with pending states).
2. Summary strip from `getSummary(appId)`: visibility (current + 7d delta), rank distribution counts, tracked keywords, competitors, last refresh.
3. Keyword table from `getKeywords(appId, sort)`: text, source badge, position, 7d delta (arrow up/down/flat), traffic, difficulty, opportunity. Column header links set `?sort=` (server side sorting via the existing endpoint).
4. Charts are out of scope here; add a visible "history charts coming soon" placeholder and a backlog note (Recharts over `RankingSeries` and `VisibilityHistory`).

**Verify:** with a scored app, the page shows real numbers; sorting works via query param; refresh button creates a new snapshot.

**Commit:**

```text
feat(web): app detail with summary strip and keyword table
```

---

## Acceptance checklist

* [ ] Every fetch in `apps/web` is typed by `@asobeast/shared` contracts; zero `any`, zero locally redefined response types.
* [ ] Client side URL validation reuses the shared parser.
* [ ] Import, list, detail, sort, refresh and run daily all work from the browser against the local api.
* [ ] The 501 Google Play path renders as an informative note.
* [ ] Lint, tests, build green across the workspace.

```text
docs: mark phase 9 complete
```
