# Tighter dashboard chrome and List tab Implementation Plan

## Overview

Tighten `/dashboard` padding, drop the duplicate body `h1`, rename the Week tab to **Calendar**, and add a **List** tab of upcoming planned units. Phones with no `?tab=` open on List; desktop stays Calendar-first. Explicit `?tab=` still wins at every width.

## Current State Analysis

`src/pages/dashboard.astro` wraps Topbar + a solid slate card (`bg-slate-950`) in `bg-cosmic min-h-screen p-4 sm:p-8`. The card uses `p-6 sm:p-8` and still renders `<h1 class="mb-2 text-3xl font-bold text-white">Dashboard</h1>` above the island. Topbar already marks the current page with `aria-current="page"` and shows the email pill — those stay.

`DashboardTabs` (`client:load`) is a native `tablist` with `space-y-6` and tab buttons `py-2`. Tabs are Week | Profile. Inactive panels stay mounted via `hidden` (FU-037). Clicks `history.replaceState` through `dashboardTabHref`, which merges `tab` into the existing search and keeps the hash.

`dashboard-tabs.ts` ids are `week` | `profile`. `parseDashboardTab` exact-matches those ids; missing/unknown → `week`. `DEFAULT_DASHBOARD_TAB` is `week`. There is no List and no viewport default.

`PlanWorkspace` SSR-loads one week, then client-fetches the visible **month grid** via GET `/api/plan?weekStart=&from=&to=`. `monthGridDates` is typically ~35 days and can end before “today + 21” when today is late in the month. `MAX_PLAN_GET_RANGE_DAYS` is 42 (`src/lib/services/plan.ts`), so a 21-day window is in range. GET `weekStart` is optional and defaults to this week’s Monday.

`PlanCalendar` already has `TYPE_TONE` (chip + text per `WorkoutType`) and `formatDayLabel` (`Mon 31 Aug`). Vitest is Node-only (`src/**/*.test.ts`). `dashboard-tabs.test.ts` is a logic test, not a source-scan; `PlanCalendar.test.ts` / `PlanWorkspace.test.ts` / `Topbar.test.ts` are `readFileSync` source-scans. Playwright is not a suite (`test-plan.md` §6.3). React 19 will not repair a hydrate mismatch (`dashboard-tab-url`): the island’s first client render must match SSR HTML.

## Desired End State

A signed-in member on `/dashboard` sees a tighter card (no body “Dashboard” title; Topbar still says Dashboard). Tabs are **Calendar | List | Profile**. List shows planned units from UTC today through 21 inclusive days: weekday + date, existing type tones, km, and a one-line `structure` when present. Rest days are omitted. `/dashboard?tab=week` still opens Calendar. A phone-width viewport with no `tab` query opens on List after hydrate; `?tab=calendar|list|profile` wins on every width.

### Key Discoveries:

- Hydrate contract (`dashboard-tab-url`): do not read `matchMedia` on the first client render. SSR has no viewport. First paint stays `parseDashboardTab` (Calendar when `tab` is missing). Apply the phone List default in `useLayoutEffect` so it runs after hydrate and before paint.
- Month payload is not a reliable 21-day window: late-month `monthGridDates` can end before `today + 20`. Dedicated GET `from`/`to` is the range the API already supports.
- `parseDashboardTab("week")` must return `calendar` so old links keep working. `dashboardTabHref` must write `tab=calendar|list|profile`, never `tab=week`.
- Importing `DashboardTabs.tsx` in Node pulls `PlanWorkspace`. Keep tab-contract tests on `dashboard-tabs.ts`. Plan list logic tests import helpers from `PlanList.tsx` the same way `PlanCalendar.test.ts` imports `formatDayLabel`.
- Locked file list does not include `PlanCalendar.tsx`. Copy `TYPE_TONE` tokens into `PlanList`; do not extract or restyle calendar cells.

## What We're NOT Doing

- Restyling the Topbar email pill or current-page “Dashboard” label.
- Changing calendar cell layout, day panel, generate, chat, or Profile fields.
- POST generate from this change.
- Unmounting idle tab panels (FU-037 stays).
- `pushState`, `popstate`, or `replaceState` on the viewport default (a first visit stays query-less until a click).
- Listening to viewport resize after the hydrate default.
- Migrations, new APIs, raising `MAX_PLAN_GET_RANGE_DAYS`, jsdom, or Playwright.
- Hardcoding fixture dates or structure strings in production source.

## Implementation Approach

