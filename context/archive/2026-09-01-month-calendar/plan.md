# Month calendar Implementation Plan

## Overview

Replace the seven fat weekday cards on the dashboard Week tab with a Monday-start month grid that loads real `training_units` (and logs) for the visible month, adds a Today control, labels generate by the **active week**, and widens the calendar versus chat — without cell-level Edit/Log/Freeze, without regenerating the whole month, and without touching `PlanChat.tsx` or schema/RLS.

## Current State Analysis

`PlanCalendar` (`src/components/plan/PlanCalendar.tsx`) renders `weekDates(weekStart)` as seven cards (`grid-cols-1 sm:grid-cols-7`). Each in-week day with a unit shows type chip + km + structure/logged (hidden below `sm`) and three always-visible `size-icon` buttons (Edit / Log|Unlog / Freeze). Days without a unit say **Empty**. The heading is “Training week”; prev/next are ±7 days via `onPrevWeek` / `onNextWeek`. The purple button is always **Generate plan** (busy: **Working...**). Today uses `utcToday()` with `border-white/60` and a TODAY label.

`PlanWorkspace` (`src/components/plan/PlanWorkspace.tsx`) owns week state. `loadWeek` GETs `/api/plan?weekStart=` and `/api/chat?weekStart=` and **replaces** `units` / `logs`. `generate` POSTs `{ weekStart }` and **replaces** `units` with that week’s rows. `PlanChat` gets `unitsEmpty={units.length === 0}`. Root layout is `grid grid-cols-1 gap-10 lg:grid-cols-2`.

GET `/api/plan` (`src/pages/api/plan.ts`) resolves `weekStart` through `resolveWeekStart`, then `listWeek` + `listLogs` + `readRevisionStack`. `listWeek` (`src/lib/services/plan.ts`) queries `training_units` with `.eq("user_id")` + `.in("date", weekDates(weekStart))`. `listLogs` is the same shape on `workout_logs`. The in-memory test client (`src/lib/test/memory-supabase.ts`) supports only `eq` and `in` filters — not `gte`/`lte`.

SSR (`src/pages/dashboard.astro`) loads **one** week (`utcMondayOf(utcToday())`) and is **out of this change’s file list**. Date helpers already in `src/lib/dates.ts`: `addUtcDays`, `utcToday`, `utcMondayOf`, `weekDates`. Colocated tests: `src/lib/dates.test.ts`, `src/components/plan/PlanCalendar.test.ts` (formatters only). Vitest is Node-only (`src/**/*.test.ts`); Playwright is not a suite (`test-plan.md` §6.3).

## Desired End State

On `/dashboard` Week, the member sees a Monday-start month grid (5–6 rows) whose header is the visible month and year (e.g. September 2026). Prev/next change the visible month; Today jumps to the month containing `utcToday()`. Cells show day number, type chip + type, and km for **in-month** days that have a unit; in-month days without a unit read muted **Rest**; days outside the month are muted with no workout. Today (UTC date) keeps the stronger border and TODAY label. The purple button is **Generate plan** / **Regenerate week** / **Working...** for the **active week** only (`weekDates(weekStart)`), posting the same `{ weekStart }`. Restore stays week-scoped. Calendar is `lg:col-span-3` next to chat `lg:col-span-2` on `lg:grid-cols-5`. Opening a day does not show action icons. Grid data comes from persisted rows via GET, never hardcoded fixtures.

### Key Discoveries:

- `weekStart` for the current month is `utcMondayOf(utcToday())`, which can fall in the **previous** calendar month (e.g. 2026-09-02 → Monday 2026-08-31). Visible month cannot be derived from `weekStart`; it must be explicit `YYYY-MM-01` state.
- Locked notes hide workouts on outside-month padding cells even when those dates belong to the active week. Units for those dates must still live in state so generate/chat emptiness is correct.
- `setUnits(nextWeek)` after generate/accept/restore would wipe other days of the month. Mutations that return one week must **merge** that week’s dates into month state.
- `PlanChat` must not be edited. `unitsEmpty={units.length === 0}` becomes wrong once `units` is a month; the workspace must pass active-week emptiness.
- Range GET must use `.in("date", dates)` (same as `listWeek`) because the memory persist used by `plan-contracts` / ownership tests has no `gte`/`lte`.
- `dashboard.astro` is not in the locked file list. First paint can show the SSR current week in the month grid; a client fetch fills the rest of the visible month.

