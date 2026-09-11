# Log Pace & Heart Rate Implementation Plan

## Overview

Add optional average pace (`avg_pace_sec_per_km`) and average heart rate (`avg_hr`) fields to the workout log. These nullable integer columns extend the existing `workout_logs` table. The log form in the day panel gains two optional inputs (pace as `mm:ss /km`, HR as bpm). The calendar day cell shows logged pace and/or HR in a muted secondary line. The API validates pace 120–900 s/km and HR 60–220 bpm.

## Current State Analysis

- `workout_logs` table has columns: `id`, `user_id`, `date`, `type`, `distance_km`, `created_at`. No pace or HR fields.
- `WorkoutLog` type in `src/types.ts`: `{ date, type, distanceKm }`. No pace/HR.
- `workout-log.ts` service: `upsertLog` writes `user_id, date, type, distance_km`. `LOG_COLUMNS` selects `date, type, distance_km`. `workoutLogWriteSchema` validates `{ date, distanceKm? }`.
- `POST /api/plan/logs` passes `{ date, distanceKm }` through the schema and into `upsertLog`.
- `PlanCalendar.tsx` `DayPanel` has a log section with a "Log km" input and Save log button. `DaySummary` shows type, distance, structure — no log data.
- `PlanWorkspace.tsx` `saveLog(date, distanceKm)` sends `{ date, distanceKm }` to the API. `onSaveLog` prop is `(date: string, distanceKm: number) => void`.

## Desired End State

After implementation: a member can optionally enter pace (mm:ss /km format, stored as integer seconds) and heart rate (bpm integer) when logging a workout. The day cell on the calendar shows any logged pace and/or HR in a muted line (e.g. `5:12 /km · 148 bpm`). The API rejects out-of-range values (pace < 120 or > 900 s/km, HR < 60 or > 220 bpm). Data round-trips through the API — logged values appear after page reload.

### Key Discoveries:

- The upsert uses `onConflict: "user_id,date"` so adding columns is additive — existing rows keep NULL for the new fields.
- `LOG_COLUMNS` constant controls the SELECT projection; must be extended.
- `workoutLogWriteSchema` is the single validation gate for the POST body.
- `DaySummary` is the grid-cell renderer; `DayPanel` is the detail/edit panel.

## What We're NOT Doing

- Auto-importing pace/HR from Strava (separate feature).
- Changing planned workout fields or generation logic.
- Adding pace/HR to chat-driven logging (chat `resolveWorkoutLog` stays distance-only).
- Displaying pace/HR in the training load chart.

## Implementation Approach

Three phases: (1) DB migration + types, (2) service + API layer, (3) UI — day panel form inputs + calendar cell display. Each phase builds on the previous and is independently testable.

## Phase 1: Migration, Types & Service Layer

### Overview

Add DB columns, extend TypeScript types, update the service layer (schema, parsing, upsert, select).

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260903140000_log_pace_hr.sql`

**Intent**: Add two nullable integer columns to `workout_logs` with CHECK constraints for valid ranges.

**Contract**: `avg_pace_sec_per_km integer` nullable, CHECK 120–900. `avg_hr integer` nullable, CHECK 60–220. No default values. Existing rows unaffected (NULL).

#### 2. TypeScript types

**File**: `src/types.ts`

**Intent**: Add `avgPaceSecPerKm` and `avgHr` optional fields to `WorkoutLog`.

**Contract**: `WorkoutLog.avgPaceSecPerKm?: number`, `WorkoutLog.avgHr?: number`.

#### 3. Service layer — schema, parsing, columns, upsert

**File**: `src/lib/services/workout-log.ts`

**Intent**: Extend `workoutLogWriteSchema` with optional pace/HR validation (pace: integer 120–900, HR: integer 60–220). Update `LOG_COLUMNS` to include the new fields. Update `WorkoutLogRow`, `toWorkoutLog`, `asWorkoutLogRow` to handle the new columns. Update `upsertLog` to write the new fields. Update `resolveWorkoutLog` to carry pace/HR from the patch.

**Contract**:
- `workoutLogWriteSchema` gains `avgPaceSecPerKm: z.number().int().min(120).max(900).optional()` and `avgHr: z.number().int().min(60).max(220).optional()`.
- `LOG_COLUMNS` becomes `"date, type, distance_km, avg_pace_sec_per_km, avg_hr"`.
- `WorkoutLogRow` gains `avg_pace_sec_per_km: number | string | null` and `avg_hr: number | string | null`.
- `toWorkoutLog` maps nulls to `undefined` on the TS type.
- `upsertLog` patch type gains optional `avgPaceSecPerKm` and `avgHr`; these are written to the DB row.
- `resolveWorkoutLog` carries `avgPaceSecPerKm` and `avgHr` from the patch through to the returned `WorkoutLog`.

### Success Criteria:

#### Automated Verification:

- Migration file exists and contains correct ALTER TABLE / CHECK constraints
- TypeScript types compile: `npx tsc --noEmit`
- Existing tests pass: `npx vitest run`

## Phase 2: API Layer

### Overview

Update the API endpoint to accept and return pace/HR fields.

### Changes Required:

#### 1. POST /api/plan/logs

**File**: `src/pages/api/plan/logs.ts`

**Intent**: Pass `avgPaceSecPerKm` and `avgHr` from the validated body through to `upsertLog`. The schema in `workout-log.ts` already validates; the API just forwards.

**Contract**: The `parsed.data` object now includes optional `avgPaceSecPerKm` and `avgHr`; these are spread into the `upsertLog` patch: `{ date: parsed.data.date, distanceKm: parsed.data.distanceKm, avgPaceSecPerKm: parsed.data.avgPaceSecPerKm, avgHr: parsed.data.avgHr }`.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npx tsc --noEmit`
- Existing tests pass: `npx vitest run`