Lock the tab contract in Node first (ids, week alias, href, explicit-vs-viewport helper). Then tighten chrome and wire three `hidden` panels, applying the phone List default only in `useLayoutEffect`. Finally ship `PlanList`: window helpers + GET `from`/`to` + read-only rows using copied type tones and `formatDayLabel`.

## Critical Implementation Details

**Timing & lifecycle.** SSR and the island’s `useState` initializer use `parseDashboardTab(urlTab)` only. Never call `matchMedia` during the first client render. After hydrate, `useLayoutEffect` runs once: if `urlTab` is null or `""`, and `window.matchMedia("(max-width: 639px)")` matches, `setSelected("list")`. Do not `replaceState` in that effect.

**State sequencing.** Tab clicks still `replaceState` via `dashboardTabHref` (merge `tab`, keep other params and hash). Viewport default does not write the URL. No resize listener — locked default is “at hydrate,” one shot.

---

## Phase 1: Tab contract (Calendar / List / Profile)

### Overview

Rename `week` → `calendar`, insert List, keep the `week` query alias, and lock explicit-vs-viewport selection in Node so the island cannot invent ids or skip the alias.

### Changes Required:

#### 1. Tab contract

**File**: `src/components/dashboard/dashboard-tabs.ts`

**Intent**: One module owns tab ids, URL parse/write, and when the phone List default may run, so Astro, the island, and tests cannot drift.

**Contract**:

- `DASHBOARD_TABS` in display order: `{ id: "calendar", label: "Calendar" }`, `{ id: "list", label: "List" }`, `{ id: "profile", label: "Profile" }`.
- `DashboardTab` is `"calendar" | "list" | "profile"`. `DEFAULT_DASHBOARD_TAB` is `"calendar"`.
- `parseDashboardTab(raw)`: `"week"` → `"calendar"`; exact `calendar` / `list` / `profile` → that id; `null`, `""`, wrong case, unknown → `"calendar"`.
- `dashboardTabHref` still merges with `URLSearchParams.set("tab", tab)` and preserves other keys + hash. Written values are `calendar|list|profile` only (never `week`).
- Export `MOBILE_MAX_WIDTH_QUERY` as `"(max-width: 639px)"` (below Tailwind `sm`).
- Export `hasExplicitDashboardTab(raw: string | null): boolean` — true when `raw` is a non-empty string (the URL has a `tab` value). Empty and `null` are not explicit.
- Export `selectDashboardTab(raw: string | null, isNarrowViewport: boolean): DashboardTab` — if explicit, return `parseDashboardTab(raw)`; else return `"list"` when `isNarrowViewport` else `"calendar"`.

#### 2. Unit tests

**File**: `src/components/dashboard/dashboard-tabs.test.ts`

**Intent**: Prove alias, labels, href ids, and viewport default in Node before the island changes.

**Contract**: Do not import `DashboardTabs.tsx`. Update existing cases: default `calendar`; labels Calendar, List, Profile in that order. `parseDashboardTab("week")` is `calendar`; `"calendar"` / `"list"` / `"profile"` match; `null` / `""` / `"Profile"` / `"admin"` → `calendar`. Href empty search writes `tab=calendar` (and list/profile); merging replaces `tab=week` with `tab=calendar` when selecting Calendar. `selectDashboardTab(null, true)` → `list`; `selectDashboardTab(null, false)` → `calendar`; `selectDashboardTab("profile", true)` → `profile`; `selectDashboardTab("week", true)` → `calendar`. Follow `PlanCalendar.test.ts` (vitest, no jsdom).

### Success Criteria:

#### Automated Verification:

