# races-live-on-calendar

- **status:** archived
- **created:** 2026-09-03
- **updated:** 2026-09-03
- **archived_at:** 2026-09-03T19:52:15Z
- **title:** After Add race on Profile the calendar and list show it without a page reload

## Notes

### Files

- `src/components/dashboard/DashboardTabs.tsx`
- `src/components/setup/SetupForm.tsx`
- `src/components/plan/PlanWorkspace.tsx`
- `src/components/plan/PlanList.tsx`

### How it works today

`dashboard.astro` loads `listRaces` once and passes `races` into `DashboardTabs`. `SetupForm` copies that into local state and updates only itself after POST/PATCH/DELETE `/api/races`. `PlanWorkspace` and `PlanList` keep the SSR array, so a new race is invisible on Calendar and List until a full reload. Race markers on cells already exist (`RaceMarker`).

### What to do

1. Lift `races` to `DashboardTabs` state (`useState` from the SSR prop).
2. Pass the live array into `PlanWorkspace` and `PlanList`.
3. Add `onRacesChange` callback to `SetupForm` and call it with the sorted list after a successful save and after delete.
4. Switching Calendar / List / Profile must show the same races without reload.
5. Do not hardcode a September race date or any fixture data.

### What not to change

- `/api/races` endpoints, race priority rules, `RaceMarker` styling.
- Generate, chat, logs.

### Visible result

After Add race on Profile, the same date shows Flag + name + priority on the month grid (and on List if that date is in range) without refreshing the page.
