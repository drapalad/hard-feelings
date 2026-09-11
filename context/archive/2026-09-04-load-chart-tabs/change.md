---
change_id: load-chart-tabs
title: Switch km-per-week and daily-load charts with one visible
status: archived
created: 2026-09-04
updated: 2026-09-04
archived_at: 2026-09-04T22:35:22Z
---

## Notes

Files: `src/components/plan/PlanCalendar.tsx`, `src/components/plan/TrainingLoadChart.tsx`. Source-scan in `PlanCalendar.test.ts` and `TrainingLoadChart.test.ts`.
Depends on: none.

### Sequencing

Not in parallel with `chat-delete-units`, `iso-week-bleed-volume`, `workout-stages-make-ai`, `calendar-mobile-chrome` (`PlanCalendar.tsx`).

### Option

tak — one chart at a time; default the decay chart.

### Verdict override (wins over S-14.1 / S-14.2 tab names)

Do not name the tabs Weekly and Daily. One series is weekly km **sum**; the other is daily load with **decay 0.85**. Tab labels must match those captions (e.g. km per week / daily load). Default remains the decay chart (S-14.3). Copy S-14.1–S-14.4 otherwise.

### Today

`PlanCalendar` mounts `TrainingLoadChart` and `DailyLoadChart` stacked above the month grid. Both captions and both charts are visible at once.

### Requirements

- [ ] S-14.1 Put a `role="tablist"` with tabs **Weekly** and **Daily** above the load charts (accessible name e.g. Training load).
- [ ] S-14.2 Show only one chart at a time: Weekly → stacked week bars (`TrainingLoadChart`); Daily → daily decay (`DailyLoadChart`). Do not keep both mounted.
- [ ] S-14.3 Default the selected tab to **Daily** on first render (newer view). Client state is enough; do not persist in the URL.
- [ ] S-14.4 Keep each chart’s existing caption, legend, and series when that tab is selected.

### Do not

Change load aggregation, Profile mix, month grid, generate, or chat. Do not label the tabs Weekly / Daily.

### Visible

Tabs plus a single chart (decay / daily load by default); switching to km per week shows the week bars only.
