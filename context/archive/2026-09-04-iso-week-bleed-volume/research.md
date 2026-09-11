---
date: 2026-09-04T16:05:00+02:00
researcher: wave-audit
git_commit: 760e00179b4676413204b47e76f7a7b25770bdd0
branch: master
repository: hard-feelings
topic: "iso-week-bleed-volume: files named in Notes"
tags: [research, wave-audit]
status: complete
last_updated: 2026-09-04
last_updated_by: wave-audit
---

# Research: iso-week-bleed-volume

## Research Question
What exists at HEAD for the files listed in Notes?

## Summary

- Month grid starts at the first Monday of the month span: `monthGridDates("2026-09-01")[0] === "2026-08-31"` (`src/lib/dates.ts:51-55`, `src/lib/dates.test.ts:61-62`).
- `loadMonth` fetches `/api/plan?…&from=${grid[0]}&to=${grid[last]}` (`src/components/plan/PlanWorkspace.tsx:299-322`). Units for bleed dates can already be in client state.
- Cells bind `unit` / `race` only when `inMonth` (`src/components/plan/PlanCalendar.tsx:619-621`). Out-of-month cells are not buttons; they render `DaySummary` with `unit={undefined}` (`:653-661`). Rest label is `inMonth && race === undefined` (`:202-204`).
- `selectedInMonth` requires `utcMonthStart(selectedDate) === utcMonthStart(visibleMonth)` (`:490-491`), so a bleed ISO date cannot open the day panel even if selected. `formatWeekRange` is exported (`src/components/plan/PlanCalendar.tsx:130`) but unused in JSX; week chrome is `"No plan for this week yet."` (`:604`), not an ISO-week chip.
- First-pass prompt has `weeklyKm` as a number plus rolling `currentLoad` (`today-6…today`) (`src/lib/services/openai-chat.ts:325-332`, `src/lib/services/chat.ts:290`, `:601-616`). No `isoWeeks[]`. `gateByIsoWeek` groups by `utcMondayOf` (`src/lib/services/plan-adaptation.ts:77-105`).

## Code References

- `src/lib/dates.ts:51-55` - monthGridDates from first Monday through last Sunday
- `src/lib/dates.test.ts:61-64` - Sep 2026 grid includes 31 Aug
- `src/components/plan/PlanWorkspace.tsx:299-322` - loadMonth from/to = full grid
- `src/components/plan/PlanCalendar.tsx:145-146` - isInVisibleMonth
- `src/components/plan/PlanCalendar.tsx:202-204` - Rest only in-month
- `src/components/plan/PlanCalendar.tsx:130` - formatWeekRange exported, not used in JSX
- `src/components/plan/PlanCalendar.tsx:490-491` - selectedInMonth month filter
- `src/components/plan/PlanCalendar.tsx:604` - No plan for this week yet
- `src/components/plan/PlanCalendar.tsx:619-661` - unit bind + bleed not clickable
- `src/lib/services/openai-chat.ts:325-332` - weeklyKm + Profile JSON + currentLoad
- `src/lib/services/chat.ts:601-616` - loadCurrentLoad today−6…today
- `src/lib/services/plan-adaptation.ts:77-105` - gateByIsoWeek / groupByMonday
- `src/components/plan/PlanCalendar.test.ts:87-96` - source-scan: in-month day button + Rest day copy

## Architecture Insights

The data path already loads bleed-Monday units; the UI drops them. First-pass never sends a Mon–Sun planned/logged breakdown — only a rolling 7-day `currentLoad` named as “Current load summary JSON”. Volume gating already uses ISO weeks in `gateByIsoWeek`; the coach prompt does not.

## Open Questions

- How first-pass `isoWeeks[]` should be loaded (units+logs for Mondays overlapping create horizon) — `listRange` / `listLogsRange` callers beyond `loadCurrentLoad` / `fetchCoachExtra` not fully mapped.
- Whether `currentLoad` is kept alongside `isoWeeks` or replaced (Notes leave this to the PR).
- `PlanCalendar.test.ts` locks `inMonth ? (` and bleed non-button structure (`:87-96`, `:113-116`).
- Test harness / no migration in this change; still: quality-gates file list if tests are added (`src/lib/test/quality-gates.test.ts` not opened).
