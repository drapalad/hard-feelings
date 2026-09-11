# Tighter dashboard chrome and List tab — Plan Brief

> Full plan: `context/changes/dashboard-list-chrome/plan.md`

## What & Why

Tighten `/dashboard` padding, drop the duplicate body `h1`, rename Week → **Calendar**, and add a **List** of upcoming planned workouts. A phone with no `?tab=` opens on List; desktop stays Calendar-first. Old `?tab=week` still means Calendar.

## Starting Point

Tabs are Week | Profile (`parseDashboardTab` / `dashboardTabHref`). The card still has a large “Dashboard” `h1` under Topbar. `PlanWorkspace` loads a month grid; there is no upcoming-session list. Inactive panels stay mounted (`hidden`).

## Desired End State

Calendar | List | Profile. Tighter chrome, no card `h1`. List rows = planned units from UTC today through 21 days (type color, km, one-line structure; rest omitted). Explicit `?tab=` wins; missing `tab` + `max-width: 639px` at hydrate → List.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Chrome + tab rename + List placement | Padding `p-3 sm:p-4` / card `p-4`; drop body `h1`; `week`→`calendar` with `week` alias; List between Calendar and Profile | Locked Notes; Topbar already names the page | Plan |
| List window length | 21 inclusive UTC days (`today` … `today+20`) | Upper end of the locked 14–21 range so a phone sees ~three weeks | Unattended |
| List data load | Client GET `/api/plan?from=&to=` when List is `active` (not the month payload) | Late-month `monthGridDates` can end before today+21; refetch on select so generate on Calendar is not stale | Unattended |
| Phone default vs hydrate | SSR + first paint from `parseDashboardTab`; `useLayoutEffect` + `matchMedia("(max-width: 639px)")` only when `tab` is missing/empty; no `replaceState` | React 19 will not repair a mismatch; `dashboard-tab-url` already locked server-parsed `initialTab` | Plan |
| Explicit `?tab=` | Any non-empty `tab` value wins (including `week` alias and unknown→Calendar); viewport default only when `tab` is absent or `""` | Literal locked “URL has no `tab`”; junk `?tab=admin` stays Calendar | Unattended |
| Resize after hydrate | One-shot at hydrate; no `matchMedia` `change` listener | Locked default is “at hydrate,” not live breakpoint tracking | Unattended |
| List interaction | Read-only rows; do not open the day panel | Locked: do not change calendar cell layout or day panel | Plan |
| Idle panels | Keep Calendar / List / Profile mounted with `hidden` | FU-037; switching back must not reset `PlanWorkspace` | Plan |
| Type colors | Copy `TYPE_TONE` tokens into `PlanList`; do not edit `PlanCalendar.tsx` | Locked file list excludes calendar layout | Plan |
| Testing | Node unit + `PlanList` source-scan; no Playwright | `test-plan.md` §6.3; `dashboard-tabs.test.ts` is already a logic test | Plan |
| Empty / error | Empty copy after GET: “No planned workouts in the next 21 days.”; `ServerError` on failure | Matches calendar error pattern; no empty flash while loading | Unattended |

## Scope

**In scope:** `dashboard.astro` padding + `h1` removal; `dashboard-tabs.ts` / tests; `DashboardTabs.tsx` chrome + three panels + viewport default; new `PlanList.tsx` + `PlanList.test.ts`.

**Out of scope:** Topbar restyle; calendar cells / day panel / generate / chat / Profile fields; POST generate; migrations; Playwright; unmounting idle tabs.

## Architecture / Approach

Tab contract in Node → island first-paints from SSR `initialTab` → `useLayoutEffect` may switch to List on a narrow viewport → `PlanList` GETs `from`/`to` and renders read-only rows with copied type tones and `formatDayLabel`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Tab contract | `calendar`/`list`/`profile`, `week` alias, href, viewport helper | Alias or href still writes `tab=week` |
| 2. Chrome + island | Padding, no `h1`, three panels, hydrate List default | Hydrate mismatch if `matchMedia` runs on first paint |
| 3. Plan list | 21-day GET rows, tones, tests | Filtering month payload instead of a dedicated window |

**Prerequisites:** Existing GET `/api/plan?from=&to=` and dashboard tab island on master.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- 21-day window (vs 14) is recorded as FU-094.
- Client GET (vs SSR `listRange` or month payload) is recorded as FU-095.
- First paint on a phone is Calendar HTML until `useLayoutEffect`; should be before paint.

## Success Criteria (Summary)

- No duplicate “Dashboard” title; tighter padding.
- Phone + no `tab` → List of upcoming units; desktop → Calendar; explicit `?tab=` wins.
- Calendar, generate, chat, and Profile unchanged.
