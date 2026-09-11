---
change_id: races-on-calendar
title: Show races on the month grid and on the plan list
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T17:15:51Z
---

## Notes

LOCKED. Files: `src/components/dashboard/DashboardTabs.tsx`, `src/components/plan/PlanWorkspace.tsx`, `src/components/plan/PlanCalendar.tsx`, `src/components/plan/PlanList.tsx` (if present). Dashboard SSR already loads `listRaces` in `src/pages/dashboard.astro` and passes `races` into `DashboardTabs` (Profile only). Source-scan tests in `PlanCalendar.test.ts` / `PlanWorkspace.test.ts` if they assert props. No migration.

### Today

Races never reach the month grid. `PlanWorkspace` has no `races` prop. A race date in the visible month looks like Rest (or like any other unit). Profile still owns race CRUD.

### Do

1. Thread the existing `races` array from `DashboardTabs` through `PlanWorkspace` into `PlanCalendar` (and `PlanList` when that tab exists). Index by `date`.

2. On a matching in-month cell: lucide `Flag`, truncated name (`Untitled race` if missing), and the priority letter in parentheses. A race day may also show its planned unit. Repeat the same marker in the open day panel.

3. If List exists: a race on a listed date gets the same flag + name + priority on that row; a race with no planned unit still appears as its own upcoming row (do not hide races because rest days are omitted).

4. Use real `listRaces` data from SSR. Do not hardcode a September (or any other) race in the component.

### Do not

- POST, add a migration, change Profile race CRUD, generate, or chat.
- Invent a new table.

### Visible

The A-priority race sits on the month grid (and on List when that tab is there), not only under Profile.

### Sequencing

After `dashboard-list-chrome` (List + `DashboardTabs`) and `calendar-month-polish` (`PlanCalendar` cells). Do not run in parallel with either.
