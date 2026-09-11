# log-pace-hr

- **status:** archived
- **created:** 2026-09-03
- **updated:** 2026-09-03
- **archived_at:** 2026-09-03T19:52:15Z
- **title:** Log actual pace and heart rate when completing a workout

## Notes

Source: P-10.

### Files

- `src/types.ts` (extend `WorkoutLog` or equivalent)
- `src/lib/services/workout-log.ts`
- `src/pages/api/plan/*` (log endpoint)
- `src/components/plan/PlanCalendar.tsx` (day cell display)
- Migration: `supabase/migrations/20260903140000_log_pace_hr.sql` + RLS

### Today

Logging a workout records completion status and optionally distance. There is no pace or heart-rate field.

### Do

1. Add `avg_pace_sec_per_km integer nullable` and `avg_hr integer nullable` columns to the workout-log table (migration + RLS per-member).
2. Extend the log form (day-edit panel or inline) with optional **Pace** (`mm:ss /km` input, stored as seconds) and **HR** (`bpm` integer).
3. On the calendar day cell, show logged pace and/or HR in a muted secondary line (e.g. `5:12 /km · 148 bpm`). Show nothing if null.
4. Validate: pace 120–900 s/km, HR 60–220 bpm. Reject out-of-range on the API.
5. Update `src/types.ts` with the new fields.

### Do not

- Auto-import from Strava (separate feature).
- Change planned workout fields or generation.

### Visible result

After logging, the day cell shows pace and HR; the data round-trips through the API.
