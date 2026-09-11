# Show races on the month grid and on the plan list Implementation Plan

## Overview

Overlay the member’s existing `listRaces` array onto Calendar month cells, the open day panel, and List rows so an A-priority race is visible where the plan is, not only under Profile.

## Current State Analysis

`src/pages/dashboard.astro` already calls `listRaces` and passes `races` into `DashboardTabs`. The island forwards that array only to `SetupForm` (Profile). `PlanWorkspace` has no `races` prop. `PlanCalendar` cells show day number, optional unit (type/km/structure), and **Rest** on empty in-month days. The day panel shows unit edit/log/freeze or “Rest day. No planned workout.”

`PlanList` (`src/components/plan/PlanList.tsx`) exists (dashboard-list-chrome). It GETs `/api/plan?from=&to=` for UTC today through 21 inclusive days and lists planned units only. Rest days (no `training_units` row) are omitted. A race on a rest day therefore never appears.

`Race` is `{ id, date, priority, goal?, name? }` (`src/types.ts`). Profile already renders lucide `Flag` and `{race.name ?? "Untitled race"} ({priority})` (`SetupForm.tsx`). `races_user_id_date_key UNIQUE (user_id, date)` means at most one race per date. Vitest is Node-only; calendar/list UI contracts are `readFileSync` source-scans plus exported helpers (`formatDayLabel`, `listWindow`, `unitsInListWindow`). Playwright is not a suite (`test-plan.md` §6.3).

## Desired End State

On `/dashboard` Calendar, an in-month cell whose `date` matches a race shows lucide `Flag`, a truncated display name (`Untitled race` when `name` is missing/blank), and the priority letter in parentheses. A planned unit on that day still shows. The open day panel repeats the same marker. Padding days outside the visible month do not show races.

On List, a race on a listed unit date gets the same marker on that row. A race with no planned unit still appears as its own upcoming row inside the 21-day window. The empty copy (“No planned workouts…”) shows only when that window has neither units nor races.

Markers use the SSR `races` prop from `listRaces`. No hardcoded race date or name in production components.

### Key Discoveries:

- `DashboardTabs` already receives `races` (`DashboardTabs.tsx`). Thread it; do not add a second fetch or change `dashboard.astro`.
- `PlanList` already imports `formatDayLabel` from `PlanCalendar.tsx`. Export race label/marker helpers from the same file rather than adding a new module (locked file list).
- `unitsInListWindow` drops dates with no unit. List must union in-window races or race-only days stay hidden.
- Unique `(user_id, date)`: index races with `Map<date, Race>`. If a duplicate slipped in, last write wins.
- Profile CRUD still mutates local `SetupForm` state only. Calendar/List keep the page-load `races` snapshot until reload. Locked: do not change Profile CRUD.
- Compact cells already use `truncate` for structure. Same CSS for the race name. Flag `aria-hidden` like `Snowflake`.
- `PlanList.test.ts` already forbids `2026-` in `PlanList.tsx`. Extend that lock to calendar production source so a September fixture cannot sneak in.

## What We're NOT Doing

- POST, migrations, a new table, or changing Profile race CRUD.
- Generate, chat, snapshots, month chrome, tab ids, or List window length.
- Refetching races after Profile add/edit/delete in the same session.
- Hardcoding a September (or any) race in a component.
- Playwright, jsdom, Testing Library, visual snapshots.
- `"use client"` or concatenating Tailwind class strings (`cn()` only).
- Stamping roadmap done, writing `lessons.md`, or archiving this change.

## Implementation Approach

Thread `races` from `DashboardTabs` through `PlanWorkspace` into `PlanCalendar`, index by `date`, and overlay the Flag + label on in-month cells and the day panel. Then pass the same array into `PlanList` and union races into the upcoming rows so rest-day races are not omitted.

LOCKED: files and behaviors in `change.md` Notes. ASSUMED: race-only in-month cells omit the **Rest** label so the race is the cell’s identity (FU-116).

## Critical Implementation Details

**Race label.** `raceMarkerLabel(race)` returns `` `${displayName} (${race.priority})` `` where `displayName` is `race.name` when it is a non-empty string after trim, otherwise `Untitled race`. Visible marker is lucide `Flag` (`aria-hidden`) plus that string with `truncate` (and `title` set to the full label). Same helper and markup on cell, panel, and List.

**Index and month filter.** Build `Map<string, Race>` from the `races` prop. Overlay only when `inMonth` is true. Do not look up races for padding days.

**Rest copy.** In-month cell with a race and no unit: show the marker, omit **Rest**. Day panel with a race and no unit: show the marker, keep “Rest day. No planned workout.” Cell with unit + race: unit block plus marker. Panel with unit + race: marker plus existing unit UI.

**List union.** `listRows(units, races, from, to)` returns date-sorted rows `{ date, unit?: TrainingUnit, race?: Race }` for every date that has an in-window unit and/or an in-window race. Fetch path stays GET `/api/plan?from=&to=` when `active`. Empty copy only when `listRows` is empty.

