---
change_id: dashboard-list-chrome
title: Tighter dashboard chrome and a List tab default on phones
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T17:15:51Z
---

## Notes

LOCKED. Files: `src/pages/dashboard.astro`, `src/components/dashboard/DashboardTabs.tsx`, `src/components/dashboard/dashboard-tabs.ts`, `src/components/dashboard/dashboard-tabs.test.ts`, new `src/components/plan/PlanList.tsx` (and a small source-scan test if the repo already tests dashboard tabs that way). Merge Tailwind with `cn()` from `@/lib/utils`. No migration.

### Today

Dashboard body uses outer `p-4 sm:p-8`, the content card uses `p-6 sm:p-8`, an `h1` (`text-3xl`, “Dashboard”) sits above the tablist, and `DashboardTabs` stacks with `space-y-6` while tab buttons use `py-2`. The topbar already marks the current page with `aria-current="page"`. Tabs are Week | Profile. Default is week. Mobile and desktop both show the month grid. `parseDashboardTab` only accepts `week` and `profile`. There is no upcoming-session list.

### Do

1. Tighten outer padding to `p-3 sm:p-4` and the card to `p-4`. Remove the body `h1`. In `DashboardTabs`, use `space-y-4` and tab `py-1.5`. Keep `client:load` and URL `?tab=`.

2. Rename tab id `week` → `calendar`, label **Calendar**. `parseDashboardTab("week")` still returns `calendar`. Add **List** between Calendar and Profile. URL helper writes `tab=calendar|list|profile`.

3. List rows = planned units from today through 14–21 days: weekday + date, existing type color tones, km, one-line `structure` when present. Omit dates with no unit (rest). Load that window via the existing plan GET `from`/`to` (or the month payload already on the island). Do not hardcode fixture dates or structure strings.

4. Default: if the URL has no `tab` and `matchMedia("(max-width: 639px)")` matches at hydrate → List; otherwise Calendar. Explicit `?tab=` wins on every width.

### Do not

- Restyle the topbar email pill or current-page label.
- Change calendar cell layout, day panel, generate, chat, or Profile fields.
- POST generate from this change.

### Visible

No duplicate “Dashboard” title; the plan starts higher. A phone opens on a list of upcoming workouts; desktop stays Calendar-first with a List tab.

### Sequencing

Do not run in parallel with `races-on-calendar` (both touch `DashboardTabs.tsx`). Ship this first so List exists for race rows.