## What We're NOT Doing

- Edit, Log, Unlog, Freeze, overflow `⋯`, or an inline actual-km form **in month cells**. No reintroduction of the three `size-9` / `size-icon` buttons on a seven-column week strip. Day actions are a later change.
- Required ellipsis truncation of type labels.
- Any edit to `PlanChat.tsx` (copy, bubbles, height, Enter-to-send, Accept/Reject).
- Confirm-before-regenerate. Regenerating every week in the month from this button.
- Wordmark / topbar email, race list dates, dashboard tabs URL, signup/landing chrome.
- Supabase migrations, new columns, or RLS changes.
- Editing `src/pages/dashboard.astro` (SSR stays current-week; client loads the month).
- Playwright, jsdom, Testing Library, or visual snapshots (`test-plan.md` §6.3, §7).
- `"use client"` or concatenating Tailwind class strings.

## Implementation Approach

Four Automated phases: (1) UTC month/grid helpers, (2) inclusive date-range list + GET `/api/plan?from=&to=` (weekStart GET unchanged), (3) month grid UI + Today + generate label + 3/2 layout with week-only fetch still compiling, (4) range fetch, week-slice merge, week-scoped chat emptiness, initial month load.

LOCKED: range GET rather than 5–6 week fetches (FU-088). LOCKED: merge week slices after generate/accept/restore rather than refetching the whole month (FU-089).

## Critical Implementation Details

- **Visible month vs weekStart.** Store `visibleMonth` as `YYYY-MM-01`. Prev/next: `addUtcMonths(visibleMonth, ±1)`, then `weekStart = activeWeekStartForMonth(nextMonth, utcToday())` (if that month contains today → `utcMondayOf(today)`, else `utcMondayOf` the first of that month). Today control: `visibleMonth = utcMonthStart(utcToday())`, `weekStart = utcMondayOf(utcToday())`. Disable Today and set `aria-current="date"` when `visibleMonth === utcMonthStart(utcToday())`.
- **Range GET + revisions.** `from` and `to` load units/logs for the inclusive grid. `weekStart` still selects the revision stack (and remains the generate/chat key). Do not set client `weekStart` from `utcMondayOf(from)`. Omit `from`/`to` together to keep the existing one-week GET.
- **Memory persist.** `listRange` / `listLogsRange` must build the inclusive date list and query `.in("date", dates)` — never `.gte`/`.lte`.
- **Merge, don’t replace.** After generate, accept, and restore, replace only dates in `weekDates(weekStart)` inside the month `units` array. Chat GET stays `?weekStart=`. Those POSTs do not return a month of logs — **do not** `setLogs([])` or replace logs from a missing field; logs stay (they already survive generate on the server).
- **One load path.** `loadMonth(weekStart, visibleMonth)` is the only function that GETs plan `from`/`to` + chat. Month prev/next/Today call it after updating state. A mount `useEffect` runs it once for the initial month. Do **not** also `useEffect` on `visibleMonth`/`weekStart` if those handlers already load — that double-fetches.
- **`PlanChat` emptiness.** Pass `unitsEmpty={!weekHasUnits(units, weekStart)}` from `PlanWorkspace`. Do not use `units.length === 0` once units are month-wide.

## Phase 1: UTC month and grid helpers

### Overview

Add pure UTC month helpers next to `weekDates` so later phases share one grid/window definition.

### Changes Required:

#### 1. Date helpers

**File**: `src/lib/dates.ts`

**Intent**: One UTC definition of month start, month step, inclusive date lists, and the Monday-start month grid so the API range and the calendar cannot drift.

**Contract**: Add (names may match this intent):

