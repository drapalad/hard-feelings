# Eight-week Easy / Threshold / Speed load chart Implementation Plan

## Overview

Show a compact 8-week Easy / Threshold / Speed stacked-bar chart above the Calendar month grid, derived from real planned units and workout logs (not mock km). Raise the existing range GET cap to 56 so the 8-week window is a valid `from`/`to` (the visible month stays a second GET when the union would exceed that cap).

## Current State Analysis

Week tab is a month grid plus generate/chat (`PlanCalendar.tsx` / `PlanWorkspace.tsx`). `GET /api/plan?weekStart=&from=&to=` already returns `training_units` + `workout_logs` via `listRange` + `listLogsRange` (`src/pages/api/plan.ts`). `resolvePlanRange` rejects spans longer than `MAX_PLAN_GET_RANGE_DAYS` (42) (`src/lib/services/plan.ts`). The month grid is typically ~35 days (`monthGridDates`), so the calendar GET cannot cover five past UTC weeks + current + two future (56 inclusive days).

There is no load chart. Profile may already store mix percents (`mix_easy` / `mix_threshold` / `mix_speed`); this chart does not read them. Workout types are `base | recovery | tempo | threshold | anaerobic | long` (`src/types.ts`). Logs snapshot type + km (`WorkoutLog`). Vitest is Node-only; calendar contracts are `readFileSync` source-scans plus exported helpers. Playwright is not a suite (`test-plan.md` §6.3).

A decision-pack screen used mock series because the probe month GET is not an 8-week window. Production must derive real km.

### Key Discoveries:

- Inclusive 8×7 window is 56 days. `plan-contracts.test.ts` currently treats Aug 1–Sep 12 (43 days) as over-cap. After raising the cap to 56, that fixture would succeed; the reject case must move to 57 days.
- `listRange` / `listLogsRange` take an explicit `from`/`to` and `.in("date", dates)`. No new endpoint. Raising `MAX_PLAN_GET_RANGE_DAYS` is the only server change.
- `loadMonth` **replaces** `units`/`logs` with the month payload. A chart-only 8-week GET that is then wiped on month navigation would empty the chart. The workspace must merge month + chart windows by date.
- Month grid ∪ 8-week window for the current month is longer than 56 days (September 2026 grid Aug 31–Oct 4 plus chart Jul 27–Sep 20 ≈ 70). One union GET cannot stay at the locked minimum cap. Two range GETs (month grid + chart window) then merge.
- `utcMondayOf` / `addUtcDays` already exist (`src/lib/dates.ts`). Chart origin is UTC today, not `visibleMonth` (FU-123).
- `roundKm` (`src/lib/km.ts`) belongs on bucket sums so week totals do not show float artifacts (same rule as generate/validate).
- `cn()` from `@/lib/utils` is required for Tailwind class merges. No npm chart library.
- PlanList’s 21-day GET and `MAX_PLAN_GET_RANGE_DAYS` comments elsewhere stay valid at 56.

## Desired End State

On `/dashboard` Calendar, a small labeled 8-week Easy / Threshold / Speed stacked-bar chart sits above the month grid. Caption is exactly `Easy / Threshold / Speed · km per week · logs + plan`. A legend names the three series. Bars are real km: past dates use log km and log type when a log exists, otherwise the planned unit; today and future dates use planned units only. Empty weeks still render as zero-height bars. No hardcoded week km in production components. Generate, chat, snapshot, and SetupForm are unchanged.

## What We're NOT Doing

- Profile mix fields, pace fields, a migration, or an npm chart library.
- Reading `mix_easy` / `mix_threshold` / `mix_speed` for this chart.
- Changing generate, chat, or snapshot behavior (including canned generate Send, auto-apply, coach data-request).
- Editing `SetupForm`.
- New tables, new API routes, or raising the GET cap beyond 56 in this change (FU-124).
- Playwright, jsdom, Testing Library, visual snapshots (`toMatchSnapshot` / Argos).
- `"use client"` or concatenating Tailwind class strings.
- Stamping roadmap done, writing `lessons.md`, closing FU-094–FU-122 or DEP-020, or archiving this change.

## Implementation Approach