**No fixtures in UI source.** Do not embed ISO race dates or event names in `PlanCalendar.tsx` / `PlanList.tsx` / `PlanWorkspace.tsx` / `DashboardTabs.tsx`. Tests may use dates.

---

## Phase 1: Thread races onto the month grid and day panel

### Overview

Calendar cells and the open day panel show the SSR race that falls on that date. Profile still owns CRUD.

### Changes Required:

#### 1. Pass `races` into the workspace

**File**: `src/components/dashboard/DashboardTabs.tsx`

**Intent**: The month island receives the same `listRaces` array Profile already uses, without a second load.

**Contract**: Keep passing `races` into `SetupForm`. Also pass `races={races}` into `PlanWorkspace`. Do not change tab chrome, hydrate default, or `dashboard.astro`.

#### 2. Workspace forwards `races`

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Calendar can index races without fetching.

**Contract**: Add `races: Race[]` to props (import `Race` from `@/types`). Destructure and pass `races={races}` into `PlanCalendar`. Do not merge races into month fetch, generate, snapshot, or chat.

#### 3. Cell and panel overlay

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: A matching in-month date shows Flag + truncated name + priority; the day panel repeats it; a planned unit can coexist.

**Contract**:

- Props include `races: Race[]`. Index with `Map` by `date`.
- Export `raceMarkerLabel` as specified above. Export a small `RaceMarker` (Flag + truncated label) used by `DaySummary` and `DayPanel`.
- In-month cell: if a race exists, render `RaceMarker` (all breakpoints). If unit exists, keep today’s unit block. If no unit and no race, keep Rest (`hidden sm:block`). If race and no unit, omit Rest.
- `DayPanel` accepts optional race: render `RaceMarker` above existing content when present; keep “Rest day. No planned workout.” when `unit` is undefined.
- Import `Flag` from `lucide-react`. Merge classes with `cn()`. No hardcoded race dates or names.

#### 4. Source-scan tests

**Files**: `src/components/plan/PlanCalendar.test.ts`, `src/components/plan/PlanWorkspace.test.ts`

**Intent**: Lock the prop thread and marker contract in Node without jsdom.

**Contract**: Follow existing `readFileSync` style. In `PlanWorkspace.test.ts`, also read `src/components/dashboard/DashboardTabs.tsx` (same pattern as today’s `PlanChat.tsx` scan) and assert the `PlanWorkspace` JSX includes `races={races}` while `SetupForm` still receives `races={races}`. Assert `races: Race[]` / `races={races}` on workspace → calendar. Assert `Flag`, `Untitled race`, `raceMarkerLabel`, in-month overlay, Rest omitted when race-only (cell), panel still contains `Rest day. No planned workout.` Unit-test `raceMarkerLabel` for named race, missing name, and blank name. Assert `PlanCalendar.tsx` does not match `/2026-/` (same lock as `PlanList.test.ts`). Do not import `PlanCalendar.tsx` as a React tree (Node env). Keep existing chrome/panel assertions.

### Success Criteria:

#### Automated Verification:

- `DashboardTabs.tsx` source passes `races={races}` into `PlanWorkspace` (and still into `SetupForm`); `PlanWorkspace` declares `races: Race[]` and passes `races={races}` into `PlanCalendar`
- `PlanCalendar` indexes races by date; in-month cells with a race render lucide `Flag` and `raceMarkerLabel`; race-only cells omit Rest; a unit on a race day still renders
- `DayPanel` repeats `RaceMarker` when the selected date has a race; rest-day copy remains when there is no unit
- `raceMarkerLabel` uses `Untitled race` when name is missing or blank; production `PlanCalendar.tsx` has no `2026-` date literal
- Unit tests pass: `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- On `/dashboard` Calendar, an in-month race from Profile appears on that cell (Flag + name + priority) and in the open day panel; a planned unit on the same day still shows

---

## Phase 2: Overlay races on List rows

### Overview

List shows the same race marker on matching unit rows and keeps race-only dates visible inside the 21-day window.

### Changes Required:

#### 1. Pass `races` into List

**File**: `src/components/dashboard/DashboardTabs.tsx`

**Intent**: List uses the same SSR array as Calendar.

**Contract**: `<PlanList active={selected === "list"} races={races} />`. Do not fetch `/api/races`. Do not change List `active` fetch-when-visible behavior.

#### 2. Union rows

**File**: `src/components/plan/PlanList.tsx`

**Intent**: Rest-day races are not dropped because units omit them.

**Contract**:

- Props: `{ active: boolean; races: Race[] }`.
- Export `listRows(units, races, from, to)` returning date-sorted `{ date, unit?: TrainingUnit, race?: Race }[]`. Implementation: start from `unitsInListWindow(units, from, to)`, then add any race with `date` in `[from, to]` that has no unit. The component maps `listRows`, not `units` alone. Do not hide a race because its date has no unit. Keep `unitsInListWindow` exported (existing tests).
- Render `RaceMarker` (import from `PlanCalendar`) on rows that have a race. Race-only rows: `formatDayLabel` + marker only (no type/km). Unit rows keep type/km/structure and add the marker when a race matches.
- Empty copy (`No planned workouts in the next 21 days.`) only when `listRows` is empty after a successful fetch.
- List keys stay `date`. No hardcoded race dates or names. GET `/api/plan?from=&to=` unchanged.

#### 3. List tests

**File**: `src/components/plan/PlanList.test.ts`

**Intent**: Prove union and empty-state logic; keep the no-fixture source lock.

**Contract**: `listRows` includes a race-only date in window, drops a race outside window, attaches race onto a unit date, and sorts by date. Source-scan: `races`, `RaceMarker` or `raceMarkerLabel`, Flag path via import, empty copy gated on rows not `units.length === 0`, still `not.toMatch(/2026-/)`. Keep `listWindow` / `unitsInListWindow` cases.

### Success Criteria:

#### Automated Verification:

- `PlanList` receives `races`; `listRows` unions in-window units and races; race-only dates appear; a listed unit date with a race includes the same Flag + `raceMarkerLabel` marker
- Empty copy shows only when the window has neither units nor races
- `PlanList.tsx` still has no `2026-` date literal
- Unit tests pass: `npm test -- src/components/plan/PlanList.test.ts src/components/plan/PlanCalendar.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- On List, a race with a planned unit shows Flag + name + priority on that row; a race with no unit still appears as its own upcoming row

