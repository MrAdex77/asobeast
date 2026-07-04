# Phase 4 — Keywords

**Goal:** turn app metadata into a tracked keyword set: extraction from title/subtitle, manual additions, the private iOS keyword field (now the centerpiece, since v1 is App Store first), and suggestion strategies powered by autocomplete and similar apps.

**Contract rule:** `TrackedKeywordItem`, `KeywordFieldResult` and `KeywordSuggestion` are defined in `@asobeast/shared` and implemented by the api DTOs. Normalization helpers used by extraction also live in shared (`normalizeText`, `tokenize`), so the web app can preview normalization later.

**Prerequisites:** Phase 3 complete.

---

## Step 1 — Extraction utility (pure, tested)

Normalization primitives go to `packages/shared/src/text.ts` (lowercase, strip punctuation and emoji, collapse whitespace, tokenize, a ~120 word English stopword list including store noise like `app`, `free`, `best`, `new`, `official`). Vitest specs in shared.

Extraction itself in `apps/api/src/keywords/extraction.ts`:

```ts
export interface ExtractionInput {
  title: string;
  subtitle?: string;   // App Store
  summary?: string;    // Google Play short description (future)
}

export interface Candidate {
  text: string;
  source: 'TITLE' | 'SUBTITLE' | 'DESCRIPTION';
  weight: number;      // TITLE 3, SUBTITLE 2, DESCRIPTION 1
}

export function extractCandidates(input: ExtractionInput): Candidate[];
```

Algorithm: normalize each field; drop tokens shorter than 2 chars and stopwords; build ngrams of size 1, 2 and 3 in original order without crossing separators (`:` `.` `,` `|` `&`); dedupe keeping the highest weight source (summary maps to `DESCRIPTION`); sort by weight desc then ngram size desc; cap 60.

Jest fixtures: a game title with subtitle, a utility app, a one word brand title; assert exact top candidates.

**Verify:** shared and api tests green.

**Commit:**

```text
feat(keywords): add metadata keyword extraction utility
```

## Step 2 — Auto track on import and refresh

`KeywordsService.syncFromSnapshot(appId)`:

1. Extract from the latest snapshot.
2. For `TITLE`/`SUBTITLE` candidates (cap 15): upsert `Keyword` (text+store+country) and `TrackedKeyword` with matching source, `active: true`. Never downgrade rows the user already modified.
3. `DESCRIPTION` candidates are not auto tracked; they surface via suggestions (Step 5).

Call from the apps service at the end of import and refresh (skipped for competitors later).

**Verify:** import a real app; sensible `TrackedKeyword` rows; refresh does not duplicate or flip user modified rows.

**Commit:**

```text
feat(keywords): auto track title and subtitle keywords on import
```

## Step 3 — Tracked keyword management endpoints

```text
GET    /apps/:id/keywords                 list (TrackedKeywordItem[])
POST   /apps/:id/keywords                 add manual keywords
PATCH  /apps/:id/keywords/:keywordId      toggle { active }
DELETE /apps/:id/keywords/:keywordId      stop tracking (history rows stay)
```

1. `TrackedKeywordItem`: text, source, active, `latestPosition` (most recent `KeywordRanking`, null safe), `positionDelta7d`, latest `traffic`/`difficulty`, `opportunity` (all null until Phases 5 and 6 fill them; the contract is stable from day one).
2. `POST` body `{ "keywords": ["habit tracker", "streak counter"] }` → normalize with the shared helpers, upsert as `MANUAL`. Reject empty strings and phrases over 5 words with 400.
3. `DELETE` removes only the `TrackedKeyword` row; `Keyword`, metrics and rankings stay.

**Verify:** curl all four; nulls present but shaped.

**Commit:**

```text
feat(keywords): manage tracked keywords via crud endpoints
```

## Step 4 — Manual iOS keyword field

The App Store keyword field (100 chars, comma separated) is private and cannot be scraped; the owner pastes it. With v1 being App Store first, this is a headline feature, not a corner case.

`PUT /apps/:id/keyword-field` body `{ "text": "habit,tracker,streak,daily goals" }`:

1. Guard: only for `APP_STORE` apps (400 otherwise; future proofing).
2. Split on commas, trim, normalize, drop empties; upsert each as `TrackedKeyword` with source `KEYWORD_FIELD`.
3. Deactivate (not delete) previously `KEYWORD_FIELD` sourced rows no longer present, so the field is editable over time.
4. Respond with `KeywordFieldResult` (shared): `{ tracked, charactersUsed, charactersLimit: 100, duplicatesRemoved }` — the character counter is a genuinely useful ASO helper and gets UI treatment in Phase 9.

**Verify:** put the field twice with different content; sources and active flags behave as described.

**Commit:**

```text
feat(keywords): support manual ios keyword field input
```

## Step 5 — Suggestion strategies

`GET /apps/:id/keywords/suggestions?strategy=metadata|search|similar&limit=30`

1. `metadata` (default, zero network): extraction candidates not currently tracked, including `DESCRIPTION` ones.
2. `search`: up to 5 tracked seeds (highest weight first) → `provider.suggest(seed, country)` each; merge, drop tracked, keep the App Store `priority`. Live autocomplete expansion; on the App Store the priority makes these suggestions pre ranked by popularity for free.
3. `similar`: `provider.similar(...)`, extraction over returned titles, return the most common candidates with `usedByCount`.

Response items: `KeywordSuggestion` (shared): `{ text, strategy, priority?, usedByCount? }`. Accepting a suggestion is just the `POST` from Step 3.

Note: `search` and `similar` hit the store live from the API process; acceptable (a handful of user initiated requests). Bulk scheduled work stays in the Phase 5 queue.

**Verify:** all three strategies return plausible lists for a real app; tracked terms excluded; priorities present for `search`.

**Commit:**

```text
feat(keywords): suggestion strategies via metadata autocomplete and similar apps
```

---

## Acceptance checklist

* [ ] Normalization helpers live in `@asobeast/shared` with Vitest coverage; extraction is pure with Jest fixtures.
* [ ] Import auto tracks title/subtitle keywords; description terms only as suggestions.
* [ ] Manual add, toggle, delete work; deletes keep history.
* [ ] iOS keyword field round trips with character accounting.
* [ ] Three suggestion strategies work; App Store suggestions carry priority.
* [ ] Contract types (`TrackedKeywordItem`, `KeywordFieldResult`, `KeywordSuggestion`) in shared.
* [ ] Lint, tests, build green.

```text
docs: mark phase 4 complete
```