- `DASHBOARD_TABS` ids are `calendar`, `list`, `profile` with labels Calendar, List, Profile; `DEFAULT_DASHBOARD_TAB` is `calendar`
- `parseDashboardTab("week")` returns `calendar`; missing/unknown still return `calendar`
- `dashboardTabHref` writes `tab=calendar|list|profile` only and still preserves other search keys and the hash
- `selectDashboardTab` uses List only when the tab query is absent/empty and the viewport is narrow; explicit `week` / `calendar` / `list` / `profile` win
- Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts`
- Full suite passes: `npm test`

---

## Phase 2: Chrome, three panels, hydrate default

### Overview

Tighten page/card padding, remove the body `h1`, restack tabs, and show Calendar / List / Profile panels. Apply the phone List default after hydrate without a URL write.

### Changes Required:

#### 1. Page chrome

**File**: `src/pages/dashboard.astro`

**Intent**: The plan starts higher; Topbar remains the only “Dashboard” title.

**Contract**: Outer wrapper `p-4 sm:p-8` → `p-3 sm:p-4`. Card `p-6 … sm:p-8` → `p-4` (drop the `sm:p-8` bump). Delete the body `<h1>Dashboard</h1>`. Keep `client:load`, data-fetch `try/catch` blocks, Topbar, SiteFooter, and `bg-cosmic`. Keep computing `initialTab` with `parseDashboardTab(Astro.url.searchParams.get("tab"))`. Pass that query value into the island as `urlTab` (string or null) so the layout effect can tell explicit from missing. Do not invent `weekStart`. Do not restyle Topbar.

#### 2. Island

**File**: `src/components/dashboard/DashboardTabs.tsx`

**Intent**: Three tabs, tighter chrome, phone List default after hydrate, Calendar/Profile behavior otherwise unchanged.

**Contract**:

- Root stack `space-y-6` → `space-y-4`. Tab buttons `py-2` → `py-1.5`. Keep `cn()`, `role="tablist"` name “Dashboard”, `replaceState` via `dashboardTabHref(tab.id, pathname, search, hash)`.
- Panels: `calendar` wraps existing `PlanWorkspace` (same props). `list` wraps `PlanList` from `src/components/plan/PlanList.tsx` with `active={selected === "list"}`. This phase adds that file as a compiling placeholder: a `<section aria-label="Upcoming workouts">` that accepts `active: boolean` and renders no fetch and no rows. Phase 3 replaces the placeholder body. Do not unmount panels; `hidden={selected !== id}`.
- `useState(initialTab)` for first paint. `useLayoutEffect` (empty deps besides `urlTab`): if `!hasExplicitDashboardTab(urlTab)` and `window.matchMedia(MOBILE_MAX_WIDTH_QUERY).matches`, `setSelected("list")`. Do not `replaceState` there. Do not add a `change` listener on the media query.
- Do not change SetupForm props, PlanWorkspace props, or calendar/chat internals.

### Success Criteria:

#### Automated Verification:

- `dashboard.astro` outer class includes `p-3 sm:p-4` and does not include `p-4 sm:p-8`; card class includes `p-4` and does not include `p-6` or `sm:p-8`
- `dashboard.astro` has no body `<h1>` and still hydrates `DashboardTabs` with `client:load`, `initialTab`, and `urlTab`
- `DashboardTabs.tsx` uses `space-y-4`, tab `py-1.5`, panels `calendar` / `list` / `profile`, `useLayoutEffect` + `matchMedia(MOBILE_MAX_WIDTH_QUERY)`, does not `replaceState` inside that effect, and passes `active={selected === "list"}` to `PlanList`
- `src/components/Topbar.astro` is unchanged (still `{user.email}` and `aria-current="page"`)
- Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- Signed in on a desktop-width window, `/dashboard` shows Calendar selected; no duplicate “Dashboard” heading in the card; Topbar still shows the email and current-page Dashboard
- `/dashboard?tab=list` shows List at desktop width; `/dashboard?tab=week` and `/dashboard?tab=calendar` show Calendar
- Phone-width (or DevTools < 640px), `/dashboard` with no `tab` shows List selected; adding `?tab=calendar` still shows Calendar
- Tab clicks still merge `tab` into existing search and do not restyle Topbar; Profile fields and calendar grid look as they do today

---

## Phase 3: Upcoming Plan list

### Overview

Fill `PlanList` with planned units from UTC today through 21 inclusive days, loaded via GET `/api/plan?from=&to=`, omitting rest days.

### Changes Required:

#### 1. List helpers and UI

**File**: `src/components/plan/PlanList.tsx` (replace the Phase 2 placeholder)

**Intent**: A phone-friendly upcoming list that reuses calendar type color and day labels without coupling to the day panel or generate.

**Contract**:

- Export `LIST_WINDOW_DAYS = 21`. Export `listWindow(today: string): { from: string; to: string }` as `{ from: today, to: addUtcDays(today, LIST_WINDOW_DAYS - 1) }` using `@/lib/dates`. Export `unitsInListWindow(units: TrainingUnit[], from: string, to: string): TrainingUnit[]` — keep units with `date` in `[from, to]` inclusive, sort by `date` ascending. Production code must call these with `utcToday()` (or the GET response), not a literal date string.
- Prop `active: boolean`. When `active` is true, GET `/api/plan?from=${from}&to=${to}` with `credentials: "same-origin"` (`from`/`to` from `listWindow(utcToday())`). Fetch in an effect that depends on `active` so a generate on Calendar is visible after switching to List. Do not fetch while `active` is false. `weekStart` may be omitted (handler defaults). Parse `units` from the JSON body the same way `PlanWorkspace` does (`asUnits`). Do not POST. Do not hardcode structure strings.
- Rows: one per returned unit in the window (rest omitted because those dates have no unit). Each row shows `formatDayLabel(date)` imported from `PlanCalendar`, type label using a **copy** of `TYPE_TONE` tokens from `PlanCalendar` (same chip + text classes per type; do not edit `PlanCalendar.tsx`), `distanceKm.toFixed(1)` + ` km`, and `structure` as a single truncated line (`truncate`) when it is a non-empty string. Merge classes with `cn()`. Read-only: rows are not buttons and do not open the day panel.
- Loading: do not show the empty-window copy until the GET settles. Error: `ServerError` with the API `code: message` pattern `PlanWorkspace` uses. Empty after a successful GET: `No planned workouts in the next 21 days.`
- Accessible name on the section remains “Upcoming workouts”. Do not change generate, chat, or Profile.

#### 2. Tests

**File**: `src/components/plan/PlanList.test.ts` (new)

**Intent**: Prove the window filter in Node and source-lock GET + tones without rendering React or freezing product copy as fixture oracles.

**Contract**: Import `listWindow` / `unitsInListWindow` / `LIST_WINDOW_DAYS` from `PlanList.tsx` (formatter-import pattern). Call them with **test-local** ISO dates passed as arguments — those dates live only in the test file. Assert a 21-day inclusive span (`to` is `from` plus 20 days). Assert units outside the window and dates with no unit are dropped; remaining rows stay date-sorted. Assert a unit whose `structure` is missing still appears (filter does not require structure). `readFileSync` the component: source contains `/api/plan?from=`, `active`, `listWindow(utcToday())` or equivalent live `utcToday()`, `formatDayLabel`, `truncate`, the six `TYPE_TONE` chip classes from `PlanCalendar.tsx` (`bg-slate-400`, `bg-emerald-400`, `bg-yellow-400`, `bg-orange-400`, `bg-red-400`, `bg-purple-400`), and does not contain `waitForTimeout` or a literal `2026-` date in `PlanList.tsx`. Do not import `DashboardTabs.tsx`. No Playwright.

### Success Criteria:

#### Automated Verification:

- `listWindow` is 21 inclusive UTC dates; `unitsInListWindow` drops rest (no unit) and out-of-window rows and sorts by date
- `PlanList.tsx` fetches GET `/api/plan` with live `from`/`to` from `utcToday()` when `active` is true, copies calendar type tone classes, shows `formatDayLabel` + km + truncated `structure` when present, and contains no hardcoded `2026-` dates
- Unit tests pass: `npm test -- src/components/plan/PlanList.test.ts src/components/dashboard/dashboard-tabs.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build` (env from worktree `.env` / `.dev.vars` symlinks; never commit secrets)

#### Manual Verification:

- Signed in with a plan that has workouts in the next three weeks: List shows those units (weekday + date, type color, km, structure when set) and skips rest days
- List on a phone-width `/dashboard` (no `tab`) is the selected panel and is usable without the month grid
- Calendar cells, day panel, generate, chat, and Profile are unchanged; generating a week is still only from Calendar (this change does not POST generate)

---

## Testing Strategy

### Unit Tests:

- Tab ids/labels/default, `week` → `calendar` alias, href writes `calendar|list|profile`, preserve other query keys.
- `selectDashboardTab` / `hasExplicitDashboardTab`: missing tab + narrow → list; explicit tab wins.
- `listWindow` / `unitsInListWindow` with test-local dates (not production literals).
- Source-scan `PlanList.tsx` for GET `from`/`to`, tones, `utcToday()`, no hardcoded dates.

### Integration Tests:

- None. No API or persist change. Existing GET `from`/`to` contract tests stay. Do not add Playwright (`test-plan.md` §6.3).

### Manual Testing Steps:

1. Desktop `/dashboard`: Calendar selected, tighter padding, no card `h1`, Topbar unchanged.
2. Phone-width `/dashboard`: List selected; `?tab=calendar` still Calendar.
3. List rows match upcoming planned units; rest omitted; Calendar/Profile unchanged.

## Performance Considerations

One GET of at most 21 days each time List becomes `active` (panels stay mounted; idle List does not fetch). Under `MAX_PLAN_GET_RANGE_DAYS` (42). No polling.

## Migration Notes

No database migration. Old `/dashboard?tab=week` URLs keep working via `parseDashboardTab`. New clicks write `tab=calendar`.

## References

- Locked notes: `context/changes/dashboard-list-chrome/change.md`
- Hydrate + `?tab=` parse: `context/archive/2026-09-01-dashboard-tab-url/plan.md`
- Query merge: `context/archive/2026-09-02-dashboard-tab-preserve-search/plan.md`
- Idle panel mounted: FU-037
- GET range: `src/pages/api/plan.ts`, `resolvePlanRange` / `MAX_PLAN_GET_RANGE_DAYS` in `src/lib/services/plan.ts`
- Type tones + day label: `src/components/plan/PlanCalendar.tsx`
- Test-plan §6.3 (no Playwright)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tab contract (Calendar / List / Profile)

#### Automated

- [x] 1.1 `DASHBOARD_TABS` ids are `calendar`, `list`, `profile` with labels Calendar, List, Profile; `DEFAULT_DASHBOARD_TAB` is `calendar` — 4f8335b
- [x] 1.2 `parseDashboardTab("week")` returns `calendar`; missing/unknown still return `calendar` — 4f8335b
- [x] 1.3 `dashboardTabHref` writes `tab=calendar|list|profile` only and still preserves other search keys and the hash — 4f8335b
- [x] 1.4 `selectDashboardTab` uses List only when the tab query is absent/empty and the viewport is narrow; explicit `week` / `calendar` / `list` / `profile` win — 4f8335b
- [x] 1.5 Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts` — 4f8335b
- [x] 1.6 Full suite passes: `npm test` — 4f8335b

