# Race Pace Estimates Implementation Plan

## Overview

Add a read-only "Estimated paces" section to `SetupForm` that predicts finish times for 5K, 10K, Half Marathon, and Marathon distances using the Riegel formula. The predictor takes a manual reference race input (distance + time) since the existing `Race` type has no logged finish time. Estimates recalculate on input change, client-side only.

## Current State Analysis

`SetupForm.tsx` manages weekly km, long/rest days, mix percentages, and the race calendar (add/edit/delete). The `Race` type (`src/types.ts`) carries `id`, `date`, `priority`, `goal?`, `name?` — no finish time or distance field. No pace prediction or race-time estimation exists anywhere in the app.

### Key Discoveries:

- `Race` has no `time` or `distance` field — v1 cannot auto-detect a "best recent result" from existing races.
- `SetupForm` is a React island receiving props from server-side Astro; all state is local `useState`.
- `src/lib/services/` holds business-logic modules with colocated `.test.ts` files — the pace estimator fits here.
- The `cn()` utility from `@/lib/utils` merges Tailwind classes.

## Desired End State

The Profile tab's SetupForm shows an "Estimated paces" card below the race calendar. The user enters a recent race distance (dropdown: 5K/10K/Half/Marathon/Custom) and finish time (HH:MM:SS input). Riegel-formula estimates for all four standard distances appear instantly, formatted as `H:MM:SS`. If no reference input is provided, a prompt tells the user to enter a recent race time. Nothing is persisted — estimates are derived on render.

## What We're NOT Doing

- Persisting estimates in the database (derived data).
- Adding distance/time fields to the `Race` DB model or CRUD.
- Integrating with Strava import.
- Server-side computation or API endpoints for estimates.
- Changing race CRUD or priority logic.

## Implementation Approach

Two deliverables: (1) a pure `pace-estimate.ts` service with the Riegel formula, formatting, and unit tests; (2) a `RacePaceEstimates` React component wired into `SetupForm` below the race calendar section. The service is fully testable without DOM; the component is a thin UI layer over it.

## Phase 1: Pace estimate service and tests

### Overview

Create `src/lib/services/pace-estimate.ts` with the Riegel prediction function, time formatting, and standard-distance constants. Add comprehensive unit tests.

### Changes Required:

#### 1. Pace estimate service

**File**: `src/lib/services/pace-estimate.ts` (new)

**Intent**: Export a pure function that takes a reference race (distance in km, time in seconds) and returns predicted finish times for 5K, 10K, Half Marathon, and Marathon. Also export a `formatTime` helper that converts seconds to `H:MM:SS` string, and the standard-distance constant array.

**Contract**: `predictTimes(distanceKm: number, timeSeconds: number): PaceEstimate[]` where `PaceEstimate = { label: string; distanceKm: number; timeSeconds: number; formatted: string }`. The Riegel formula is `t2 = t1 * (d2 / d1) ^ 1.06`. Standard distances: `[{ label: "5K", km: 5 }, { label: "10K", km: 10 }, { label: "Half", km: 21.0975 }, { label: "Marathon", km: 42.195 }]`. `formatTime(seconds: number): string` produces `H:MM:SS` (hours omitted when zero → `MM:SS`).

#### 2. Unit tests

**File**: `src/lib/services/pace-estimate.test.ts` (new)

**Intent**: Test `predictTimes` with known reference values (e.g., 20:00 5K → expected 10K, Half, Marathon times), edge cases (zero time, same distance), and `formatTime` formatting.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run src/lib/services/pace-estimate.test.ts`
- Type checking passes: `npx tsc --noEmit`

## Phase 2: UI component in SetupForm

### Overview

Add a `RacePaceEstimates` component rendered inside `SetupForm` below the race calendar section. It contains a reference-race input (distance dropdown + time field) and a read-only estimates display.

### Changes Required:

#### 1. RacePaceEstimates component

**File**: `src/components/setup/SetupForm.tsx`

**Intent**: Add a new section after the race calendar `</section>` with: (a) a distance selector (5K / 10K / Half / Marathon / Custom with a km input), (b) a time input (text field, `HH:MM:SS` or `MM:SS`), (c) a results list showing predicted times for all four standard distances. When no valid input is entered, show a prompt message. Use existing `FormField` and styling patterns. All state is local `useState`; recalculate on every input change via the service from Phase 1.

**Contract**: New `<section>` JSX block with heading "Estimated paces". Internal helper `parseTimeInput(value: string): number | null` converts `HH:MM:SS` or `MM:SS` to seconds. Calls `predictTimes` from `@/lib/services/pace-estimate` and renders the array. Distance selector is a `<select>` using the same `fieldClass` pattern. No props change on `SetupForm`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Lint passes: `npx eslint src/components/setup/SetupForm.tsx`
- Build succeeds: `npx astro build`

#### Manual Verification:

- Estimated paces section appears below the race calendar on the Profile tab
- Entering a reference time shows predicted times for all four distances
- Clearing the input shows the prompt message

## Testing Strategy

### Unit Tests:

- `predictTimes` returns correct Riegel predictions for known inputs
- `predictTimes` handles edge cases (reference distance equals target, very short/long times)
- `formatTime` formats seconds correctly (with and without hours)
- `parseTimeInput` in the component parses `MM:SS` and `HH:MM:SS` formats

### Manual Testing Steps:

1. Open the Profile tab, scroll below the race calendar
2. Select a reference distance and enter a time — estimates appear
3. Change the time — estimates update immediately
4. Clear the time — prompt message appears

## Performance Considerations

None significant. The Riegel formula is O(1) per distance; recalculating on every keystroke is negligible.

## References

- Riegel formula: `t2 = t1 * (d2 / d1) ^ 1.06`
- Existing form patterns: `src/components/setup/SetupForm.tsx`
- Service pattern: `src/lib/services/races.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Pace estimate service and tests

#### Automated

- [x] 1.1 Unit tests pass: `npx vitest run src/lib/services/pace-estimate.test.ts` — 2597640
- [x] 1.2 Type checking passes: `npx tsc --noEmit` — 2597640

### Phase 2: UI component in SetupForm

#### Automated

- [x] 2.1 Type checking passes: `npx tsc --noEmit` — e07406f
- [x] 2.2 Lint passes: `npx eslint src/components/setup/SetupForm.tsx` — e07406f
- [x] 2.3 Build succeeds: `npx astro build` — e07406f

#### Manual

- [x] 2.4 Estimated paces section appears below the race calendar on the Profile tab
- [x] 2.5 Entering a reference time shows predicted times for all four distances
- [x] 2.6 Clearing the input shows the prompt message
