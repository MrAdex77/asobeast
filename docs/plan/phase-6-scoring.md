# Phase 6 — Keyword Scoring (App Store)

**Goal:** traffic (popularity) and difficulty per keyword on a 0..10 scale, refreshed weekly, with every raw factor persisted so formulas can be retuned without rescraping. Opportunity derived per app at read time.

The model follows the approach popularized by the open source `aso` package: difficulty from what the top results look like, traffic from autocomplete behavior plus top result strength. On the App Store this is unusually cheap and unusually good: Apple's suggest endpoint returns a priority from 0 (low traffic) to 10000 (most searched), a direct popularity signal, and search results already include rating counts, so **scoring costs about 2 requests per keyword** (one search, one suggest).

**Prerequisites:** Phase 5 complete.

---

## Step 1 — Pure scoring functions

`apps/api/src/scoring/formulas.ts`. Pure, unit tested, no I/O.

Helpers:

```ts
export const clamp = (v: number, lo = 0, hi = 10) => Math.min(hi, Math.max(lo, v));
export const linear = (v: number, min: number, max: number) =>
  clamp(((v - min) / (max - min)) * 10);
export const logScale = (v: number, min: number, max: number) =>
  v <= 0 ? 0 : linear(Math.log10(v), Math.log10(min), Math.log10(max));
```

Input stats shape (persisted verbatim into `KeywordMetric.stats`):

```ts
export interface KeywordStats {
  keywordText: string;
  top10: Array<{
    title: string;
    ratingCount?: number;     // App Store strength signal
    ratingAvg?: number;
    daysSinceUpdate?: number; // from SearchItem.updatedAt
  }>;
  top30TitleMatchCount: number; // results 1..30 whose title contains all keyword words
  suggest: {
    priority?: number;          // exact term match, 0..10000
    partialPriority?: number;   // best priority among suggestions containing the term
  };
}
```

Component scores:

```text
titleMatchScore   per top10 title: exact phrase → 10, all words present → 7,
                  some words → 4, none → 0; average.
strengthScore     logScale(avg top10 ratingCount, min 100, max 2_000_000)
competitorsScore  clamp(top30TitleMatchCount / 3)          // 30 matches → 10
freshnessScore    clamp(10 - avgDaysSinceUpdate / 9)        // updated ≤ ~90 days → high

difficulty = clamp(0.35 * titleMatchScore
                 + 0.30 * strengthScore
                 + 0.20 * competitorsScore
                 + 0.15 * freshnessScore)

suggestScore      exact priority present → clamp(priority / 1000)
                  only partial          → clamp(partialPriority / 2000)
                  neither               → 1
lengthScore       chars ≤ 7 → 10, linear down to 2 at 25 chars

traffic = clamp(0.50 * suggestScore
              + 0.30 * strengthScore
              + 0.20 * lengthScore)
```

Export `computeDifficulty(stats)`, `computeTraffic(stats)` and a single `WEIGHTS` constant. Leave a short comment block titled "Google Play (future)" describing the planned differences: strength from installs (logScale 1e3..1e8) and suggestScore from prefix probing (fewest characters needed for the keyword to appear as a suggestion, plus its position) since Google Play returns no priority.

Jest fixtures: a huge generic keyword (high traffic, high difficulty), a niche long tail phrase (low/low), an achievable mid keyword; assert component values and finals to 2 decimals.

**Verify:** tests green.

**Commit:**

```text
feat(scoring): pure traffic and difficulty formulas with tunable weights
```

## Step 2 — Stats collection service

`apps/api/src/scoring/stats-collector.service.ts` with `collect(keywordId): Promise<KeywordStats>`, invoked **only from the `appstore` worker**:

1. `search(text, country, 100)` → `top30TitleMatchCount` from titles; keep the first 10 items with `ratingCount`, `ratingAvg`, and `daysSinceUpdate` computed from `SearchItem.updatedAt` (already mapped in Phase 2; no per app follow up calls needed).
2. `suggest(text, country)` → exact `priority` when the term itself is in the list, else best `partialPriority` among suggestions containing it.

Total: **2 requests per keyword**. At 15 rpm, 100 keywords score in ~14 minutes weekly. Document the budget in a comment.

Unit test the assembly with a mocked provider; optional live smoke on one keyword.

**Verify:** tests green.

**Commit:**

```text
feat(scoring): keyword stats collection with two request budget
```

## Step 3 — Scoring job, weekly schedule, on demand trigger

1. Implement `SCORE_KEYWORD` in the `appstore` worker: `collect` → compute both scores → upsert `KeywordMetric` for today's UTC date with `traffic`, `difficulty`, `stats`.
2. Second Job Scheduler on `pipeline` with `CRON_SCORING` (weekly); its handler fans out `SCORE_KEYWORD` for every distinct active tracked keyword, `jobId: 'score:' + keywordId + ':' + isoWeek` for weekly idempotency.
3. `POST /keywords/:keywordId/score` → enqueue one `SCORE_KEYWORD` (jobId includes the date), respond 202.
4. New keywords do not wait a week: creating a `TrackedKeyword` for a keyword with **no metric at all** enqueues `SCORE_KEYWORD` immediately (same dedupe scheme).

**Verify:** score two keywords; `KeywordMetric` rows appear with populated `stats`; same day/week reruns add no work.

**Commit:**

```text
feat(scoring): scheduled and on demand keyword scoring
```

## Step 4 — Opportunity in the read layer

Opportunity answers "which keyword deserves my next metadata update" and depends on the app's own position, so compute it in `GET /apps/:id/keywords` (Phase 4 endpoint), never persist:

```text
base        = traffic * (10 - difficulty) / 10
rankBoost   = position in 4..30 → base * 1.25      // winnable zone
unrankedCut = position null AND difficulty ≥ 8 → base * 0.5
opportunity = round(clamp(result), 2); null when traffic or difficulty is null
```

`computeOpportunity(traffic, difficulty, position)` lives in `formulas.ts` with unit tests (boost, cut, null cases). Fill `traffic`, `difficulty`, `opportunity`, `scoredAt` in `TrackedKeywordItem` (the shared contract already reserves them) and support `?sort=opportunity|traffic|difficulty|position`.

**Verify:** keyword list shows scores and sorts by opportunity.

**Commit:**

```text
feat(scoring): expose opportunity in keyword listing
```

---

## Acceptance checklist

* [ ] Formulas pure and tested; weights centralized; Google Play differences documented as a future note only.
* [ ] `stats` JSON persists every raw factor.
* [ ] Scoring runs only inside the rate limited worker; 2 requests per keyword.
* [ ] Weekly scheduler + on demand endpoint + first score on new keywords, all idempotent.
* [ ] Keyword list returns traffic, difficulty, opportunity with sorting.
* [ ] Lint, tests, build green.

```text
docs: mark phase 6 complete
```
