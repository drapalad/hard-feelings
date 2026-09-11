<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Calendar day panel Implementation Plan

- **Plan**: context/changes/calendar-day-panel/plan.md
- **Mode**: Deep
- **Date**: 2026-09-02
- **Verdict**: SOUND
- **Findings**: 0 critical 2 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 paths ✓ (`PlanCalendar.tsx`, `PlanWorkspace.tsx`, `PlanCalendar.test.ts`, `PlanWorkspace.test.ts`, `plan-month.ts`, `src/pages/api/plan/units.ts`, `src/pages/api/plan/logs.ts`, `src/lib/dates.ts`), 6/6 symbols ✓ (`mergeWeekSlice`, `_logs`, `jsonOk(result.unit)`, `unitEditSchema`, `workoutLogWriteSchema` / `listLogs(utcMondayOf)`, `editUnit` week `units`), brief↔plan ✓.

## Findings

### F1 — Rest “no actions” cannot be a file-wide source grep

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Automated 2.1 / source-read contract
- **Detail**: Success criterion 2.1 asked to prove Rest has no Edit/Log/Freeze **and** that the planned panel contains those labels. `PlanCalendar.test.ts` is Node `readFileSync` of the whole file — `Unlog` will be present for the planned branch. An implementer following 2.1 literally would write `expect(source).not.toContain("Unlog")` and fight 2.1’s planned-unit half.
- **Fix**: Lock a `unit ? actions : rest copy` (or equivalent) conditional; do not require file-wide absence of action labels. Keep the existing cell-no-action greps.
- **Decision**: FIXED — Phase 2 contract + 2.1 / Progress 2.1 now require actions gated on a unit, not a file-wide Rest grep.

### F2 — Panel could reintroduce size-9 icon rows

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Planned-unit actions
- **Detail**: Locked Notes forbid `size-9` icon rows and in-cell overflow. The plan required visible text but did not name `size="icon"` (shadcn `size-9`). A natural port of the old week-card icon row into the panel would violate the lock while still passing “visible Save log” greps if both existed.
- **Fix**: Require labeled `size="sm"` (or default) buttons; assert panel actions are not `size="icon"` / `size-9`.
- **Decision**: FIXED — Phase 2 Edit contract and 2.1 now ban `size="icon"` / `size-9` for panel actions.

## Triage

- **Fixed:** F1, F2
- **Verdict after fixes:** SOUND