- `utcMonthStart(isoDate)` → `YYYY-MM-01` of that UTC date.
- `addUtcMonths(monthStart, n)` → first of the month `n` months away (n may be negative). Input should be a month-start or any ISO date; output is always `YYYY-MM-01`.
- `inclusiveIsoDates(from, to)` → every `YYYY-MM-DD` from `from` through `to` inclusive; empty if `from > to`.
- `monthGridDates(monthStart)` → Monday-start grid covering that month through the Sunday of the week that contains the month’s last day. Example: September 2026 → `2026-08-31` through `2026-10-04` (35 days).
- `activeWeekStartForMonth(monthStart, today)` → `utcMondayOf(today)` when `utcMonthStart(today) === utcMonthStart(monthStart)`, otherwise `utcMondayOf(monthStart)`.
- `formatMonthYear(monthStart)` → English long month + year, UTC, e.g. `September 2026`.

Keep existing `addUtcDays` / `utcToday` / `utcMondayOf` / `weekDates` behavior.

#### 2. Unit tests

**File**: `src/lib/dates.test.ts`

**Intent**: Lock grid edges and the current-month vs other-month `weekStart` rule without a DOM runner.

**Contract**: Colocated Vitest. Assert September 2026 grid starts `2026-08-31`, ends `2026-10-04`, length 35. Assert `activeWeekStartForMonth("2026-09-01", "2026-09-02") === "2026-08-31"` and `activeWeekStartForMonth("2026-10-01", "2026-09-02") === "2026-09-28"`. Assert `formatMonthYear("2026-09-01") === "September 2026"`. Assert `inclusiveIsoDates` inclusive count and empty when `from > to`. Keep existing `addUtcDays` / `utcMondayOf` / `weekDates` tests.

### Success Criteria:

#### Automated Verification:

- `src/lib/dates.test.ts` asserts September 2026 `monthGridDates` is `2026-08-31` through `2026-10-04` (35 days), `activeWeekStartForMonth` current-month vs other-month, `formatMonthYear("2026-09-01")` is `September 2026`, and `inclusiveIsoDates` inclusive/empty-when-reversed
- `npm test -- src/lib/dates.test.ts` exits 0
- `npm test` exits 0
- `npm run lint` exits 0

---

## Phase 2: Inclusive plan GET range

### Overview

Load a month of units and logs in one authenticated GET without changing POST generate, RLS, or the weekStart-only GET.

### Changes Required:

#### 1. `listRange` beside `listWeek`

**File**: `src/lib/services/plan.ts`

**Intent**: Query persisted units for an inclusive date window with the same owner filter as `listWeek`.

**Contract**: Add `listRange(client, userId, from, to)` that loads `inclusiveIsoDates(from, to)` via `.eq("user_id", userId).in("date", dates).order("date")` and maps rows with existing `toTrainingUnit`. Cap is enforced by the HTTP layer, not by silently truncating. `listWeek` may delegate to `listRange` for the seven `weekDates` or stay as-is; either way `listWeek` still returns that week only. Do not add `gte`/`lte`. No schema change.

#### 2. `listLogsRange` beside `listLogs`

**File**: `src/lib/services/workout-log.ts`

**Intent**: Same window for logs so the month GET can merge logs the GET already returns for a week.

**Contract**: Add `listLogsRange(client, userId, from, to)` using `.in("date", inclusiveIsoDates(from, to))` and the existing log row mapper. Keep `listLogs(weekStart)` for the week-only path.

#### 3. GET `/api/plan` from/to

**File**: `src/pages/api/plan.ts`

**Intent**: One request fills the visible grid; revisions stay week-scoped.

**Contract**: Zod-validate optional `from` and `to` as `YYYY-MM-DD`. If one is present without the other, `from > to`, either fails ISO, or inclusive day count > 42 → `400 VALIDATION_ERROR` (same error envelope as a bad `weekStart`). When both are valid, `units = listRange(...)`, `logs = listLogsRange(...)`. When both are absent, keep current `listWeek` + `listLogs(weekStart)`. Always `resolveWeekStart(weekStart)` for `weekStart` in the JSON body and `readRevisionStack`. `prerender = false` stays. POST unchanged. `401` still from `unauthorized()` when `locals.user` is missing (existing `product-gates` row covers GET `/api/plan` with or without query).

#### 4. Range tests

**File**: `src/pages/api/plan-contracts.test.ts`

**Intent**: Prove the window returns the caller’s rows only, and that a malformed range is rejected without writing.

