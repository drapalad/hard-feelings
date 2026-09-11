# Switch km-per-week and daily-load charts with one visible — Implementation Plan

## Overview

`PlanCalendar` currently stacks both load charts above the month grid. This change adds an accessible tablist so only one chart is mounted at a time, defaulting to the daily decay series, without changing aggregation, captions, legends, or calendar chrome already shipped in `calendar-mobile-chrome`.

## Current State Analysis

`PlanCalendar` imports `TrainingLoadChart` and `DailyLoadChart` from `src/components/plan/TrainingLoadChart.tsx` and mounts both unconditionally above `grid grid-cols-7` (`PlanCalendar.tsx` ~616–619). Aggregates stay `aggregateLoadWeeks(units, logs, today)` and `aggregateDailyLoad(units, logs, today)` in `training-load.ts` (out of scope).

Captions are locked: `LOAD_CHART_CAPTION` = `Easy / Threshold / Speed · km per week · logs + plan`; `DAILY_LOAD_CAPTION` = `Easy / Threshold / Speed · daily load (decay 0.85) · logs + plan`. Weekly chart is CSS stacked bars; daily chart is SVG polylines. There is no `role="tablist"` in `PlanCalendar.tsx` or `TrainingLoadChart.tsx`. `src/components/ui/` has `button.tsx` (and `LibBadge.astro`) — no shadcn Tabs. `Topbar.test.ts` forbids `role="tablist"` only in `DashboardTabs.tsx` source; a local tablist in `TrainingLoadChart.tsx` does not trip that lock.

`PlanCalendar.test.ts` requires `<TrainingLoadChart` above the month grid and does not yet require a tablist or exclusive mount. `TrainingLoadChart.test.ts` locks captions, series colors, and that `DailyLoadChart` is exported. HEAD already includes icon-only generate below `sm`, compact Type+Distance, log in closed `<details>`, and the Make AI comment slot — do not restyle those.

Repo-wide `npm run lint` is red at HEAD on `TrainingLoadChart.tsx`, `training-load.ts`, `training-load.test.ts`, and `pace-estimate.test.ts`. This change edits `TrainingLoadChart.tsx` and must leave that file eslint/prettier clean. Do not “fix” the other three files.

## Desired End State

Above the month grid: a `role="tablist"` named Training load, two tabs whose labels match the series (not Weekly/Daily), and exactly one mounted chart. First render shows the daily decay chart. Switching to km per week unmounts the daily chart and mounts the week bars. Each selected chart keeps its existing caption, legend, and series. Generate, day-edit, month grid, Profile mix, and chat are unchanged.

### Key Discoveries:

- Both charts live in one module (`TrainingLoadChart.tsx`); `DailyLoadChart` is a named export, not a separate file (research.md).
- Exclusive mount is a source-scan concern: today’s `PlanCalendar.test.ts` looks for `<TrainingLoadChart` in `PlanCalendar.tsx`. Moving the tablist into a wrapper means that scan must follow the wrapper, not keep requiring both JSX tags in `PlanCalendar.tsx`.
- Test-plan §6.1 / §7: colocated Vitest source-scan; no Playwright / visual snapshots for calendar layout.
- Merge classes with `cn()` (`AGENTS.md`).

## What We're NOT Doing

- Labeling tabs Weekly or Daily
- Changing load aggregation, `training-load.ts`, Profile mix, month grid, generate, or chat
- Restyling the day-edit form or generate control (`calendar-mobile-chrome`)
- Persisting the selected tab in the URL or storage
- Keeping both charts mounted (hidden CSS / `hidden` / `display:none`)
- Adding shadcn Tabs or a charting library
- Playwright / e2e (test-plan §6.3 / §7)
- Fixing HEAD lint in `training-load.ts`, `training-load.test.ts`, or `pace-estimate.test.ts`

## Implementation Approach

Add a small `LoadChartTabs` wrapper in `TrainingLoadChart.tsx` that owns client tab state and renders `role="tablist"` plus one chart. `PlanCalendar` replaces the two stacked mounts with that wrapper, still passing both aggregates (aggregation unchanged). Lock the contract with source-scan in both colocated tests.

