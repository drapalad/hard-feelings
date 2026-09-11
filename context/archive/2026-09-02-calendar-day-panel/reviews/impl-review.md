<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Calendar day panel Implementation Plan

- **Plan**: context/changes/calendar-day-panel/plan.md
- **Scope**: Phase 1–2 of 2
- **Date**: 2026-09-02
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warning 1 observation

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

### F1 — Edit of a non-active week cleared active-week chat stack

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/components/plan/PlanWorkspace.tsx` (`saveUnit`)
- **Detail**: PUT `/api/plan/units` returns the **edited date’s** week (`utcMondayOf(payload.date)`). The plan restored `applyStack` + `setProposition(null)` on `changed` from the old one-week calendar. In the month grid that would replace the active week’s history picker and drop a pending chat proposition when the member edited a different week of the visible month. The server already `rejectPending` only for the edited Monday.
- **Fix**: Call `applyStack` and `setProposition(null)` only when `actionMonday === weekStart`. Still merge units via `mergeWeekSlice(..., actionMonday)` and still show PUT `asWarnings`.
- **Decision**: FIXED — guard added; workspace source-read locks `actionMonday === weekStart`.

### F2 — Month change clears selection via derived state, not an effect

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/components/plan/PlanCalendar.tsx` (`selectedInMonth`)
- **Detail**: The plan said reset `selectedDate` when `visibleMonth` changes. A `useEffect` that `setSelectedDate(null)` trips `react-hooks/set-state-in-effect`. Implementation derives `selectedInMonth` so a date from another month does not show as pressed or open the panel. Escape still clears stored state. Same UX, lint-legal.
- **Fix**: None required.
- **Decision**: DISMISSED — equivalent to the plan’s reset; required by ESLint.

## Success criteria

Automated Progress rows 1.1–1.6 / 2.1–2.6 are `[x]` with SHAs `92b0cfa` / `15b1832`. Re-ran colocated plan tests (17 passed) and `npm test` (183 passed, 2 skipped). Manual rows 1.7–1.9 and 2.7–2.9 remain `[ ]`.