**Contract**: Import GET alongside the existing POST. Memory persist (`createMemorySupabase`), `vi.mock("astro:env/server")` already in this file. Add GET `/api/plan?from=&to=&weekStart=` that seeds session units on two dates inside the window and a victim unit on a date inside the window; 200 body `units`/`logs` include the session rows and must not include the victim’s distinctive payload; victim row still stored. Add GET without `from`/`to` (weekStart only) that returns that week’s session rows only. Add cases: `from` without `to`; `from > to`; span 43 days; invalid date → 400 `VALIDATION_ERROR`, store unchanged. Keep existing POST generate volume oracle. Do not `safeParse` the handler schema in the test (`test-plan.md` §6.4). Do not require a new `listRange` suite in `plan.test.ts` — the GET contracts exercise the query. Existing `plan.test.ts` stays as-is.

### Success Criteria:

#### Automated Verification:

- GET `/api/plan` without `from`/`to` still returns one week of session units/logs; GET with valid `from`/`to` returns session units/logs in that inclusive window and not another member’s rows
- GET with only `from`, `from > to`, a 43-day span, or a non-ISO date returns 400 `VALIDATION_ERROR` and does not mutate the memory store
- Logged-out GET `/api/plan` remains 401 `{ error: { code: "UNAUTHORIZED", message: "Sign in required" } }` with no `units`/`logs` (`src/pages/api/product-gates.test.ts`)
- `npm test -- src/lib/services/plan.test.ts src/pages/api/plan-contracts.test.ts src/pages/api/product-gates.test.ts` exits 0
- `npm test` exits 0
- `npm run lint` exits 0

---

## Phase 3: Month grid, Today, generate label, layout

### Overview

Render the month grid and chrome from props/state. Month navigation may still load a single week until Phase 4; the grid must already be 7×N, Rest not Empty, no cell actions, and the 3/2 layout.

### Changes Required:

#### 1. Month `PlanCalendar`

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: The Week tab looks like a month calendar with Today and a week-scoped generate label, not seven oversized cards with in-cell actions.

**Contract**:

- Header: `formatMonthYear(visibleMonth)` (not “Training week” / `formatWeekRange` as the primary title). Chevrons call `onPrevMonth` / `onNextMonth` with aria-labels Previous month / Next month. Place a Today control beside the chevrons: click `onToday`; when `visibleMonth` is the month of `utcToday()`, the control is disabled and has `aria-current="date"`.
- Grid: weekday labels Monday-first, then `monthGridDates(visibleMonth)` in `grid-cols-7` (all breakpoints — not `grid-cols-1 sm:grid-cols-7` day cards). Each cell: day-of-month number; if the date is in `visibleMonth` and a unit exists → existing type color chip + type + km (`toFixed(1)`); if in-month and no unit → muted **Rest**; if outside month → muted, no workout (do not render type/km even if `units` contains that date). Today (`date === utcToday()`): keep `border-white/60` and TODAY. Do not require ellipsis on type labels. Do not show structure, logged km, frozen chrome, or action buttons.
- Remove the inline edit form and the Edit / Log / Unlog / Freeze buttons (no `aria-label="Edit"`, no Freeze/Unfreeze/Log/Unlog icon buttons). Drop `onPrevWeek` / `onNextWeek` / `onToggleFreeze` / `onSaveEdit` / `onLog` / `onUnlog` from the public props.
- Generate button: if `busy` → **Working...**; else if any `units` date is in `weekDates(weekStart)` → **Regenerate week**; else **Generate plan**. Same `onGenerate`. No confirm dialog. Restore `<select>` unchanged (week-scoped). Empty-week hint (if kept) must key off the **active week**, not `units.length === 0`.
- Merge classes with `cn()`. No `"use client"`.

#### 2. Workspace month chrome and week-only nav

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Wire month state and the 3/2 layout so the calendar compiles; freeze/edit/log client handlers go away with the buttons.

**Contract**:

