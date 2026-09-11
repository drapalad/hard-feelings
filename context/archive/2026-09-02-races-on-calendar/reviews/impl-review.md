<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Show races on the month grid and on the plan list

- **Plan**: context/changes/races-on-calendar/plan.md
- **Scope**: Phase 1 of 2 through Phase 2 of 2
- **Date**: 2026-09-02
- **Verdict**: APPROVED
- **Findings**: 1 critical 0 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Phase 2 committed a stubbed `listRows` that dropped races

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/plan/PlanList.tsx:24
- **Detail**: `856f007` shipped `listRows` as `unitsInListWindow(…).map(unit => ({ date, unit }))`, ignoring `races`. Race-only List rows (the locked rest-day requirement) would never appear; `listRows` unit tests fail on that SHA. Cause: the deliberate-break edit raced with `git add` in the same turn and was committed. Calendar overlay in `44f6969` was intact.
- **Fix**: Restore the planned union: index in-window units, attach/add in-window races, sort by date.
- **Decision**: FIXED — union restored in this review; `npm test` (219 passed) and `npm run lint` green.

## Success criteria re-run

- `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts` — pass (phase 1 files)
- `npm test -- src/components/plan/PlanList.test.ts src/components/plan/PlanCalendar.test.ts` — pass after F1 fix
- `npm test` — 33 files passed, 1 skipped (219 tests)
- `npm run lint` — pass
- Manual 1.8 and 2.7 remain `[ ]` (human-only; not rubber-stamped)

## Triage

- **Fixed:** F1 (1)
- **Deferred:** none
- **Dismissed:** none

► Verdict after fixes: APPROVED
