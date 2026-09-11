<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Month calendar

- **Plan**: context/changes/month-calendar/plan.md
- **Scope**: Phase 1 of 4 through Phase 4 of 4
- **Date**: 2026-09-02
- **Verdict**: APPROVED
- **Findings**: 0 critical 3 warnings 1 observation (all triaged)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Git scope

`fcde101^..HEAD`: `src/lib/dates.ts`, `src/lib/dates.test.ts`, `src/lib/services/plan.ts`, `src/lib/services/workout-log.ts`, `src/pages/api/plan.ts`, `src/pages/api/plan-contracts.test.ts`, `src/components/plan/PlanCalendar.tsx`, `src/components/plan/PlanCalendar.test.ts`, `src/components/plan/PlanWorkspace.tsx`, `src/components/plan/PlanWorkspace.test.ts`, `src/components/plan/plan-month.ts`, `src/components/plan/plan-month.test.ts`, plus change-folder artifacts and FU-088 / FU-089 in `context/backlog.md`. `PlanChat.tsx` and `dashboard.astro` are unmodified. No migrations.

## Plan drift

| File | Plan | Actual | Verdict |
| --- | --- | --- | --- |
| `src/lib/dates.ts` | utcMonthStart, addUtcMonths, inclusiveIsoDates, monthGridDates, activeWeekStartForMonth, formatMonthYear | Same; Sep 2026 grid `2026-08-31`–`2026-10-04` (35) | MATCH |
| `src/lib/services/plan.ts` | listRange via `.in("date", dates)`; cap 42 at HTTP; listWeek may delegate | listRange + resolvePlanRange cap; listWeek delegates | MATCH |
| `src/lib/services/workout-log.ts` | listLogsRange same window | Same | MATCH |
| `src/pages/api/plan.ts` | GET from/to + weekStart revisions; POST unchanged; prerender false | Same; 401 still `unauthorized()` | MATCH |
| `src/pages/api/plan-contracts.test.ts` | GET week vs range ownership; unpaired/reversed/43-day/invalid → 400 | Same | MATCH |
| `PlanCalendar.tsx` | Month grid, Rest, Today, week generate label, no cell actions | Same | MATCH |
| `PlanWorkspace.tsx` | 3/2 layout; loadMonth from/to; merge generate/accept/restore; week unitsEmpty | Same after review fixes | MATCH |
| `plan-month.ts` | weekHasUnits, generatePlanButtonLabel, mergeWeekSlice | Same | MATCH |
| `PlanChat.tsx` | Do not edit | Untouched | MATCH |
| `dashboard.astro` | Do not edit | Untouched | MATCH |

## Success criteria

Automated 1.1–1.4 (`fcde101`), 2.1–2.6 (`d14b680`), 3.1–3.6 (`51e8f5b`), 4.1–4.7 (`d13a968`) are `[x]`. Re-checked this review after triage fixes: `npm test` 179 passed / 2 skipped; `npm run lint` exits 0. Phase 4 already ran `npm run build` green on dummy `.env`.

Manual 3.7 and 4.8 remain `[ ]` (human-only).

## Findings

### F1 — Chat send replaced month logs with the week slice

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/plan/PlanWorkspace.tsx:145
- **Detail**: POST `/api/chat/messages` always returns week-scoped `logs`. `applyChatBody` did `setLogs(nextLogs)`, which would drop other in-month logs after the range GET. Cells do not render logs in this slice, but the plan kept logs in workspace state for later day actions.
- **Fix**: Merge chat logs with `mergeWeekSlice` using the active `weekStart`.
- **Decision**: FIXED — `setLogs((current) => mergeWeekSlice(current, nextLogs, sliceWeekStart))`.

### F2 — mergeWeekSlice unioned incoming dates outside the week

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/plan/plan-month.ts:16
- **Detail**: The plan said drop current week dates then union incoming. Unfiltered incoming could plant dates outside `weekDates(weekStart)` onto the month grid.
- **Fix**: Filter incoming to the week window before union.
- **Decision**: FIXED — `incoming.filter` to `weekDates(weekStart)`; unit test covers a date outside the week.

### F3 — Overlapping loadMonth could apply a stale month

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/plan/PlanWorkspace.tsx:143
- **Detail**: `busy` is React state, so two month clicks before the first re-render could both fetch. A slower earlier response could overwrite the later month. `finally { setBusy(false) }` on the stale call would also clear busy while the newer load was in flight.
- **Fix**: Sequence token; ignore stale responses; clear busy only for the latest seq.
- **Decision**: FIXED — `loadSeq` ref on `loadMonth`.

### F4 — Initial month load uses setTimeout(0) instead of a sync mount effect

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/plan/PlanWorkspace.tsx:234
- **Detail**: The plan asked for a mount-only `useEffect` that calls `loadMonth`. Sync `setState` in that effect, a render-time ref, and an eslint-disable all fail this repo’s React Compiler / hooks lint. The shipped path is `useEffect` + `window.setTimeout(..., 0)` with deps `[initialWeekStart, loadMonth]`, still not subscribed to `visibleMonth` / `weekStart`.
- **Fix**: Keep the deferred mount load (lint-required); do not restore a forbidden sync effect body.
- **Decision**: DISMISSED — required by lint; same one-load-path contract as the plan-review F1 fix.

## Triage

Fixed: F1, F2, F3 (3). Dismissed: F4 (1). Deferred: none. Stamp `impl_reviewed`.