- Root: keep `grid grid-cols-1 gap-10`; replace `lg:grid-cols-2` with `lg:grid-cols-5`. Wrap `PlanCalendar` in an element with `lg:col-span-3`; wrap `PlanChat` in `lg:col-span-2`. Do not edit `PlanChat.tsx`.
- State: `visibleMonth` initialized to `utcMonthStart(utcToday())` (not `utcMonthStart(initialWeekStart)`). Prev/next/Today update `visibleMonth` and `weekStart` via `activeWeekStartForMonth` / `utcMondayOf(utcToday())`, then load the **week** (existing `loadWeek`) until Phase 4.
- Pass week-scoped `unitsEmpty={!weekHasUnits(units, weekStart)}` into `PlanChat` (helper may live in a small colocated module). Remove unused freeze/edit/log/unlog functions and their calendar props.
- Keep generate POST `{ weekStart }`, restore POST `{ weekStart, revisionId }`, and chat POSTs week-scoped.

#### 3. Pure week helpers + source-read tests

**Files**: `src/components/plan/plan-month.ts` (new, if helpers are not inlined), `src/components/plan/plan-month.test.ts` (new), `src/components/plan/PlanCalendar.test.ts`, `src/components/plan/PlanWorkspace.test.ts` (new)

**Intent**: Unit-test generate label / week emptiness; lock chrome tokens without jsdom.

**Contract**: Export `weekHasUnits(units, weekStart)` and `generatePlanButtonLabel(busy, weekHasUnits)` (`Working...` / `Regenerate week` / `Generate plan`). Vitest Node. `PlanCalendar.test.ts`: keep formatter tests; add `readFileSync` locks for `grid-cols-7`, `Rest`, absence of `Empty` as the no-unit label, absence of `aria-label="Edit"`, presence of `Regenerate week` and `aria-current="date"`, Previous month / Next month / Today. `PlanWorkspace.test.ts`: source contains `lg:grid-cols-5`, `lg:col-span-3`, `lg:col-span-2`, and `grid-cols-1 gap-10`; does not contain `lg:grid-cols-2` as the workspace root. Assert `PlanChat.tsx` is untouched (file still contains the locked helper sentence from `coach-chat-copy`; this change must not modify that file). No Playwright.

### Success Criteria:

#### Automated Verification:

- `PlanCalendar.tsx` uses `grid-cols-7` for the month cells, renders **Rest** (not **Empty**) for in-month days without a unit, has no Edit/Log/Unlog/Freeze icon buttons, and labels generate **Generate plan** / **Regenerate week** / **Working...**
- `PlanWorkspace.tsx` root is `grid-cols-1 gap-10 lg:grid-cols-5` with calendar `lg:col-span-3` and chat `lg:col-span-2`; `PlanChat.tsx` is unmodified
- `weekHasUnits` / `generatePlanButtonLabel` unit tests pass; PlanCalendar/PlanWorkspace source-read tests pass
- `npm test -- src/lib/dates.test.ts src/components/plan/PlanCalendar.test.ts src/components/plan/plan-month.test.ts src/components/plan/PlanWorkspace.test.ts` exits 0
- `npm test` exits 0
- `npm run lint` exits 0

#### Manual Verification:

- On `/dashboard` Week: month grid (Mon–Sun, 5–6 rows), header month + year, Rest on empty in-month days, TODAY on utc today, no cell action icons, Today control next to chevrons, calendar wider than chat on a large viewport

---

## Phase 4: Load the visible month and merge week mutations

### Overview

Fetch the grid from GET `from`/`to`, merge week-scoped generate/accept/restore into month state, and load the month on mount so the grid is real rows, not the SSR week alone.

### Changes Required:

#### 1. Month fetch and merge

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Navigating months and landing on Week shows persisted units for every in-month day; generate/chat still apply to `weekStart` only.

**Contract**:

- Replace week-only calendar loads (month nav, Today, mount) with `loadMonth`: one GET `/api/plan?weekStart=<active>&from=<grid[0]>&to=<grid[last]>` plus existing GET `/api/chat?weekStart=<active>`. The range response is the month snapshot — **set** units/logs from that GET, do not keep stale days outside the new grid. Do not ship fixture workouts.
- Call `loadMonth` from prev/next/Today after state updates, and from a **mount-only** `useEffect` so SSR’s single week is replaced by the month window. Do not add a second `useEffect` that re-GETs whenever `visibleMonth` or `weekStart` changes if those handlers already call `loadMonth`.
- After successful generate, accept, and restore: `mergeWeekSlice(currentUnits, incomingWeekUnits, weekStart)` — drop current units whose date is in `weekDates(weekStart)`, then union incoming. Do **not** `setUnits(incoming)` alone. Do not clear `logs` on generate (POST body has no logs). Restore dropdown and generate POST stay `{ weekStart }`.
- Generate label and `unitsEmpty` continue to use the active week. Busy still disables controls including Today/chevrons as today.
- On range GET failure, set `calendarError` from the existing `code: message` pattern; do not apply a partial body.

