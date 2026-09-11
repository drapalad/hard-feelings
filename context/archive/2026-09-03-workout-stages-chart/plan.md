# Workout Stages Chart Implementation Plan

## Overview

Parse the planned unit’s free-text `structure` string into warm-up / work / recovery / cool-down segments and render a horizontal stacked bar in the calendar day panel. Fail closed to a single solid bar. Client-side only — no API, no DB column, no generate change.

## Current State Analysis

- `TrainingUnit.structure` is `string | undefined` (`src/types.ts`). There is no `description` or `stages` field.
- Generate does not write structured stages. Typical stored values are short labels (`3x2k`, `6 x 1 km`, `90 min`) or free text members type into Edit.
- `DayPanel` in `src/components/plan/PlanCalendar.tsx` shows `unit.structure` as a heading and keeps the same string in the Structure input while editing. Grid cells truncate the string (`hidden sm:block`).
- `TrainingLoadChart.tsx` already draws CSS stacked bars with `cn()` and no charting library — the visual pattern to reuse.
- Locked Notes (P-12 v1) forbid a `stages` jsonb column, a new endpoint, LLM parsing, and generate/coach mutation changes.

## Desired End State

Opening a planned day shows a colored stage timeline in the day panel. A comma-separated session such as `2 km warm-up, 6 × 800 m @ 3:40, 2 km cool-down` becomes gray / work / gray segments with hover labels. `Easy 8 km` or an unparseable string is one solid bar. Rest days stay chart-less. Edit still uses the Structure text field.

### Key Discoveries:

- The product word “description” maps to `TrainingUnit.structure` — there is no other string to parse (`src/types.ts:13`).
- Day panel lives inside `PlanCalendar.tsx` (`DayPanel`, ~209). Extracting `WorkoutStagesChart.tsx` keeps the calendar file from growing another chart inline.
- `PlanCalendar.test.ts` is a source-read lock on chrome; new chart wiring should be asserted there the same way `TrainingLoadChart` is.
- `cn()` from `@/lib/utils` is required for any class merge (`AGENTS.md`).

## What We're NOT Doing

- Adding `training_units.stages` or any migration.
- Replacing the Structure text editor with a stages builder (full P-12 editor is a later change).
- Changing generate, chat mutations, or persist schemas.
- A new API endpoint or server-side parse.
- An npm charting library.
- Putting the timeline on month-grid cells or PlanList.
- LLM / fuzzy NLP parsing.

## Implementation Approach

Two phases: (1) a pure parser + fallback + unit tests; (2) an HTML stacked-bar component wired into the read-only day panel, with source-read tests.

## Critical Implementation Details

**User experience spec.** The timeline is read-only chrome. Keep the structure sentence visible so members can still read and edit the source string. Hide the bar while the Edit form is open (the draft string is not yet saved). Native `title` plus `aria-label` on each segment is the hover/tap surface — no tooltip library.

**Timing & lifecycle.** Parse on render from the current `unit.structure` and `unit.distanceKm` / `unit.type`. After Save, `DayPanel` remounts via `key={selectedInMonth}` only when the date changes; the parent passes the updated unit, so the bar must derive from props, not local parse cache.

## Phase 1: Parse structure into stages

### Overview

Add a deterministic, no-throw parser that turns a structure string (plus planned km/type fallback) into weighted segments.

### Changes Required:

#### 1. Parser module

**File**: `src/components/plan/workout-stages.ts`

**Intent**: Classify comma-separated clauses into `warmup` | `work` | `recovery` | `cooldown` and assign a positive width weight. Never throw.

**Contract**:
- Export `WorkoutStageKind = "warmup" | "work" | "recovery" | "cooldown"`.
- Export `WorkoutStage = { kind: WorkoutStageKind; label: string; weight: number }`.
- Export `parseWorkoutStages(input: { structure?: string; distanceKm: number; type: WorkoutType }): WorkoutStage[]`.
- Always return at least one stage with `weight > 0`.
- Split on commas. Strip a leading `N km:` / `N km —` session prefix (the example in Notes).
- Keyword classify (case-insensitive): `warm-up` / `warmup` / `wu` → warmup; `cool-down` / `cooldown` / `cd` → cooldown; `recovery` / `rest` / `jog` / `easy jog` → recovery; `×` / `x` interval, `@`, `tempo`, `threshold`, `interval`, `repeat` → work. Unclassified clauses with a distance or time stay `work`.
- `N × dist` (or `Nxdist`) is **one** work stage whose weight is `N * converted distance`, not N work/recovery pairs (do not invent recovery).
- Distances: `km` as-is; `m` / `meter` ÷ 1000. Times: `min` / `minutes` as minutes; convert to km-equivalent at **5:00 /km** (12 km/h) so mixed units share one axis. Clauses with no quantity get weight `1`.
- Always parse quantity-bearing clauses (including a lone `N × dist`). Fallback to one stage only when the string is empty or has **no** quantity and **no** warmup/work/recovery/cooldown keyword: kind `work`, label = trimmed structure or `{distanceKm} km {type}`, weight = `max(distanceKm, 1)`. A single easy label with a km figure (`Easy 8 km`) is still one stage (the km is the quantity).
- No LLM. No network.

#### 2. Parser tests

**File**: `src/components/plan/workout-stages.test.ts`

**Intent**: Lock the Notes example, the easy fallback, empty structure, and interval-as-one-block.

**Contract**: Colocated Vitest. Cover at least:
- `2 km warm-up, 6 × 800 m @ 3:40, 2 km cool-down` → three stages (warmup, work, cooldown) with work weight `6 * 0.8`.
- `Easy 8 km` → one stage.
- `""` / missing structure with `distanceKm: 8`, `type: "base"` → one stage, does not throw.
- `6x1k` / `6 x 1 km` → one work stage (not twelve alternating segments).

