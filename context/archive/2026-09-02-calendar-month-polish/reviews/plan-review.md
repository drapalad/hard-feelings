<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Compact month toolbar, denser phone cells, session structure, manual snapshots

- **Plan**: context/changes/calendar-month-polish/plan.md
- **Mode**: Deep
- **Date**: 2026-09-02
- **Verdict**: SOUND
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 12/12 paths ✓ (PlanCalendar.tsx, PlanWorkspace.tsx, plan-month.ts, plan.ts, chat.ts, plan.ts API, restore.ts, product-gates.test.ts, plan-revisions.test.ts, accept-proposition.test.ts, PlanCalendar.test.ts, utils.ts cn), 8/8 symbols ✓ (generateAndPersist, snapshotWeekIfChanged, restoreWeek, editUnit, acceptProposition, weeksEqual, generatePlanButtonLabel, prerender on sibling API routes), brief↔plan ✓. `src/pages/api/plan/snapshots.ts` is new (expected). Existing `src/components/plan/plan-month.test.ts` was missing from Phase 2 until PLAN-FIX.

## Findings

### F1 — Helper tests belonged in existing plan-month.test.ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — Source-read and helper tests
- **Detail**: The plan put `formatCompactKm` / `weekUnitsEqual` unit tests in `PlanCalendar.test.ts`. That file is a source-scan lock. `src/components/plan/plan-month.test.ts` already unit-tests `generatePlanButtonLabel` / merge helpers — the natural home for new label helpers.
- **Fix**: Move those cases into `plan-month.test.ts` and add that file to the Phase 2 scoped `npm test` command / Progress 2.4.
- **Decision**: FIXED — helper tests go in `plan-month.test.ts`; Progress 2.4 includes that path.

### F2 — editUnit no-snapshot lacked an explicit test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Revision and gate tests
- **Detail**: Success criterion 1.2 requires `editUnit` not to call `insertRevision`. Rewritten tests named generate, Accept, and `snapshotCurrentWeek`, but not a direct `editUnit` persist assertion. `ownership.test.ts` calls `editUnit` without checking revision count.
- **Fix**: In `plan-revisions.test.ts`, assert a changed `editUnit` does not insert a `plan_revisions` row.
- **Decision**: FIXED — added to Phase 1 test contract.

### F3 — Snapshot POST failure mapping was implied, not stated

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — POST `/api/plan/snapshots`
- **Detail**: `snapshotCurrentWeek` is specified to surface DB errors (unlike `snapshotWeekIfChanged` swallow). The route contract listed 200 and 401/400/503 but not how `{ ok: false }` maps to HTTP.
- **Fix**: Map service failure to 500 `DB_ERROR` using the restore handler pattern.
- **Decision**: FIXED — snapshots POST contract now says 500 `DB_ERROR` on service failure.
