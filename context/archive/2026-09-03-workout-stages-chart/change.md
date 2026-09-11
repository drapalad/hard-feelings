# workout-stages-chart

- **status:** archived
- **created:** 2026-09-03
- **updated:** 2026-09-03
- **archived_at:** 2026-09-03T19:52:15Z
- **title:** Visual stage breakdown for structured workouts on the day panel

## Notes

Source: P-12.

### Files

- `src/components/plan/PlanCalendar.tsx` (or a new `WorkoutStagesChart.tsx`)
- Day-edit / day-detail panel component

### Today

The day panel shows workout description as text (e.g. "10 km: 2 km warm-up, 6 × 800 m @ 3:40, 2 km cool-down"). There is no visual breakdown of stages.

### Do

1. Parse workout `description` (or a structured `stages` field if one exists) into segments: warm-up, work intervals, recovery, cool-down.
2. Render a horizontal stacked bar (or segmented timeline) in the day panel showing each stage with a distinct color: warm-up (gray), work (amber/red by intensity), recovery (blue), cool-down (gray).
3. Each segment shows duration or distance label on hover/tap.
4. If the workout has no parseable structure (e.g. just "Easy 8 km"), show a single solid bar — do not error.
5. Keep it client-side; no new API endpoint needed.

### Do not

- Change workout generation or coach mutations.
- Add a new DB column for stages (parse from description for v1).

### Visible result

Day panel for a structured workout shows a colored stage timeline instead of (or alongside) plain text.