## Phase 1: Tabbed load charts

### Overview

One pass: tablist + exclusive mount defaulting to daily decay; wire it above the month grid; extend source-scan so both files lock S-14.1–S-14.4 and the verdict override.

### Changes Required:

#### 1. LoadChartTabs wrapper (S-14.1–S-14.4)

**File**: `src/components/plan/TrainingLoadChart.tsx`

**Intent**: Own tab state next to the two chart components so PlanCalendar does not grow another piece of chart UI, and so captions/labels stay in one module.

**Contract**:
- Export `LoadChartTabs({ weeks, days })` taking existing `LoadWeek[]` / `DailyLoadEntry[]`.
- Export tab label constants used as visible tab text: `km per week` and `daily load (decay 0.85)` (not `Weekly` / `Daily`). `LOCKED: labels match caption fragments; decay stays in the daily tab so the 0.85 series is named on the control. Alternative short `daily load` is FU-137.`
- `role="tablist"` with accessible name `Training load` (e.g. `aria-label="Training load"`).
- Two `<button type="button" role="tab">` controls (not static `div`s — `eslint-plugin-jsx-a11y` is on). Selected tab has `aria-selected={true}`. Tab order: daily load first (default), then km per week. Click switches selection. No URL/searchParams. No arrow-key roving tabindex (not in Notes).
- Client state: `useState` defaulting to the daily/decay tab on first render (S-14.3).
- Render **only** the selected chart: daily → `<DailyLoadChart days={days} />`; km-per-week → `<TrainingLoadChart weeks={weeks} />`. Do not keep the inactive chart mounted (`hidden`, CSS, or both JSX tags always in the tree).
- Wrap the mounted chart in `role="tabpanel"`.
- Do not change `LOAD_CHART_CAPTION`, `DAILY_LOAD_CAPTION`, legends, bar/polyline series, or aggregation helpers.
- Merge any new Tailwind with `cn()`. Leave this file eslint/prettier clean (HEAD lint on this file is in-scope because we edit it).

#### 2. PlanCalendar mount (S-14.1–S-14.2)

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: One chart region above the grid instead of two stacked figures; keep aggregation calls and calendar chrome as they are.

**Contract**: Replace the consecutive `<TrainingLoadChart … />` and `<DailyLoadChart … />` with a single `<LoadChartTabs weeks={aggregateLoadWeeks(units, logs, today)} days={aggregateDailyLoad(units, logs, today)} />` still above `className="grid grid-cols-7 gap-1"`. Keep both aggregate calls (do not change aggregation). Do not restyle generate (`RefreshCw`, idle `aria-label`, `hidden sm:inline` caption) or day-edit (`grid grid-cols-2`, closed `<details>`, Make AI comment slot). Do not add tab state in PlanCalendar.

#### 3. Source-scan

**Files**: `src/components/plan/PlanCalendar.test.ts`, `src/components/plan/TrainingLoadChart.test.ts`

**Intent**: Calendar/chart chrome is enforced by Vitest source-scan (test-plan §6.1), not Playwright. Moving the mounts will fail today’s `<TrainingLoadChart` scan unless both files update in this phase.