#### 2. Merge helper tests

**Files**: `src/components/plan/plan-month.ts`, `src/components/plan/plan-month.test.ts`

**Intent**: A generate that returns only Monday–Sunday cannot delete a unit on the following Monday that is still on screen.

**Contract**: `mergeWeekSlice` given month units including `2026-08-31` and `2026-09-07`, incoming week for `2026-08-31` replacing only that week, keeps `2026-09-07` and takes incoming rows for `weekDates("2026-08-31")`. Source-read `PlanWorkspace.tsx` for `from=` and `to=` on the plan GET (or equivalent `URLSearchParams` keys) and for `mergeWeekSlice` (or the exported name). Assert generate `fetch` body still JSON `{ weekStart }` only.

### Success Criteria:

#### Automated Verification:

- `mergeWeekSlice` keeps units outside `weekDates(weekStart)` and replaces dates inside that week with incoming
- `PlanWorkspace.tsx` loads GET `/api/plan` with `from` and `to` covering `monthGridDates(visibleMonth)` and does not `setUnits` from generate/accept/restore without merging the active week
- `PlanWorkspace.tsx` passes week-scoped emptiness into `PlanChat` (not `units.length === 0` as the sole check)
- `npm test -- src/components/plan/plan-month.test.ts src/components/plan/PlanWorkspace.test.ts src/pages/api/plan-contracts.test.ts` exits 0
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0 (dummy `SUPABASE_URL` / `SUPABASE_KEY` from this worktree’s `.env.example` copy if required; never commit `.env`)

#### Manual Verification:

- Generate a week, go to next month and back: in-month workouts persist from the API (not fixtures); Generate plan vs Regenerate week follows the **active week**; chat/restore still target that week; Today returns to the current month and re-enables correctly when leaving it; padding days stay muted without workouts

---

## Testing Strategy

### Unit Tests:

- `dates.test.ts` — month grid, active weekStart, formatMonthYear, inclusive dates.
- `plan-month.test.ts` — `weekHasUnits`, `generatePlanButtonLabel`, `mergeWeekSlice`.
- `PlanCalendar.test.ts` / `PlanWorkspace.test.ts` — source-read chrome and fetch/merge contracts.
- `plan.test.ts` / `plan-contracts.test.ts` — range GET ownership + validation.

### Integration Tests:

- GET range two-user memory store (`test-plan.md` §6.2, §6.4). Existing POST generate volume oracle and product 401 gates stay.

### Manual Testing Steps:

1. Sign in, open Week: month grid, Rest, Today, 3/2 layout, no cell icons.
2. Generate the active week; button becomes Regenerate week; other in-month days from the API still show.
3. Next/prev month; Today disabled only on the current month; chat remains the active week.

## Performance Considerations

One GET of at most 42 dates via `.in("date", …)` plus one chat GET per month navigation. No N+1 week fetches. No new SSR month query in `dashboard.astro`.

## Migration Notes

None. No SQL. Existing weekStart GET remains for any other caller. Client first paint may show only the SSR week until the month GET returns.

## References

- Locked notes: `context/changes/month-calendar/change.md`
- Calendar: `src/components/plan/PlanCalendar.tsx`
- Workspace: `src/components/plan/PlanWorkspace.tsx`
- Dates: `src/lib/dates.ts`
- Plan GET / `listWeek`: `src/pages/api/plan.ts`, `src/lib/services/plan.ts`
- Logs: `src/lib/services/workout-log.ts`
- Memory persist: `src/lib/test/memory-supabase.ts`
- Test plan: `context/foundation/test-plan.md` §6
- PRD calendar view: FR-005

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: UTC month and grid helpers

#### Automated