Pure functions in `training-load.ts` own the UTC window, type bucketing, per-date log-vs-plan pick, and week aggregates. `PlanWorkspace` keeps the existing month GET and adds a parallel 8-week GET, merging both into `units`/`logs`. `TrainingLoadChart` renders CSS stacked bars from those aggregates. `PlanCalendar` mounts the chart above the seven-column grid. `MAX_PLAN_GET_RANGE_DAYS` becomes 56 so the chart GET is accepted.

LOCKED: files and behaviors in `change.md` Notes. ASSUMED: chart window is anchored to `utcToday()` (FU-123). ASSUMED: month GET stays; chart is a second range GET merged by date rather than raising the cap to union nearby months (FU-124).

## Critical Implementation Details

**Chart window.** `loadChartWindow(today)` uses `current = utcMondayOf(today)` and week offsets `[-5,-4,-3,-2,-1,0,1,2]`. `from` is the first Monday; `to` is that last Monday plus 6 days (Sunday). Always 8 Mondays and 56 inclusive dates.

**Per-date source.** Compare each ISO date to `today` (not whole-week membership). `date < today`: use the log when one exists (log type + log km), else the planned unit. `date >= today`: planned unit only (ignore a log on today/future). A past log with no current unit still counts. Rest (neither) contributes 0.

**Buckets.** Easy = `base`+`recovery`+`long`. Threshold = `tempo`+`threshold`. Speed = `anaerobic`. All six types map; nothing is dropped.

**Fetch.** `loadMonth` still GETs the visible `monthGridDates` range (calendar cells). In parallel it GETs `from=chart.from&to=chart.to` with the same `weekStart` (chat/revisions still keyed to the visible week). If the two ranges are identical, one plan GET is enough. Otherwise merge units and logs by `date` (second payload overwrites the same date). Both plan responses must succeed or set `calendarError` like today’s single GET. Chat GET is unchanged. Week mutations keep `mergeWeekSlice` / `mergeReturnedUnits` / `mergeItemByDate` so overlapping chart weeks update without a dedicated refetch.

**Chart chrome.** Place `TrainingLoadChart` after the toolbar / errors / “No plan for this week yet.” copy and **before** the `grid-cols-7` month grid. Caption text must match exactly. Legend lists Easy, Threshold, Speed. Stack Easy at the bottom, then Threshold, then Speed, using `cn()` and calendar-adjacent tones (`bg-slate-400` Easy, `bg-orange-400` Threshold, `bg-red-400` Speed). Column height is week-total / max week-total in the window (treat max 0 as 1 so empty windows do not divide by zero). No y-axis ticks. Week labels are the Monday day+month (no ISO year literals in production source). No `recharts` / Chart.js / hardcoded km arrays.

---

## Phase 1: Range cap and load mapping

### Overview

The existing GET accepts a 56-day window, and a pure module can turn units + logs into eight bucketed week totals with the locked log-vs-plan rule.

### Changes Required:

#### 1. Raise the GET range cap

**File**: `src/lib/services/plan.ts`

**Intent**: An 8-week inclusive fetch is a valid `from`/`to`, not a 400.

**Contract**: `MAX_PLAN_GET_RANGE_DAYS` is `56`. `resolvePlanRange` still rejects unpaired / reversed / non-ISO / over-cap ranges. Do not change `listRange` query shape.

#### 2. Update range contract tests

**File**: `src/pages/api/plan-contracts.test.ts`

**Intent**: The over-cap fixture matches the new limit; a 56-day owner GET still returns only the session member’s rows.

**Contract**: The reject case that is currently Aug 1–Sep 12 (43 days) must become a 57-day span (Aug 1–Sep 26). Add or extend a case that `from`/`to` of 56 inclusive days returns 200 for the session user. Keep unpaired, reversed, and non-ISO 400s. Do not weaken the other-member isolation assertions.

#### 3. Mapping + week aggregate module

**File**: `src/components/plan/training-load.ts`

**Intent**: One place owns window, bucket, per-date source, and week totals so the UI cannot invent km.

