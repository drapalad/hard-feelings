# Daily Training Load Decay Chart Implementation Plan

## Overview

Add a per-day exponential-decay load model in three intensity buckets (Easy, Threshold, Speed) and render it as an SVG polyline chart alongside the existing weekly stacked-bar chart inside PlanCalendar.

## Current State Analysis

- `training-load.ts` already defines `LoadBucket`, `bucketWorkoutType`, `pickDayLoad`, and `aggregateLoadWeeks` (weekly aggregation).
- `TrainingLoadChart.tsx` renders a CSS stacked-bar chart per week using `LoadWeek[]`.
- `PlanCalendar.tsx` calls `aggregateLoadWeeks(units, logs, today)` and passes the result to `TrainingLoadChart`.
- `loadChartWindow` returns 8 Mondays (56 days) around today — same window works for per-day decay.
- No per-day load metric or decay model exists.

## Desired End State

Above or below the calendar grid, a new SVG polyline chart renders three colored lines (Easy — green, Threshold — amber, Speed — red) showing exponentially-decaying daily load over the same 56-day window. The decay formula is `load_b[d] = load_b[d-1] * 0.85 + km_b[d]`. Hovering a date shows a tooltip with date + three load values. The existing weekly bar chart remains visible. Unit tests cover `nextDailyLoad` and `aggregateDailyLoad` with ≥3 scenarios each.

### Key Discoveries:

- `pickDayLoad(date, today, unit, log)` already resolves which source (log vs plan) wins per day and returns `{ bucket, distanceKm }` — reusable for per-day decay input.
- `loadChartWindow(today)` already computes the 56-day `from`/`to` range — reusable for the daily series.
- `roundKm` from `@/lib/km` rounds to 1 decimal — use for display values.
- Existing chart uses no charting library (CSS only) — new chart must use SVG per LOCKED DECISIONS.

## What We're NOT Doing

- Removing or replacing the existing weekly stacked-bar chart
- Changing workout types, accent taxonomy, or plan generation
- Using a charting library (SVG only)
- Using mock data — only real planned/logged data from units/logs arrays
- Adding new data fetching — reusing the same `units`, `logs`, `today` already available in PlanCalendar

## Implementation Approach

Two phases: (1) pure-logic functions with tests, (2) SVG chart component wired into the calendar.

Phase 1 adds `nextDailyLoad` and `aggregateDailyLoad` to `training-load.ts` alongside existing weekly helpers, plus unit tests. Phase 2 creates a `DailyLoadChart` SVG component in `TrainingLoadChart.tsx` (or a sibling) and wires it into `PlanCalendar.tsx`.

## Phase 1: Daily Load Decay Model + Tests

### Overview

Implement the exponential decay functions and unit tests in the existing `training-load.ts` and `training-load.test.ts` files.

### Changes Required:

#### 1. Daily load types and functions

**File**: `src/components/plan/training-load.ts`

**Intent**: Add `DECAY_FACTOR` constant, `DailyLoadEntry` interface, `nextDailyLoad(prev, todayKm)` function, and `aggregateDailyLoad(units, logs, today)` function. `nextDailyLoad` applies `prev * DECAY_FACTOR + todayKm` per bucket. `aggregateDailyLoad` iterates the 56-day window from `loadChartWindow`, calls `pickDayLoad` for each day, accumulates via `nextDailyLoad`, and returns `DailyLoadEntry[]`.

**Contract**: 
```ts
export const DECAY_FACTOR = 0.85;

export interface DailyLoadEntry {
  date: string;
  easy: number;
  threshold: number;
  speed: number;
}

export function nextDailyLoad(
  prev: { easy: number; threshold: number; speed: number },
  todayKm: { easy: number; threshold: number; speed: number },
): { easy: number; threshold: number; speed: number };

export function aggregateDailyLoad(
  units: TrainingUnit[],
  logs: WorkoutLog[],
  today: string,
): DailyLoadEntry[];
```

#### 2. Unit tests

**File**: `src/components/plan/training-load.test.ts`

**Intent**: Add test suites for `nextDailyLoad` (at least 3 scenarios: zero prev + zero km, steady input, spike then decay) and `aggregateDailyLoad` (empty inputs, single-day input, multi-day with mixed buckets). Follow existing test patterns in the file.