---

## Testing Strategy

### Unit Tests:

- `raceMarkerLabel` named / missing / blank.
- `listRows` union, out-of-window drop, sort, race-on-unit.
- Source-scan prop thread and Flag / Untitled race / no `2026-` in production calendar/list files.

### Integration Tests:

None. No API or persist change.

### Manual Testing Steps:

1. Add (or use) a Profile race in the visible month. Open Calendar: cell shows Flag + name + (A|B|C|D); open the day; marker repeats; unit still shows if planned.
2. Open List: same marker on a unit row; a race with no planned unit still lists. Reload is required after Profile add in the same session.

## Performance Considerations

No extra network. `races` is already on the dashboard SSR payload. Indexing is a small in-memory `Map`.

## Migration Notes

None. Existing `races` rows are unchanged. DEP-020 (hosted `profile_plan_prefs`) is unrelated and stays open.

## References

- Change notes: `context/changes/races-on-calendar/change.md`
- Race type / unique date: `src/types.ts`, `supabase/migrations/20260813104727_profiles_and_races.sql`
- SSR load: `src/pages/dashboard.astro`
- Profile marker copy: `src/components/setup/SetupForm.tsx`
- List window: `src/components/plan/PlanList.tsx`
- Test cookbook: `context/foundation/test-plan.md` §6

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Thread races onto the month grid and day panel

#### Automated

- [x] 1.1 `DashboardTabs.tsx` source passes `races={races}` into `PlanWorkspace` (and still into `SetupForm`); `PlanWorkspace` declares `races: Race[]` and passes `races={races}` into `PlanCalendar` — 44f6969
- [x] 1.2 `PlanCalendar` indexes races by date; in-month cells with a race render lucide `Flag` and `raceMarkerLabel`; race-only cells omit Rest; a unit on a race day still renders — 44f6969
- [x] 1.3 `DayPanel` repeats `RaceMarker` when the selected date has a race; rest-day copy remains when there is no unit — 44f6969
- [x] 1.4 `raceMarkerLabel` uses `Untitled race` when name is missing or blank; production `PlanCalendar.tsx` has no `2026-` date literal — 44f6969
- [x] 1.5 Unit tests pass: `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts` — 44f6969
- [x] 1.6 Full suite passes: `npm test` — 44f6969
- [x] 1.7 Lint passes: `npm run lint` — 44f6969

#### Manual

- [x] 1.8 On `/dashboard` Calendar, an in-month race from Profile appears on that cell (Flag + name + priority) and in the open day panel; a planned unit on the same day still shows

### Phase 2: Overlay races on List rows

#### Automated

- [x] 2.1 `PlanList` receives `races`; `listRows` unions in-window units and races; race-only dates appear; a listed unit date with a race includes the same Flag + `raceMarkerLabel` marker — 856f007
- [x] 2.2 Empty copy shows only when the window has neither units nor races — 856f007
- [x] 2.3 `PlanList.tsx` still has no `2026-` date literal — 856f007
- [x] 2.4 Unit tests pass: `npm test -- src/components/plan/PlanList.test.ts src/components/plan/PlanCalendar.test.ts` — 856f007
- [x] 2.5 Full suite passes: `npm test` — 856f007
- [x] 2.6 Lint passes: `npm run lint` — 856f007

#### Manual

- [x] 2.7 On List, a race with a planned unit shows Flag + name + priority on that row; a race with no unit still appears as its own upcoming row