## Phase 3: UI — Form Inputs & Calendar Display

### Overview

Add pace and HR inputs to the day panel log section. Show logged pace/HR on the calendar day cell.

### Changes Required:

#### 1. DayPanel — pace & HR inputs

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Add optional Pace (mm:ss /km text input) and HR (bpm number input) fields to the log section in `DayPanel`. The pace input accepts `mm:ss` format and converts to seconds before calling `onSaveLog`. Pre-populate from existing log values.

**Contract**:
- Two new state variables: `logPace` (string, `mm:ss` format) and `logHr` (string).
- `onSaveLog` prop signature changes to `(date: string, distanceKm: number, avgPaceSecPerKm?: number, avgHr?: number) => void`.
- Pace conversion: split on `:`, `minutes * 60 + seconds`. Empty string → `undefined`.
- HR: parse as integer. Empty string → `undefined`.
- Helper function `formatPace(seconds: number): string` returns `mm:ss` format.
- Helper function `parsePace(input: string): number | undefined` returns seconds or undefined.

#### 2. DaySummary — show logged pace/HR

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: When a log exists for the day and has pace and/or HR, show a muted secondary line below the existing content (e.g. `5:12 /km · 148 bpm`). Show nothing if both are null/undefined.

**Contract**:
- `DaySummary` gains a `log` prop (`WorkoutLog | undefined`).
- Render a `<p>` with `text-xs text-blue-100/50` showing formatted pace and/or HR joined by ` · `. Only show segments that have values.
- Reuse the `formatPace` helper.

#### 3. PlanCalendar — wire log prop to DaySummary

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Pass the log for each date into `DaySummary` so it can display pace/HR.

**Contract**: In the grid's map over `grid`, look up `logByDate.get(date)` and pass as `log` prop to `DaySummary`.

#### 4. PlanCalendar props & PlanWorkspace — update onSaveLog signature

**File**: `src/components/plan/PlanCalendar.tsx`, `src/components/plan/PlanWorkspace.tsx`

**Intent**: Update the `onSaveLog` callback signature to accept optional pace and HR. Update `PlanWorkspace.saveLog` to send the new fields in the POST body.

**Contract**:
- `PlanCalendarProps.onSaveLog` becomes `(date: string, distanceKm: number, avgPaceSecPerKm?: number, avgHr?: number) => void`.
- `PlanWorkspace.saveLog` signature becomes `(date: string, distanceKm: number, avgPaceSecPerKm?: number, avgHr?: number)`.
- POST body: `{ date, distanceKm, avgPaceSecPerKm, avgHr }` (undefined fields are omitted by JSON.stringify).

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npx tsc --noEmit`
- Existing tests pass: `npx vitest run`
- Build succeeds: `npm run build`

#### Manual Verification:

- Log a workout with pace 5:12 and HR 148 → day cell shows `5:12 /km · 148 bpm`
- Log with only pace → shows `5:12 /km` (no HR segment)
- Log with only HR → shows `148 bpm` (no pace segment)
- Log with neither → no secondary line
- Reload page → values persist (round-trip)
- Enter invalid pace (e.g. 1:00 = 60 s/km) → API rejects with validation error

## Testing Strategy

### Unit Tests:

- `parsePace` and `formatPace` helper functions: roundtrip, edge cases (0:00, 15:00, invalid input)
- `workoutLogWriteSchema` validation: valid pace/HR, out-of-range rejected, missing fields accepted

### Integration Tests:

- Existing `workout-log` tests continue to pass (backward compatibility)

### Manual Testing Steps:

1. Open the calendar, select a day with a planned workout, enter pace and HR, save log — verify the day cell updates
2. Reload — verify values persist
3. Enter out-of-range values — verify rejection

## Performance Considerations

None significant. Two additional nullable integer columns add negligible storage and query cost.

## Migration Notes

- The migration is additive (nullable columns, no defaults) — safe to apply without data backfill.
- Existing rows keep NULL for both new columns.
- Worker rollback does not undo this SQL. A `DEP-NNN` item will track applying the migration to hosted Supabase.

## References

- Existing migration: `supabase/migrations/20260815160000_workout_logs.sql`
- Service: `src/lib/services/workout-log.ts`
- API: `src/pages/api/plan/logs.ts`
- Calendar: `src/components/plan/PlanCalendar.tsx`
- Workspace: `src/components/plan/PlanWorkspace.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration, Types & Service Layer

#### Automated

- [x] 1.1 Migration file exists and contains correct ALTER TABLE / CHECK constraints — 38c69c1
- [x] 1.2 TypeScript types compile: `npx tsc --noEmit` — 38c69c1
- [x] 1.3 Existing tests pass: `npx vitest run` — 38c69c1

### Phase 2: API Layer

#### Automated

- [x] 2.1 TypeScript compiles: `npx tsc --noEmit` — 1e55841
- [x] 2.2 Existing tests pass: `npx vitest run` — 1e55841

### Phase 3: UI — Form Inputs & Calendar Display

#### Automated

- [x] 3.1 TypeScript compiles: `npx tsc --noEmit` — 64380d7
- [x] 3.2 Existing tests pass: `npx vitest run` — 64380d7
- [x] 3.3 Build succeeds: `npm run build` — 64380d7

#### Manual

- [x] 3.4 Log a workout with pace and HR — day cell shows formatted values
- [x] 3.5 Reload page — values persist (round-trip)
- [x] 3.6 Enter invalid pace/HR — API rejects with validation error
