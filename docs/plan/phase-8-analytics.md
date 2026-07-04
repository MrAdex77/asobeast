# Phase 8 — Analytics and Summary

**Goal:** the "how is my ASO going" layer: a visibility score, an app summary (movers, rank distribution, metadata coverage) and a visibility history series. This payload is exactly what the Phase 9 frontend renders.

**Contract rule:** `AppSummary` and `VisibilityHistory` are defined in `@asobeast/shared`.

**Prerequisites:** Phase 7 complete, with a few days of ranking rows (seed fixtures for tests).

---

## Step 1 — Visibility score

`apps/api/src/analytics/visibility.ts` (pure + unit tested):

```text
positionWeight(p) = p == null → 0
                    otherwise 1 / log2(p + 1)      // 1 → 1.0, 3 → 0.5, 10 → 0.29, 100 → 0.15

visibility(app, date) =
  Σ over active tracked keywords: trafficOf(kw) * positionWeight(positionOf(app, kw, date))
  divided by Σ trafficOf(kw)             // normalize to 0..1
  × 100, rounded to 1 decimal             // 0..100
```

`trafficOf` uses the latest `KeywordMetric.traffic` on or before `date`, defaulting to 1 when unscored (unscored keywords count, weakly). Guard division when total traffic is 0.

Unit test: two keywords (traffic 8 at position 1, traffic 4 unranked) → 8×1.0 / 12 × 100 ≈ 66.7.

**Verify:** tests green.

**Commit:**

```text
feat(analytics): visibility score computation
```

## Step 2 — App summary endpoint

`GET /apps/:id/summary` → `AppSummary` (shared), one payload the dashboard renders directly:

```json
{
  "visibility": { "current": 41.3, "delta7d": 3.2, "delta30d": -1.1 },
  "rankDistribution": { "top1": 2, "top3": 4, "top10": 9, "top50": 15, "beyond": 6, "unranked": 12 },
  "movers": {
    "up":   [{ "keywordId": "kw_1", "text": "habit tracker", "from": 24, "to": 11 }],
    "down": [{ "keywordId": "kw_9", "text": "streak app",   "from": 6,  "to": 14 }]
  },
  "coverage": {
    "inTitle": 6, "inSubtitle": 3, "inDescription": 14,
    "uncoveredHighOpportunity": [{ "keywordId": "kw_3", "text": "daily goals", "opportunity": 6.9 }]
  },
  "lastRefreshAt": "2026-07-04T03:11:20.000Z",
  "trackedKeywords": 33,
  "competitors": 2
}
```

Rules:

1. Buckets cumulative except `beyond` (51..depth) and `unranked` (null today).
2. Movers compare today vs 7 days ago (closest row within ±1 day); appearing from null counts as up with `from: null`; top 5 each direction.
3. Coverage checks each tracked keyword's normalized text (shared helpers) against the latest snapshot's normalized title/subtitle/description. `uncoveredHighOpportunity` = opportunity ≥ 6, present in no field, top 5. On the App Store, description is not a ranking field, but coverage there still informs conversion copy; note this in a code comment.
4. Assemble from grouped queries only; no per keyword queries.

**Verify:** with fixtures covering two dates, every block computes correctly (e2e style test with seeded rows).

**Commit:**

```text
feat(analytics): app summary endpoint
```

## Step 3 — Visibility history

`GET /apps/:id/visibility-history?from&to` (default 30 days) → `VisibilityHistory` (shared):

1. For each UTC date in range having ranking rows, compute visibility with the Step 1 function using that date's positions and the metrics valid on that date.
2. `{ points: [{ date, visibility }] }`, dates without capture omitted.
3. Range cap 180 days (400 beyond). In memory over two grouped queries (rankings in range, metrics up to range end); trivial at ≤200 keywords × 180 days. Leave a `TODO`: persist a `DailyAppStat` table if this ever gets slow.

**Verify:** last point matches the summary's current visibility.

**Commit:**

```text
feat(analytics): visibility history for charts
```

---

## Acceptance checklist

* [ ] Visibility math pure, tested, stable against unscored keywords and empty days.
* [ ] Summary returns all documented blocks via grouped queries.
* [ ] History consistent with summary; range capped.
* [ ] `AppSummary` and `VisibilityHistory` in `@asobeast/shared`.
* [ ] Lint, tests, build green.

```text
docs: mark phase 8 complete
```