### Success Criteria:

#### Automated Verification:

- Parser tests pass: `npx vitest run src/components/plan/workout-stages.test.ts`
- TypeScript compiles: `npx tsc --noEmit`
- Full suite: `npx vitest run`

---

## Phase 2: Day-panel stacked bar

### Overview

Render the segments as a horizontal HTML bar in the read-only day panel and lock the wiring with source-read tests.

### Changes Required:

#### 1. Chart component

**File**: `src/components/plan/WorkoutStagesChart.tsx`

**Intent**: Draw a full-width horizontal stacked bar from `parseWorkoutStages` output using Tailwind + `cn()`, matching load-chart colors.

**Contract**:
- Props: `{ structure?: string; distanceKm: number; type: WorkoutType }`.
- Colors: warmup + cooldown `bg-slate-400`; recovery `bg-sky-400`; work `bg-amber-400`; work when `type` is `threshold` or `anaerobic` uses `bg-red-400`.
- Each segment: `flex` share `weight / sum(weights)`, `min-w-px`, `title` and `aria-label` = kind + label (duration or distance text from the clause).
- Wrapper: `role="img"` and an accessible name such as `Workout stages`.
- No recharts / chart.js / canvas library.

#### 2. Day panel wiring

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Show the timeline under the structure heading in the read-only planned-unit block; omit it while editing and on rest days.

**Contract**: Import `WorkoutStagesChart`. Render it only when `unit` is defined and `editing` is false. Keep the structure sentence. Do not add the bar to `DaySummary` cells.

#### 3. Source-read lock

**File**: `src/components/plan/PlanCalendar.test.ts` and `src/components/plan/WorkoutStagesChart.test.ts`

**Intent**: Assert the panel mounts the chart and the chart stays library-free.

**Contract**: `PlanCalendar.tsx` source contains `WorkoutStagesChart` and `unit.distanceKm` / `unit.structure` / `unit.type` passed through. Chart source contains `cn(`, the four color tokens, `title=`, and does not contain `recharts` / `chart.js`.

### Success Criteria:

#### Automated Verification:

- Chart and calendar tests pass: `npx vitest run src/components/plan/workout-stages.test.ts src/components/plan/WorkoutStagesChart.test.ts src/components/plan/PlanCalendar.test.ts`
- TypeScript compiles: `npx tsc --noEmit`
- Lint: `npx eslint src/components/plan/workout-stages.ts src/components/plan/WorkoutStagesChart.tsx src/components/plan/PlanCalendar.tsx src/components/plan/workout-stages.test.ts src/components/plan/WorkoutStagesChart.test.ts src/components/plan/PlanCalendar.test.ts`
- Full suite: `npx vitest run`

#### Manual Verification:

- Open a planned day whose structure is `2 km warm-up, 6 × 800 m @ 3:40, 2 km cool-down` and confirm a three-color bar; hover/tap a segment shows its label.
- Open a day whose structure is `Easy 8 km` (or similar) and confirm a single solid bar, no error.
- Confirm the bar is absent on a rest day and hidden while Edit is open.

---

## Testing Strategy

### Unit Tests:

- Parser fixtures listed in Phase 1 (structured, easy, empty, compact interval).
- Chart source-read: colors, `cn()`, no chart library.

### Integration Tests:

- None. No API or persist change.

### Manual Testing Steps:

1. Generate or edit a unit to the Notes example string; open the day panel; inspect the bar and hover labels.
2. Edit structure to `Easy 8 km`; Save; confirm one bar.
3. Rest day: no bar. Edit mode: no bar, Structure field unchanged.

## Performance Considerations

Parse is O(clauses) on a 500-char cap (`structure` schema). No memo required.

## Migration Notes

None. Rollback is revert the UI files.

## References

- Change notes: `context/changes/workout-stages-chart/change.md`
- Load-chart pattern: `src/components/plan/TrainingLoadChart.tsx`
- Day panel: `src/components/plan/PlanCalendar.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Parse structure into stages

#### Automated

- [x] 1.1 Parser tests pass: `npx vitest run src/components/plan/workout-stages.test.ts` — c553cb6
- [x] 1.2 TypeScript compiles: `npx tsc --noEmit` — c553cb6
- [x] 1.3 Full suite: `npx vitest run` — c553cb6

### Phase 2: Day-panel stacked bar

#### Automated

- [x] 2.1 Chart and calendar tests pass: `npx vitest run src/components/plan/workout-stages.test.ts src/components/plan/WorkoutStagesChart.test.ts src/components/plan/PlanCalendar.test.ts` — 4fe6253
- [x] 2.2 TypeScript compiles: `npx tsc --noEmit` — 4fe6253
- [x] 2.3 Lint: `npx eslint src/components/plan/workout-stages.ts src/components/plan/WorkoutStagesChart.tsx src/components/plan/PlanCalendar.tsx src/components/plan/workout-stages.test.ts src/components/plan/WorkoutStagesChart.test.ts src/components/plan/PlanCalendar.test.ts` — 4fe6253
- [x] 2.4 Full suite: `npx vitest run` — 4fe6253

#### Manual

- [ ] 2.5 Open a planned day whose structure is `2 km warm-up, 6 × 800 m @ 3:40, 2 km cool-down` and confirm a three-color bar; hover/tap a segment shows its label.
- [ ] 2.6 Open a day whose structure is `Easy 8 km` (or similar) and confirm a single solid bar, no error.
- [ ] 2.7 Confirm the bar is absent on a rest day and hidden while Edit is open.