- [x] 1.1 `src/lib/dates.test.ts` asserts September 2026 `monthGridDates` is `2026-08-31` through `2026-10-04` (35 days), `activeWeekStartForMonth` current-month vs other-month, `formatMonthYear("2026-09-01")` is `September 2026`, and `inclusiveIsoDates` inclusive/empty-when-reversed — fcde101
- [x] 1.2 `npm test -- src/lib/dates.test.ts` exits 0 — fcde101
- [x] 1.3 `npm test` exits 0 — fcde101
- [x] 1.4 `npm run lint` exits 0 — fcde101

### Phase 2: Inclusive plan GET range

#### Automated

- [x] 2.1 GET `/api/plan` without `from`/`to` still returns one week of session units/logs; GET with valid `from`/`to` returns session units/logs in that inclusive window and not another member’s rows — d14b680
- [x] 2.2 GET with only `from`, `from > to`, a 43-day span, or a non-ISO date returns 400 `VALIDATION_ERROR` and does not mutate the memory store — d14b680
- [x] 2.3 Logged-out GET `/api/plan` remains 401 `{ error: { code: "UNAUTHORIZED", message: "Sign in required" } }` with no `units`/`logs` (`src/pages/api/product-gates.test.ts`) — d14b680
- [x] 2.4 `npm test -- src/lib/services/plan.test.ts src/pages/api/plan-contracts.test.ts src/pages/api/product-gates.test.ts` exits 0 — d14b680
- [x] 2.5 `npm test` exits 0 — d14b680
- [x] 2.6 `npm run lint` exits 0 — d14b680

### Phase 3: Month grid, Today, generate label, layout

#### Automated

- [x] 3.1 `PlanCalendar.tsx` uses `grid-cols-7` for the month cells, renders **Rest** (not **Empty**) for in-month days without a unit, has no Edit/Log/Unlog/Freeze icon buttons, and labels generate **Generate plan** / **Regenerate week** / **Working...** — 51e8f5b
- [x] 3.2 `PlanWorkspace.tsx` root is `grid-cols-1 gap-10 lg:grid-cols-5` with calendar `lg:col-span-3` and chat `lg:col-span-2`; `PlanChat.tsx` is unmodified — 51e8f5b
- [x] 3.3 `weekHasUnits` / `generatePlanButtonLabel` unit tests pass; PlanCalendar/PlanWorkspace source-read tests pass — 51e8f5b
- [x] 3.4 `npm test -- src/lib/dates.test.ts src/components/plan/PlanCalendar.test.ts src/components/plan/plan-month.test.ts src/components/plan/PlanWorkspace.test.ts` exits 0 — 51e8f5b
- [x] 3.5 `npm test` exits 0 — 51e8f5b
- [x] 3.6 `npm run lint` exits 0 — 51e8f5b

#### Manual

- [x] 3.7 On `/dashboard` Week: month grid (Mon–Sun, 5–6 rows), header month + year, Rest on empty in-month days, TODAY on utc today, no cell action icons, Today control next to chevrons, calendar wider than chat on a large viewport

### Phase 4: Load the visible month and merge week mutations

#### Automated

- [x] 4.1 `mergeWeekSlice` keeps units outside `weekDates(weekStart)` and replaces dates inside that week with incoming — d13a968
- [x] 4.2 `PlanWorkspace.tsx` loads GET `/api/plan` with `from` and `to` covering `monthGridDates(visibleMonth)` and does not `setUnits` from generate/accept/restore without merging the active week — d13a968
- [x] 4.3 `PlanWorkspace.tsx` passes week-scoped emptiness into `PlanChat` (not `units.length === 0` as the sole check) — d13a968
- [x] 4.4 `npm test -- src/components/plan/plan-month.test.ts src/components/plan/PlanWorkspace.test.ts src/pages/api/plan-contracts.test.ts` exits 0 — d13a968
- [x] 4.5 `npm test` exits 0 — d13a968
- [x] 4.6 `npm run lint` exits 0 — d13a968
- [x] 4.7 `npm run build` exits 0 (dummy `SUPABASE_URL` / `SUPABASE_KEY` from this worktree’s `.env.example` copy if required; never commit `.env`) — d13a968

#### Manual

- [x] 4.8 Generate a week, go to next month and back: in-month workouts persist from the API (not fixtures); Generate plan vs Regenerate week follows the **active week**; chat/restore still target that week; Today returns to the current month and re-enables correctly when leaving it; padding days stay muted without workouts