**Contract**: New `describe("nextDailyLoad", …)` and `describe("aggregateDailyLoad", …)` blocks appended to the existing test file.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run src/components/plan/training-load.test.ts`
- Type checking passes: `npx tsc --noEmit`
- `nextDailyLoad` and `aggregateDailyLoad` are exported from `training-load.ts`

## Phase 2: SVG Polyline Chart + Calendar Wiring

### Overview

Create a DailyLoadChart component using SVG polylines and wire it into PlanCalendar alongside (below) the existing weekly bar chart.

### Changes Required:

#### 1. DailyLoadChart SVG component

**File**: `src/components/plan/TrainingLoadChart.tsx`

**Intent**: Add a `DailyLoadChart` component below the existing `TrainingLoadChart` default export (or as a named export). Renders an SVG with three polylines (Easy=green/#94a3b8, Threshold=amber/#fb923c, Speed=red/#f87171) over the date range. X-axis shows dates, Y-axis shows load units. Include a hover tooltip (HTML overlay positioned via mouse coords or SVG title elements) showing date + three rounded values.

**Contract**: Named export `DailyLoadChart` accepting `{ days: DailyLoadEntry[] }`. SVG element with viewBox, three `<polyline>` elements, x-axis date labels, y-axis scale. Tooltip on hover via `onMouseMove`/`onMouseLeave` state or SVG `<title>` elements per data point.

#### 2. Wire into PlanCalendar

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Import `aggregateDailyLoad` and `DailyLoadChart`, compute the daily load series from the same `units`, `logs`, `today` already in scope, and render `<DailyLoadChart days={…} />` adjacent to the existing `<TrainingLoadChart>`.

**Contract**: Add `import { aggregateDailyLoad } from "./training-load"` (already partially imported) and `import { DailyLoadChart } from "./TrainingLoadChart"`. Call `aggregateDailyLoad(units, logs, today)` inline or in a `useMemo`. Render below the existing `<TrainingLoadChart>`.

#### 3. Chart component tests

**File**: `src/components/plan/TrainingLoadChart.test.ts`

**Intent**: Add source-read tests verifying the DailyLoadChart export exists, uses SVG elements (`<svg`, `<polyline`), and references the three bucket colors. Follow the existing `readFileSync` pattern in the file.

**Contract**: New `describe("DailyLoadChart source", …)` block in the existing test file.

### Success Criteria:

#### Automated Verification:

- All tests pass: `npx vitest run src/components/plan/`
- Type checking passes: `npx tsc --noEmit`
- Build succeeds: `npx astro check && npx astro build`
- `DailyLoadChart` is exported from `TrainingLoadChart.tsx`
- SVG polyline elements exist in the chart source

#### Manual Verification:

- Three colored load lines (green, amber, red) are visible below the weekly bar chart on the dashboard calendar
- A spike after a hard session decays visibly over ~7 days
- Hovering a date shows a tooltip with date + three load values

## Testing Strategy

### Unit Tests:

- `nextDailyLoad`: zero+zero, steady input, spike+decay verification
- `aggregateDailyLoad`: empty arrays, single day, multi-day with mixed buckets and logs
- Source-read tests for DailyLoadChart SVG structure

## Performance Considerations

`aggregateDailyLoad` iterates 56 days — negligible. SVG with 56 data points per line (168 points total) is lightweight.

## References

- Existing weekly load: `src/components/plan/training-load.ts`
- Chart component: `src/components/plan/TrainingLoadChart.tsx`
- Calendar: `src/components/plan/PlanCalendar.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Daily Load Decay Model + Tests

#### Automated

- [x] 1.1 Unit tests pass: `npx vitest run src/components/plan/training-load.test.ts` — 73c6792
- [x] 1.2 Type checking passes: `npx tsc --noEmit` — 73c6792
- [x] 1.3 `nextDailyLoad` and `aggregateDailyLoad` are exported from `training-load.ts` — 73c6792

### Phase 2: SVG Polyline Chart + Calendar Wiring

#### Automated

- [x] 2.1 All tests pass: `npx vitest run src/components/plan/` — 14df3e5
- [x] 2.2 Type checking passes: `npx tsc --noEmit` — 14df3e5
- [x] 2.3 Build succeeds: `npx astro check && npx astro build` — 14df3e5
- [x] 2.4 `DailyLoadChart` is exported from `TrainingLoadChart.tsx` — 14df3e5
- [x] 2.5 SVG polyline elements exist in the chart source — 14df3e5

#### Manual

- [x] 2.6 Three colored load lines (green, amber, red) are visible below the weekly bar chart on the dashboard calendar
- [x] 2.7 A spike after a hard session decays visibly over ~7 days
- [x] 2.8 Hovering a date shows a tooltip with date + three load values
