# daily-load-decay

- **status:** archived
- **created:** 2026-09-03
- **updated:** 2026-09-03
- **archived_at:** 2026-09-03T19:52:15Z
- **title:** Daily training load chart with exponential decay in 3 intensity dimensions

## Notes

Source: P-09 (verdict: tak — 3 dimensions Easy/Threshold/Speed).

### Files

- `src/components/plan/training-load.ts` (new or extend)
- `src/components/plan/TrainingLoadChart.tsx` (new or extend)
- `src/components/plan/PlanCalendar.tsx` (wires data into chart)

### Today

`PlanCalendar` shows a weekly stacked bar (planned vs logged km). There is no per-day load metric and no decay model.

### Formula

For each intensity bucket `b ∈ {easy, threshold, speed}`:

```
load_b[d] = load_b[d-1] * 0.85 + km_b[d]
```

- `km_b[d]` — kilometres in bucket `b` on day `d` (from logged `workout_type` mapping or planned `type`/`accent`).
- Decay factor **0.85** (configurable constant).
- Bucket assignment: `easy` = easy/recovery/long (non-tempo segments), `threshold` = tempo/threshold/marathon-pace, `speed` = intervals/VO₂max/race-pace repeats. Map from `effective_type` / `effective_accent` if available, otherwise from `type`.

### Do

1. Implement `nextDailyLoad(prev, todayKm)` and `aggregateDailyLoad(days)` producing `{ date, easy, threshold, speed }[]`.
2. Replace or supplement the weekly bar with an SVG (or canvas) polyline chart showing **3 lines** (Easy — green, Threshold — amber, Speed — red) over the visible date range.
3. X-axis: dates. Y-axis: load units (km-equivalent). Tooltip on hover showing date + three values.
4. Wire into `PlanCalendar` or a sibling component above/below the month grid.
5. Unit-test `nextDailyLoad` and `aggregateDailyLoad` with at least 3 scenarios (empty, steady, spike+decay).

### Do not

- Remove the existing weekly summary bar (keep it or place the new chart alongside).
- Change workout types, accent taxonomy, or plan generation.

### Visible result

Above or below the calendar grid, three colored load lines show Easy / Threshold / Speed load decaying daily. A spike after a hard session decays visibly over ~7 days.
