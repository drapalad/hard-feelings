# Calendar day panel Implementation Plan

## Overview

Restore Edit / Log / Freeze for a planned training day by opening a **panel below the month grid** when the member clicks an in-month cell. Cells stay compact (no in-cell actions). Reuse PUT/PATCH `/api/plan/units` and POST/DELETE `/api/plan/logs`. Merge returned rows into month state. Do not touch generate/chat/Today/month nav, PlanChat, dashboard tabs, landing, or auth.

## Current State Analysis

`PlanCalendar` (`src/components/plan/PlanCalendar.tsx`) renders `monthGridDates(visibleMonth)` in `grid-cols-7`. In-month cells show day number, type chip + type, planned km, Rest, TODAY. Padding days are muted `article`s with no workout. There are **no** Edit / Log / Freeze / ⋯ controls. Existing `PlanCalendar.test.ts` source-locks the absence of `aria-label="Edit"`, `` aria-label={`Log ``, `` aria-label={`Unlog ``, `aria-label={unit.frozen`, `onToggleFreeze`, and `onSaveEdit`. Those strings must not return.

`PlanWorkspace` (`src/components/plan/PlanWorkspace.tsx`) loads the month via GET `/api/plan?weekStart=&from=&to=`, stores logs as `_logs` (unused in the calendar), and merges generate/accept/restore/chat log slices with `mergeWeekSlice`. It does not call PUT/PATCH `/api/plan/units` or POST/DELETE `/api/plan/logs`. Those handlers lived on the seven-card week strip and were removed in `month-calendar`.

APIs still exist and are unchanged:

- PUT `/api/plan/units` — `unitEditSchema` `{ date, type, distanceKm, structure? }` → `{ unit, units, validation, revisions, changed }`. `units` is the **week** of that date (`utcMondayOf(date)`), not the visible month.
- PATCH `/api/plan/units` — `{ date, frozen }` → a single `TrainingUnit`.
- POST `/api/plan/logs` — `{ date, distanceKm? }` → `{ log, logs }` where `logs` is that date’s **week**.
- DELETE `/api/plan/logs?date=` → `{ logs }` week slice.

The pre-month calendar (`plan-calendar-ui`) had an inline edit form (type, km, structure), one-click Log POST `{ date }` with no km field, one-click Unlog DELETE, and Freeze PATCH. Soft+hard validation from PUT was shown as calendar warnings (`asWarnings`). Frozen units used a purple border plus a snowflake **button**.

Vitest is Node-only (`src/**/*.test.ts`). No Testing Library / Playwright for this island (`test-plan.md` §6.3, §7). UI contracts are source-read tests plus exported formatters.

## Desired End State

On `/dashboard` Week, clicking an **in-month** day (planned or Rest) opens a panel **under the month grid** (same calendar column) headed with `formatDayLabel(date)` and a Close control. The selected cell has a stronger outline and `aria-pressed` on the day control. Clicking the same day again, or Escape, or Close, dismisses the panel. Clicking another in-month day switches the panel. Padding days are not clickable.

For a **planned unit**, the panel offers:

- **Edit** — type + km + structure (the old form). Save → PUT `/api/plan/units`. Cancel leaves the unit unchanged and exits edit mode.
- **Log** — a km number field (default planned `distanceKm`, or existing log km if already logged) and **Save log** → POST `{ date, distanceKm }`. Do **not** POST on revealing or selecting the day. **Unlog** is one click → DELETE. When a log exists, show logged vs planned km.
- **Freeze / Unfreeze** — PATCH `{ date, frozen }` with the old `setFrozen` toggle (`frozen: !unit.frozen`).

For a **Rest** day, the panel explains Rest and has none of those actions (log API requires a planned unit; FU-003 already closed off-plan diary).

Cells stay compact: no Edit / Log / Unlog / Freeze / ⋯ / km form inside the cell. A small **non-interactive** frozen hint on a frozen cell is allowed. `PlanWorkspace` passes `logs` into the calendar (today `_logs` is unused). Successful unit/log responses merge into month state; do not refetch the month unless merge is impossible. Generate / Today / month chevrons / PlanChat / restore stay as they are.

### Key Discoveries:

- PUT and log POST/DELETE return a **week** of rows. `setUnits(body.units)` / `setLogs(body.logs)` would wipe other days of the visible month. Merge with `mergeWeekSlice(..., utcMondayOf(date))` — not the workspace `weekStart` if the clicked day sits in a different week of the month.
- PATCH freeze returns **one** unit (`jsonOk(result.unit)`). Merge by date; do not treat the body as `{ units: [...] }`.
- Existing `PlanCalendar.test.ts` greps the **whole file** for old in-cell action strings. Panel controls must use **visible text** (Edit, Save log, Unlog, Freeze, Unfreeze) and must not reintroduce `aria-label="Edit"`, `` aria-label={`Log ``, `` aria-label={`Unlog ``, `aria-label={unit.frozen`, `onToggleFreeze`, or `onSaveEdit`.
- `aria-current="date"` already marks the **Today** month-nav control. Putting `aria-current` on the selected day would collide semantically; `aria-pressed` on the day button is the toggle.
- Old Log posted `{ date }` only (planned km implied server-side). Locked notes require an explicit km field and POST `{ date, distanceKm }` on **Save log**.
- `unitEditSchema.structure` is optional; the old form always sent `structure` as a string (empty clears). Keep that payload shape.

## What We're NOT Doing

- Edit, Log, Unlog, Freeze, ⋯, or the km log form **inside** month cells.
- Reintroducing the seven fat week cards or `size-9` icon rows on a week strip.
- A shadcn dropdown / `MoreHorizontal` overflow (P-02).
- Required type-label ellipsis / nowrap (P-15).
- Changing generate/restore/Today/month navigation behavior, `PlanChat`, dashboard tabs, landing, auth, Topbar.
- Confirm-before-freeze. New migrations, columns, or RLS.
- Off-plan Rest logging (log API + FU-003).
- Playwright, jsdom, Testing Library, visual snapshots.
- `"use client"` or concatenating Tailwind class strings.
- New API routes. Weakening the existing cell-no-action source locks.

## Implementation Approach

Keep month chrome as-is. Make in-month cells a toggleable day **button** (padding stays a non-interactive `article`). Render one panel **after** the grid, not inside a cell. Restore the old edit form and freeze/log calls in the panel, with the new log km + Save step. Wire `PlanWorkspace` handlers to merge week slices (and the single freeze unit) into month state, and pass `logs` through.

Two Automated phases: (1) selection + panel chrome + Rest vs planned display, compiling with callback props; (2) planned-unit actions, API handlers, merge, source-read locks.

LOCKED: click-cell panel below the grid, not in-cell icons. LOCKED: reuse existing APIs. LOCKED: merge, don’t refetch the month unless merge is impossible.

## Critical Implementation Details

- **Forbidden source strings.** Do not add `aria-label="Edit"`, `` aria-label={`Log ``, `` aria-label={`Unlog ``, `aria-label={unit.frozen`, `onToggleFreeze`, or `onSaveEdit` anywhere in `PlanCalendar.tsx`. Name workspace callbacks `onSaveUnit` / `onSetFrozen` / `onSaveLog` / `onUnlog`. Panel buttons use visible labels (`Edit`, `Save`, `Cancel`, `Save log`, `Unlog`, `Freeze`, `Unfreeze`) and Close uses a distinct `aria-label` such as `Close day`.
- **Merge key is the action date’s Monday.** `mergeWeekSlice(current, incoming, utcMondayOf(date))` for PUT `units` and POST/DELETE `logs`. Freeze: `current.map(item => item.date === saved.date ? saved : item)` (add if missing). Fallback: if PUT 200 has a parseable `unit` but no `units` array, merge that one unit by date. If 200 has neither, then `loadMonth` (merge impossible).
- **Edit validation display.** Restore `asWarnings` (hard concatenated with soft) for PUT, matching the old calendar. Generate/accept still use `asSoft` only.
- **Selection lifecycle.** `selectedDate` is calendar-local. Reset it when `visibleMonth` changes. Escape closes when a day is selected (window listener while selected). Same-day click toggles closed. Do not add click-outside-to-close (not in Notes).
- **Log km default.** When the selected planned day changes, set the log field to existing log km if present, else `unit.distanceKm`. Save log no-ops if `Number(logKm)` is not finite or is negative (same guard as the old edit km).
- **Panel stays open after successful Save / Save log / Freeze / Unlog** so the member can chain actions. Edit mode exits on Save or Cancel. ASSUMED (FU-093).

## Phase 1: Click-cell selection and day panel chrome

### Overview

In-month days become selectable. A panel under the grid shows that date. Rest vs planned content is visible. Padding days stay inert. No in-cell action controls. Workspace starts passing `logs`. Mutation callbacks may be no-op signatures so Phase 2 can fill them — or omitted until Phase 2 if the panel in this phase is display-only. Prefer display-only in this phase so the compile surface stays small: no Edit/Log/Freeze buttons yet, but the panel and selection must exist.

### Changes Required:

#### 1. Selectable in-month cells + panel shell

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Clicking a real month day opens a panel under the grid; cells stay compact; padding days do nothing.

**Contract**:

- Keep the month header, chevrons, Today, generate, week history, `ServerError`, warnings, empty-week hint, and `grid-cols-7` cells.
- For **in-month** dates, the cell’s interactive control is a `type="button"` that toggles `selectedDate` (same day closes). Set `aria-pressed={selectedDate === date}`. Stronger outline/ring on the selected cell via `cn()` (must still allow today’s `border-white/60` to apply). Do not put `aria-current` on the day button (Today already uses `aria-current="date"`).
- Padding (out-of-month) cells remain non-button `article`s with no `onClick`.
- After the grid, if `selectedDate` is set, render a panel in the same `<section>`: heading `formatDayLabel(selectedDate)`, a Close control (`aria-label="Close day"`), Rest copy when no unit, otherwise type chip + planned km (+ structure if present) + logged vs planned km when `logs` contains that date.
- Escape closes the panel (add/remove a `keydown` listener while selected). Changing `visibleMonth` clears selection.
- Optional non-interactive frozen hint on a frozen in-month cell (e.g. a `Snowflake` icon with `aria-hidden`, not a button). No action icons in the cell.
- New prop `logs: WorkoutLog[]`. Do not add Edit/Log/Freeze **buttons** in this phase (display only).
- Merge classes with `cn()`. No `"use client"`.

#### 2. Pass logs from the workspace

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Month logs become available to the calendar instead of sitting in `_logs`.

**Contract**: Rename `_logs` to `logs`. Pass `logs={logs}` into `PlanCalendar`. Do not add unit/log fetch handlers yet. Do not change generate/chat/Today/month nav/restore.

#### 3. Source-read selection locks

**File**: `src/components/plan/PlanCalendar.test.ts`, `src/components/plan/PlanWorkspace.test.ts`

**Intent**: Lock click-cell + panel-below-grid + unused-logs fix without jsdom.

**Contract**: Keep existing formatter tests and the **exact** cell-no-action expects (`aria-label="Edit"`, `` aria-label={`Log ``, `` aria-label={`Unlog ``, `aria-label={unit.frozen`, `onToggleFreeze`, `onSaveEdit`). Add locks that source contains `aria-pressed`, `formatDayLabel(selectedDate)` (or equivalent heading using `formatDayLabel` on the selected date), `Close day`, a panel after `grid-cols-7` (panel JSX is not inside the `grid.map` callback), and that padding cells are not the day `button`. `PlanWorkspace.test.ts`: source contains `logs={logs}` and does not contain `_logs`. No Playwright.

### Success Criteria:

#### Automated Verification:

- `PlanCalendar.tsx` in-month days use a `button` with `aria-pressed`; padding days have no day `onClick`; selected heading uses `formatDayLabel`; Close uses `aria-label="Close day"`; Escape handling exists; panel is not rendered inside the month `grid.map`
- Existing cell-no-action source expects in `PlanCalendar.test.ts` still pass unchanged
- `PlanWorkspace.tsx` passes `logs={logs}` and does not name `_logs`
- `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts` exits 0
- `npm test` exits 0
- `npm run lint` exits 0

#### Manual Verification:

- On `/dashboard` Week, click an in-month day: a panel appears **below the grid** with that day’s `formatDayLabel` heading and Close; the cell shows a pressed/selected outline
- Click the same day or Close or Escape: panel closes; click another in-month day: panel switches; padding days do nothing
- Cells still have no Edit / Log / Freeze / km form inside the cell

---

## Phase 2: Planned-unit actions, APIs, and month merge

### Overview

Put Edit / Save log / Unlog / Freeze in the **panel** for planned units only. Wire workspace handlers to existing APIs and merge week (or single-unit) responses into month state.

### Changes Required:

#### 1. Panel actions for a planned unit

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: The member edits, logs with an explicit km, unlogs, and freeze-toggles from the panel, never from the cell.

**Contract**:

- Rest panel: explanatory copy only. No Edit / Save log / Unlog / Freeze.
- Planned panel: **Edit** reveals the old form (type `<select>` of `base|recovery|tempo|threshold|anaerobic|long`, distance km number, structure text, Save / Cancel). Cancel restores view mode without calling `onSaveUnit`. Save parses km with the old finite/`>= 0` guard, then `onSaveUnit({ date, type, distanceKm, structure })` and exits edit mode. Action controls are labeled `size="sm"` (or default) buttons — **not** `size="icon"` / `size-9` (locked: no icon rows).
- Log block always visible for a planned unit (not a click that POSTs): number field defaulting as in Critical Details, button **Save log** → `onSaveLog(date, distanceKm)`. **Unlog** shown when a log exists → `onUnlog(date)` immediately. Show “Logged X km” vs planned km when a log exists.
- Freeze / Unfreeze visible-text button → `onSetFrozen(unit)` (workspace sends `{ date, frozen: !unit.frozen }`).
- Props: `onSaveUnit`, `onSaveLog`, `onUnlog`, `onSetFrozen`. Do not name them `onSaveEdit` / `onToggleFreeze`. Do not add the forbidden aria-label substrings. Do not put these buttons in the cell.
- Keep Phase 1 selection/panel/Rest behavior.

#### 2. Workspace handlers and merge

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Restore unit/log mutations without replacing the whole month array with a week slice.

**Contract**:

- Restore `asWarnings`. PUT `/api/plan/units` with the edit payload; on 200, `mergeWeekSlice` units using `utcMondayOf(payload.date)` when `units` is present, else merge the single `unit` by date; `setWarnings(asWarnings(validation))`; `applyStack` for revisions; if `changed === true`, `setProposition(null)` (same as old calendar).
- PATCH `/api/plan/units` `{ date, frozen: !unit.frozen }`; on 200 merge the returned unit by date.
- POST `/api/plan/logs` `{ date, distanceKm }`; DELETE `/api/plan/logs?date=`; on 200 `mergeWeekSlice` logs with `utcMondayOf(date)`.
- Errors: `setCalendarError` from `readError` (existing envelope). `busy` / `credentials: "same-origin"` match generate.
- Do not refetch the month on success. If a 200 body cannot be merged (no unit / units / logs), then `loadMonth(weekStart, visibleMonth)` once.
- Pass the four callbacks into `PlanCalendar`. Do not change generate/restore/Today/month nav/chat.

#### 3. Merge-by-date helper (optional, if not inlined)

**File**: `src/components/plan/plan-month.ts`, `src/components/plan/plan-month.test.ts`

**Intent**: Freeze (and PUT fallback) can replace one row without dropping the rest of the month.

**Contract**: If extracted, `mergeItemByDate<T extends { date: string }>(current, item)` replaces the matching date or appends, then sorts by date. Unit-test replace + append. Reuse `mergeWeekSlice` for week responses; do not reimplement it.

#### 4. Source-read action and merge locks

**Files**: `src/components/plan/PlanCalendar.test.ts`, `src/components/plan/PlanWorkspace.test.ts`

**Intent**: Panel actions and merge wiring fail CI if they drift back into cells or `setUnits(week)`.

**Contract**: Calendar source contains visible `Save log`, `Unlog`, `Freeze` or `Unfreeze` **inside the planned-unit branch** of the panel (`unit ? … : rest copy` or equivalent). File-wide grep cannot prove Rest omits those labels — lock the conditional instead (actions rendered only when a unit exists). Still assert the file does **not** contain the Phase 1 forbidden strings, and does **not** use `size="icon"` / `size-9` for panel actions. Workspace source contains `PUT` and `PATCH` to `/api/plan/units`, `POST` `/api/plan/logs`, `DELETE` `/api/plan/logs?date=`, `JSON.stringify` including `distanceKm` on the log POST, `mergeWeekSlice` for units **and** logs after those calls, and `logs={logs}`. Keep month-layout and from/to tests. No Playwright.

### Success Criteria:

#### Automated Verification:

- Planned-unit panel source includes Edit form fields (type, Distance, Structure), **Save log**, Unlog, Freeze/Unfreeze gated on a unit (not rendered for Rest); forbidden in-cell aria-label / `onSaveEdit` / `onToggleFreeze` strings remain absent; panel actions are not `size="icon"` / `size-9`
- `PlanWorkspace.tsx` PUTs/PATCHes `/api/plan/units`, POST/DELETE `/api/plan/logs` with `{ date, distanceKm }` on log save, merges week slices via `utcMondayOf` (or equivalent Monday of the action date) rather than `setLogs(nextLogs)` / `setUnits(nextUnits)` replacing the month, and still passes `logs={logs}`
- `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts src/components/plan/plan-month.test.ts` exits 0
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0 (dummy `SUPABASE_URL` / `SUPABASE_KEY` from this worktree’s `.env.example` copy if required; never commit `.env`)

#### Manual Verification:

- Click a planned Tuesday: panel below the grid with Edit, km log field, Save log, Freeze; Save edit updates the cell; Cancel does not; Save log POSTs only after km Save (not on first selecting the day); Unlog removes the log in one click; Freeze/Unfreeze match the unit and any cell frozen hint
- Click a Rest day: panel explains Rest and has no Edit / Log / Freeze
- Month cells stay compact with no in-cell action row

---

## Testing Strategy

### Unit Tests:

- Keep `formatDayLabel` / `formatWeekRange` / `formatRevisionLabel` cases.
- Keep `mergeWeekSlice` / `weekHasUnits` / generate-label tests.
- Source-read: selection (`aria-pressed`, Close day, panel outside `grid.map`), cell-no-action strings unchanged, panel action visible labels, workspace fetch+merge tokens, `logs={logs}`.
- Optional `mergeItemByDate` replace/append if extracted.

### Integration Tests:

- None. PUT/PATCH/POST/DELETE contracts already live in `plan-contracts.test.ts` / `product-gates.test.ts`. This change does not add routes or schemas.

### Manual Testing Steps:

1. Sign in, open `/dashboard` Week, generate the active week if empty.
2. Click a planned in-month day — panel below the grid, cells still compact.
3. Edit type/km/structure, Save, confirm the cell updates; Cancel on a second edit leaves the unit.
4. Change log km, Save log, confirm logged vs planned; Unlog.
5. Freeze then Unfreeze; confirm cell hint if present is not a button.
6. Click Rest — panel, no workout actions. Click padding — nothing. Escape / Close / same-day click dismisses.

## Performance Considerations

One extra panel in the calendar island. Mutations stay one existing request each. No month refetch on the happy path.

## Migration Notes

None. No schema, RLS, or new endpoints. Worker rollback is the prior JS; data shape unchanged.

## References

- `context/changes/calendar-day-panel/change.md` — LOCKED Notes
- `src/components/plan/PlanCalendar.tsx`
- `src/components/plan/PlanWorkspace.tsx`
- `src/pages/api/plan/units.ts` — PUT edit, PATCH freeze
- `src/pages/api/plan/logs.ts` — POST/DELETE
- `src/components/plan/plan-month.ts` — `mergeWeekSlice`
- Pre-month handlers: commit `78a705e` (`PlanWorkspace` toggleFreeze / saveEdit / logDay / unlogDay)
- `context/foundation/test-plan.md` §6

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Click-cell selection and day panel chrome

#### Automated

- [x] 1.1 `PlanCalendar.tsx` in-month days use a `button` with `aria-pressed`; padding days have no day `onClick`; selected heading uses `formatDayLabel`; Close uses `aria-label="Close day"`; Escape handling exists; panel is not rendered inside the month `grid.map` — 92b0cfa
- [x] 1.2 Existing cell-no-action source expects in `PlanCalendar.test.ts` still pass unchanged — 92b0cfa
- [x] 1.3 `PlanWorkspace.tsx` passes `logs={logs}` and does not name `_logs` — 92b0cfa
- [x] 1.4 `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts` exits 0 — 92b0cfa
- [x] 1.5 `npm test` exits 0 — 92b0cfa
- [x] 1.6 `npm run lint` exits 0 — 92b0cfa

#### Manual

- [x] 1.7 On `/dashboard` Week, click an in-month day: a panel appears **below the grid** with that day’s `formatDayLabel` heading and Close; the cell shows a pressed/selected outline
- [x] 1.8 Click the same day or Close or Escape: panel closes; click another in-month day: panel switches; padding days do nothing
- [x] 1.9 Cells still have no Edit / Log / Freeze / km form inside the cell

### Phase 2: Planned-unit actions, APIs, and month merge

#### Automated

- [x] 2.1 Planned-unit panel source includes Edit form fields (type, Distance, Structure), **Save log**, Unlog, Freeze/Unfreeze gated on a unit (not rendered for Rest); forbidden in-cell aria-label / `onSaveEdit` / `onToggleFreeze` strings remain absent; panel actions are not `size="icon"` / `size-9` — 15b1832
- [x] 2.2 `PlanWorkspace.tsx` PUTs/PATCHes `/api/plan/units`, POST/DELETE `/api/plan/logs` with `{ date, distanceKm }` on log save, merges week slices via `utcMondayOf` (or equivalent Monday of the action date) rather than `setLogs(nextLogs)` / `setUnits(nextUnits)` replacing the month, and still passes `logs={logs}` — 15b1832
- [x] 2.3 `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts src/components/plan/plan-month.test.ts` exits 0 — 15b1832
- [x] 2.4 `npm test` exits 0 — 15b1832
- [x] 2.5 `npm run lint` exits 0 — 15b1832
- [x] 2.6 `npm run build` exits 0 (dummy `SUPABASE_URL` / `SUPABASE_KEY` from this worktree’s `.env.example` copy if required; never commit `.env`) — 15b1832

#### Manual

- [x] 2.7 Click a planned Tuesday: panel below the grid with Edit, km log field, Save log, Freeze; Save edit updates the cell; Cancel does not; Save log POSTs only after km Save (not on first selecting the day); Unlog removes the log in one click; Freeze/Unfreeze match the unit and any cell frozen hint
- [x] 2.8 Click a Rest day: panel explains Rest and has no Edit / Log / Freeze
- [x] 2.9 Month cells stay compact with no in-cell action row