**Contract**: Export `loadChartWindow(today)`, `bucketWorkoutType(type)`, `pickDayLoad(...)`, and `aggregateLoadWeeks(units, logs, today)` returning eight `{ weekStart, easy, threshold, speed }` rows (zeros allowed). Bucket sums go through `roundKm`. Do not import Profile mix fields. Do not hardcode week km.

#### 4. Mapping tests

**File**: `src/components/plan/training-load.test.ts`

**Intent**: Mapping and the logs-vs-plan fallback are locked in CI without a browser.

**Contract**: Cover all six type buckets; past log wins over a different planned type/km; past unit used when no log; today/future ignore logs; past log-only date still counts; eight weeks for a fixture `today` including empty weeks. Tests may use ISO dates; production `training-load.ts` must not embed a mock series.

### Success Criteria:

#### Automated Verification:

- `MAX_PLAN_GET_RANGE_DAYS` is 56; `resolvePlanRange` accepts a 56-day span and rejects 57
- `plan-contracts.test.ts` rejects a 57-day GET and still isolates the other member on in-range GETs
- `training-load.ts` exports window / bucket / pick / aggregate; Easy/Threshold/Speed mapping matches the locked type lists
- Unit tests cover mapping and logs-vs-plan fallback (past log wins; today uses plan)
- Unit tests pass: `npm test -- src/components/plan/training-load.test.ts src/pages/api/plan-contracts.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

---

## Phase 2: Chart UI and 8-week GET

### Overview

The calendar shows the stacked chart from real workspace data. The workspace loads the 8-week window without dropping the month grid.

### Changes Required:

#### 1. CSS stacked-bar chart

**File**: `src/components/plan/TrainingLoadChart.tsx`

**Intent**: Compact, labeled visualization of the eight aggregated weeks with no chart library.

**Contract**: React island taking `weeks: { weekStart, easy, threshold, speed }[]` (or calling `aggregateLoadWeeks` from units/logs + today). Caption exactly `Easy / Threshold / Speed · km per week · logs + plan`. Legend for the three series. CSS (or inline SVG) stacked bars via `cn()`. No npm chart import. No hardcoded km series. No `2026-` date literals.

#### 2. Mount above the month grid

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: The chart is visible above the month without changing generate/chat/snapshot chrome.

**Contract**: Render `TrainingLoadChart` above the `grid-cols-7` block, using the same `units` and `logs` props plus `utcToday()`. Do not add props that change generate, snapshot, restore, or the day panel. Do not edit toolbar behavior.

#### 3. Eight-week GET + merge

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Chart weeks have real rows even when they sit outside the visible month grid; month navigation does not wipe them.

**Contract**: Keep the month `from`/`to` GET. Add a GET of `loadChartWindow(utcToday())` (skip the extra request when that range equals the month range). Merge units/logs by date into existing state. Do not POST `/api/plan`. Do not change Send, snapshot, or restore. Do not import SetupForm or mix columns.

#### 4. Source-scan tests

**Files**: `src/components/plan/PlanCalendar.test.ts`, `src/components/plan/PlanWorkspace.test.ts`, `src/components/plan/TrainingLoadChart.test.ts`

**Intent**: Caption, fetch window, and “no mock km / no chart library” stay in CI.

**Contract**: Calendar source contains the exact caption and `TrainingLoadChart`. Workspace source contains the 8-week `from`/`to` GET (and still the month GET + `mergeWeekSlice`). Chart source has no `recharts` / `chart.js` / hardcoded km arrays and no `2026-`. Existing generate/chat/snapshot source locks remain.

### Success Criteria:

#### Automated Verification:

- `TrainingLoadChart` renders stacked CSS/SVG bars with the exact caption and a three-series legend; `cn()` is used; no npm chart import
- `PlanCalendar` mounts the chart above the month grid from `units`/`logs` (no mock series)
- `PlanWorkspace` GETs the 8-week window via existing `/api/plan?from=&to=` and merges with the month payload by date
- Production chart/calendar/workspace files contain no hardcoded week-km series and no `2026-` literals
- Unit tests pass: `npm test -- src/components/plan/training-load.test.ts src/components/plan/TrainingLoadChart.test.ts src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- On `/dashboard` Calendar, an 8-week Easy / Threshold / Speed chart appears above the month with the exact caption and legend; past logged days follow logs, today/future follow the plan; bars are not a repeated mock series

