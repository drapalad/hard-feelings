<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Show races on the month grid and on the plan list

- **Plan**: context/changes/races-on-calendar/plan.md
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
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 10/10 paths ✓, 6/6 symbols ✓ (`listRaces`, `races={races}` on SetupForm, `Untitled race`, `formatDayLabel`, `unitsInListWindow`, `PlanList` exist; `raceMarkerLabel` is planned), brief↔plan ✓. No `docs/reference/contract-surfaces.md`.

## Findings

### F1 — Phase 1 tests did not scan DashboardTabs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Source-scan tests / Automated 1.1
- **Detail**: Success criterion 1.1 promised `DashboardTabs` passes `races={races}` into `PlanWorkspace`, but the listed test files were only `PlanCalendar.test.ts` / `PlanWorkspace.test.ts`. Those files today scan workspace + PlanChat, not the island. An implementer could skip the DashboardTabs JSX and still green 1.1 if they only grepped `PlanWorkspace.tsx`.
- **Fix**: Have `PlanWorkspace.test.ts` also `readFileSync` `DashboardTabs.tsx` (same pattern as today’s PlanChat scan) and assert the `PlanWorkspace` element includes `races={races}` while SetupForm still receives it.
- **Decision**: FIXED — PlanWorkspace.test.ts now must scan DashboardTabs.tsx; Progress 1.1 title updated to match.

### F2 — listRows vs unitsInListWindow was an implementer fork

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Union rows
- **Detail**: Contract said “keep `unitsInListWindow` or fold it into `listRows`.” Two shapes would both satisfy the phase; existing `PlanList.test.ts` still imports `unitsInListWindow`.
- **Fix**: Specify `listRows` as the render source: start from `unitsInListWindow`, then add in-window races with no unit; keep `unitsInListWindow` exported.
- **Decision**: FIXED — Phase 2 union contract now names that algorithm.

## Triage

- **Fixed:** F1, F2 (2)
- **Dismissed:** none
- **Deferred:** none

PLAN-FIX: F1 — DashboardTabs source-scan in PlanWorkspace.test.ts. F2 — `listRows` wraps `unitsInListWindow` plus race-only dates.

► Verdict after fixes: SOUND
