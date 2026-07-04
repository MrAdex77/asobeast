# Phase 7 — Competitors

**Goal:** add competitor apps to a primary app, ride along on the daily rank capture at zero extra request cost, and expose comparison plus keyword gap analysis.

**Contract rule:** `CompetitorItem` and `KeywordComparison` are defined in `@asobeast/shared`.

**Prerequisites:** Phase 6 complete. `RankingsService.checkKeyword` (Phase 5) is already competitor aware; this phase creates the data it was waiting for.

---

## Step 1 — Add and manage competitors

`POST /apps/:id/competitors` body `{ "url": "https://apps.apple.com/..." }`:

1. Parse via the shared parser; **reject with 400 when the competitor's store differs from the primary's** (cross store rank comparison is meaningless). A Google Play URL therefore currently yields the same 400 (store mismatch with an App Store primary), which is correct. Country is forced to the primary's country.
2. Reuse the Phase 3 import flow, but create the `App` row with `isCompetitor: true` and `primaryAppId` set. Competitors get snapshots (their metadata evolution is interesting) but **no auto tracked keywords**: skip `syncFromSnapshot` for competitor rows.
3. Cap: 10 competitors per app (400 beyond; keeps daily request volume sane).

Also:

```text
GET    /apps/:id/competitors      list (CompetitorItem[]) with latest snapshot basics
DELETE /apps/:id/competitors/:competitorId
```

**Verify:** add two real competitors; rows have `isCompetitor` and `primaryAppId`; a mismatched store URL is rejected; competitor import created no tracked keywords.

**Commit:**

```text
feat(competitors): add and manage competitor apps
```

## Step 2 — Confirm shared rank capture end to end

No new capture code should be needed; verify and harden:

1. The daily fan out (Phase 5, Step 4) enqueues `REFRESH_APP` for competitors too, and `checkKeyword` writes `KeywordRanking` rows for competitors of every primary tracking the keyword.
2. Extend the unit test: primary at 7, competitor A at 31, competitor B absent → rows 7, 31, null from one mocked search.
3. Run `POST /apps/:id/run-daily` and confirm competitor rows dated today.

Fix anything missing here.

**Verify:** competitor rows exist for today; tests green.

**Commit:**

```text
feat(competitors): capture competitor positions in daily rank checks
```

## Step 3 — Competitor based keyword suggestions

Extend the suggestions endpoint (Phase 4, Step 5) with `strategy=competitors`:

1. Run extraction over each competitor's latest snapshot (title + subtitle).
2. Count per candidate how many competitors use it; drop terms the primary already tracks.
3. Return `{ text, strategy: "competitors", usedByCount }` sorted by `usedByCount` desc.

**Verify:** with 2+ competitors, overlapping terms come back with counts.

**Commit:**

```text
feat(keywords): competitor based keyword suggestions
```

## Step 4 — Comparison and gap analysis

`GET /apps/:id/keywords/compare` → `KeywordComparison` (shared):

```json
{
  "competitors": [{ "id": "app_2", "name": "Rival" }],
  "rows": [
    {
      "keywordId": "kw_1",
      "text": "habit tracker",
      "traffic": 7.2,
      "difficulty": 5.1,
      "you": 12,
      "positions": { "app_2": 4 },
      "gap": true
    }
  ]
}
```

`gap` (documented in code): a competitor sits in the top 10 while the primary is null or worse than 30. Support `?onlyGaps=true`. Default sort: gaps first, then traffic desc.

Implementation note: "latest position" = most recent `KeywordRanking` per (app, keyword); one grouped query, no N+1.

**Verify:** coherent table after at least one capture day; `onlyGaps` filters correctly.

**Commit:**

```text
feat(competitors): keyword comparison with gap analysis
```

---

## Acceptance checklist

* [ ] Competitors are same store, capped at 10, cascade on delete, and get no auto tracked keywords.
* [ ] Competitor positions come from the same single search as the primary (tested).
* [ ] Competitor suggestions and comparison work; gap rule matches the documentation.
* [ ] `CompetitorItem` and `KeywordComparison` live in `@asobeast/shared`.
* [ ] Lint, tests, build green.

```text
docs: mark phase 7 complete
```