---

## Testing Strategy

### Unit Tests:

- Type → bucket for all six workout types.
- Logs-vs-plan fallback (past log, past plan, today log ignored, log-only past date, empty week).
- `loadChartWindow` length 56 / eight Mondays relative to a fixture today.
- GET cap 56 vs 57 in `plan-contracts.test.ts`.
- Source-scans for caption, chart mount, 8-week GET, no chart library, no `2026-`.

### Integration Tests:

Reuse `plan-contracts.test.ts` for the raised range cap and owner isolation. No new API route.

### Manual Testing Steps:

1. Open `/dashboard` Calendar. Confirm the chart sits above the month, caption and legend match, and eight weeks render (zeros allowed).
2. Log a past planned day with a different km/type than the unit; reload: that week’s bar should follow the log, not the plan. Today’s cell should still chart as the plan even if a log exists.
3. Browse another month: month cells change; the 8-week chart stays today-relative and does not go blank.

## Performance Considerations

One extra range GET (56 dates) beside the existing month GET and chat GET, in parallel on `loadMonth`. `.in("date", 56)` matches the current listRange pattern. No polling. No new SSR payload.

## Migration Notes

None. No schema change. DEP-020 (hosted `profile_plan_prefs`) stays open and is unused by this chart.

## References

- Change notes: `context/changes/training-load-chart/change.md`
- Range GET: `src/pages/api/plan.ts`, `resolvePlanRange` / `listRange` in `src/lib/services/plan.ts`, `listLogsRange` in `src/lib/services/workout-log.ts`
- Dates: `src/lib/dates.ts` (`utcMondayOf`, `addUtcDays`, `monthGridDates`, `inclusiveIsoDates`)
- Calendar mount: `src/components/plan/PlanCalendar.tsx`, `src/components/plan/PlanWorkspace.tsx`
- Types: `src/types.ts` (`WorkoutType`, `TrainingUnit`, `WorkoutLog`)
- Test cookbook: `context/foundation/test-plan.md` §6

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Range cap and load mapping

#### Automated

- [x] 1.1 `MAX_PLAN_GET_RANGE_DAYS` is 56; `resolvePlanRange` accepts a 56-day span and rejects 57 — 805a188
- [x] 1.2 `plan-contracts.test.ts` rejects a 57-day GET and still isolates the other member on in-range GETs — 805a188
- [x] 1.3 `training-load.ts` exports window / bucket / pick / aggregate; Easy/Threshold/Speed mapping matches the locked type lists — 805a188
- [x] 1.4 Unit tests cover mapping and logs-vs-plan fallback (past log wins; today uses plan) — 805a188
- [x] 1.5 Unit tests pass: `npm test -- src/components/plan/training-load.test.ts src/pages/api/plan-contracts.test.ts` — 805a188
- [x] 1.6 Full suite passes: `npm test` — 805a188
- [x] 1.7 Lint passes: `npm run lint` — 805a188

### Phase 2: Chart UI and 8-week GET

#### Automated

- [x] 2.1 `TrainingLoadChart` renders stacked CSS/SVG bars with the exact caption and a three-series legend; `cn()` is used; no npm chart import — e4d2be5
- [x] 2.2 `PlanCalendar` mounts the chart above the month grid from `units`/`logs` (no mock series) — e4d2be5
- [x] 2.3 `PlanWorkspace` GETs the 8-week window via existing `/api/plan?from=&to=` and merges with the month payload by date — e4d2be5
- [x] 2.4 Production chart/calendar/workspace files contain no hardcoded week-km series and no `2026-` literals — e4d2be5
- [x] 2.5 Unit tests pass: `npm test -- src/components/plan/training-load.test.ts src/components/plan/TrainingLoadChart.test.ts src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts` — e4d2be5
- [x] 2.6 Full suite passes: `npm test` — e4d2be5
- [x] 2.7 Lint passes: `npm run lint` — e4d2be5

#### Manual

- [x] 2.8 On `/dashboard` Calendar, an 8-week Easy / Threshold / Speed chart appears above the month with the exact caption and legend; past logged days follow logs, today/future follow the plan; bars are not a repeated mock series