**Contract**:
- `PlanCalendar.test.ts`: keep existing month-chrome / generate / day-edit / race locks (including icon-only generate, Type+Distance row, closed log `<details>`, Make AI slot). Change the load-chart case so it requires `LoadChartTabs` above the month grid, both `aggregateLoadWeeks` and `aggregateDailyLoad`, and does **not** require consecutive `<TrainingLoadChart` + `<DailyLoadChart` JSX in PlanCalendar. Still forbid `2026-` in this file’s scan as today.
- `TrainingLoadChart.test.ts`: keep caption / series / no-chart-library locks. Add scans for `role="tablist"`, `aria-label="Training load"` (or equivalent accessible name), both tab label constants, default `useState` on the daily tab, a ternary (or equivalent) that mounts exactly one of `DailyLoadChart` / `TrainingLoadChart`, `role="tabpanel"`, and that the strings `Weekly` and `Daily` do not appear as tab labels (do not ban `DailyLoadChart` / `DAILY_LOAD_CAPTION`). Cookbook: test-plan §6.1; no Playwright (§6.3 / §7).

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/TrainingLoadChart.test.ts` passes
- `npm test` passes
- Touched-file lint: `npx eslint src/components/plan/PlanCalendar.tsx src/components/plan/PlanCalendar.test.ts src/components/plan/TrainingLoadChart.tsx src/components/plan/TrainingLoadChart.test.ts` passes (repo-wide `npm run lint` is red at HEAD on untouched `training-load.ts` / those tests / `pace-estimate.test.ts`; do not edit those files)
- `npx astro check` passes
- Source-scan locks tablist named Training load, labels `km per week` and `daily load (decay 0.85)` (not Weekly/Daily), default daily chart, exclusive mount, captions unchanged, `LoadChartTabs` above the month grid, calendar-mobile-chrome generate and day-edit chrome unchanged

#### Manual Verification:

- On `/dashboard` with a plan: above the month grid, tabs plus a single chart; first paint is the daily load (decay 0.85) polyline; switching to km per week shows week bars only; each selected chart still shows its existing caption and Easy/Threshold/Speed legend
- Generate control and day-edit form (Type+Distance row, closed Log disclosure, Make AI slot) look as they did after `calendar-mobile-chrome` — no restyle from this change
- At ~390px and ~1280px the tablist is usable and only one chart is visible

## Testing Strategy

### Unit Tests:

- Colocated source-scan as in Phase 1.3. Deliberate-break: restore stacked unconditional mounts in PlanCalendar, or default `useState` to the km-per-week tab, or relabel tabs Weekly/Daily, and confirm the scan goes red.

### Manual Testing Steps:

1. Open a plan on `/dashboard` and confirm one chart (daily decay) plus tabs above the grid.
2. Switch to km per week and back; confirm the other chart unmounts (only one figure).
3. Confirm generate and day-edit chrome are unchanged at ~390 and ~1280.

## Performance Considerations

Unmounting the inactive chart drops one SVG or bar tree; both aggregates still run once per render as today. No new network.

## Migration Notes

None. Client state only; no schema, no URL.

## References

- Locked spec: `context/changes/load-chart-tabs/change.md`
- Research: `context/changes/load-chart-tabs/research.md`
- Captions: `src/components/plan/TrainingLoadChart.tsx` (`LOAD_CHART_CAPTION`, `DAILY_LOAD_CAPTION`)
- Test cookbook: `context/foundation/test-plan.md` §6.1 / §6.3 / §7
- Prior chrome to preserve: `context/changes/calendar-mobile-chrome/plan.md`
- Tab-label alternative: `context/backlog.md` FU-137

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tabbed load charts

#### Automated

- [x] 1.1 `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/TrainingLoadChart.test.ts` passes — 9cf5287
- [x] 1.2 `npm test` passes — 9cf5287
- [x] 1.3 Touched-file lint: `npx eslint src/components/plan/PlanCalendar.tsx src/components/plan/PlanCalendar.test.ts src/components/plan/TrainingLoadChart.tsx src/components/plan/TrainingLoadChart.test.ts` passes (repo-wide `npm run lint` is red at HEAD on untouched `training-load.ts` / those tests / `pace-estimate.test.ts`; do not edit those files) — 9cf5287
- [x] 1.4 `npx astro check` passes — 9cf5287
- [x] 1.5 Source-scan locks tablist named Training load, labels `km per week` and `daily load (decay 0.85)` (not Weekly/Daily), default daily chart, exclusive mount, captions unchanged, `LoadChartTabs` above the month grid, calendar-mobile-chrome generate and day-edit chrome unchanged — 9cf5287

#### Manual

- [ ] 1.6 On `/dashboard` with a plan: above the month grid, tabs plus a single chart; first paint is the daily load (decay 0.85) polyline; switching to km per week shows week bars only; each selected chart still shows its existing caption and Easy/Threshold/Speed legend
- [ ] 1.7 Generate control and day-edit form (Type+Distance row, closed Log disclosure, Make AI slot) look as they did after `calendar-mobile-chrome` — no restyle from this change
- [ ] 1.8 At ~390px and ~1280px the tablist is usable and only one chart is visible