### Phase 2: Chrome, three panels, hydrate default

#### Automated

- [x] 2.1 `dashboard.astro` outer class includes `p-3 sm:p-4` and does not include `p-4 sm:p-8`; card class includes `p-4` and does not include `p-6` or `sm:p-8` — 09af206
- [x] 2.2 `dashboard.astro` has no body `<h1>` and still hydrates `DashboardTabs` with `client:load`, `initialTab`, and `urlTab` — 09af206
- [x] 2.3 `DashboardTabs.tsx` uses `space-y-4`, tab `py-1.5`, panels `calendar` / `list` / `profile`, `useLayoutEffect` + `matchMedia(MOBILE_MAX_WIDTH_QUERY)`, does not `replaceState` inside that effect, and passes `active={selected === "list"}` to `PlanList` — 09af206
- [x] 2.4 `src/components/Topbar.astro` is unchanged (still `{user.email}` and `aria-current="page"`) — 09af206
- [x] 2.5 Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts` — 09af206
- [x] 2.6 Full suite passes: `npm test` — 09af206
- [x] 2.7 Lint passes: `npm run lint` — 09af206

#### Manual

- [x] 2.8 Signed in on a desktop-width window, `/dashboard` shows Calendar selected; no duplicate “Dashboard” heading in the card; Topbar still shows the email and current-page Dashboard
- [x] 2.9 `/dashboard?tab=list` shows List at desktop width; `/dashboard?tab=week` and `/dashboard?tab=calendar` show Calendar
- [x] 2.10 Phone-width (or DevTools < 640px), `/dashboard` with no `tab` shows List selected; adding `?tab=calendar` still shows Calendar
- [x] 2.11 Tab clicks still merge `tab` into existing search and do not restyle Topbar; Profile fields and calendar grid look as they do today

### Phase 3: Upcoming Plan list

#### Automated

- [x] 3.1 `listWindow` is 21 inclusive UTC dates; `unitsInListWindow` drops rest (no unit) and out-of-window rows and sorts by date — a3a95e8
- [x] 3.2 `PlanList.tsx` fetches GET `/api/plan` with live `from`/`to` from `utcToday()` when `active` is true, copies calendar type tone classes, shows `formatDayLabel` + km + truncated `structure` when present, and contains no hardcoded `2026-` dates — a3a95e8
- [x] 3.3 Unit tests pass: `npm test -- src/components/plan/PlanList.test.ts src/components/dashboard/dashboard-tabs.test.ts` — a3a95e8
- [x] 3.4 Full suite passes: `npm test` — a3a95e8
- [x] 3.5 Lint passes: `npm run lint` — a3a95e8
- [x] 3.6 Production build passes: `npm run build` (env from worktree `.env` / `.dev.vars` symlinks; never commit secrets) — a3a95e8

#### Manual

- [x] 3.7 Signed in with a plan that has workouts in the next three weeks: List shows those units (weekday + date, type color, km, structure when set) and skips rest days
- [x] 3.8 List on a phone-width `/dashboard` (no `tab`) is the selected panel and is usable without the month grid
- [x] 3.9 Calendar cells, day panel, generate, chat, and Profile are unchanged; generating a week is still only from Calendar (this change does not POST generate)
