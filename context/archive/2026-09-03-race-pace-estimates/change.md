# race-pace-estimates

- **status:** archived
- **created:** 2026-09-03
- **updated:** 2026-09-03
- **archived_at:** 2026-09-03T19:52:15Z
- **title:** Show estimated race paces on the profile/setup form

## Notes

Source: P-11.

### Files

- `src/components/setup/SetupForm.tsx`
- `src/lib/services/` (new pace-estimate service or utility)

### Today

`SetupForm` collects weekly km, race targets, rest/long days, and mix percentages. There is no pace predictor or display of estimated finish times.

### Do

1. Add a read-only **Estimated paces** section below the race list in `SetupForm`.
2. Use a simple predictor (Riegel formula or equivalent) based on the member's best recent race result (if available from `races` with a logged time) or a manual input (recent race distance + time).
3. Show estimates for common distances: 5K, 10K, Half, Marathon — formatted as `H:MM:SS`.
4. If no race result is available, show a prompt to log a recent race time.
5. Recalculate on input change (client-side is fine for v1).

### Do not

- Persist estimates in the DB (derived data, compute on render).
- Change race CRUD or priority logic.
- Integrate with Strava import.

### Visible result

Profile page shows estimated paces for standard distances based on the member's data.
