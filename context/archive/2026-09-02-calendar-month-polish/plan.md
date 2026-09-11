# Compact month toolbar, denser phone cells, session structure, manual snapshots Implementation Plan

## Overview

Tighten the month calendar chrome (one control strip, denser phone cells, `structure` as the session line) and stop implying that generate / Accept / edit archived a version. Members save a week snapshot on purpose via **Save snapshot** → `POST /api/plan/snapshots` into existing `plan_revisions`. Restore stays.

## Current State Analysis

`PlanCalendar` (`src/components/plan/PlanCalendar.tsx`) uses `space-y-4`. Row 1 is a `text-lg` month heading plus prev / Today / next. Row 2 is Generate / Regenerate week (`generatePlanButtonLabel` from `plan-month.ts`) and a **Week history** `<select>` (`aria-label="Week history"`, placeholder **Restore a version** / **No snapshots**). Cells are `min-h-20 p-2` with day number, a TODAY word, type color dot + type name, `N.0 km`, and **Rest** on empty in-month days. `TrainingUnit.structure` is optional; the day panel shows it as muted `text-xs` under km; cells never show it.

`PlanWorkspace` (`src/components/plan/PlanWorkspace.tsx`) POSTs generate / restore / units / logs / chat. Restore already POSTs `{ weekStart, revisionId }` to `/api/plan/restore`. There is no save-snapshot handler. A single `busy` flag and `calendarError` cover generate/restore/edit.

`generateAndPersist` (`src/lib/services/plan.ts:351`) calls `snapshotWeekIfChanged` before `replaceWeek`. `acceptProposition` (`src/lib/services/chat.ts:215`) does the same. `editUnit` inserts the pre-edit week via `insertRevision` + `trimRevisions`. `restoreWeek` still snapshots the live week when it differs from the restored units, then replaces. `POST /api/plan/restore` (`src/pages/api/plan/restore.ts`) stays.

`plan_revisions` already exists (DEP-012 applied). `PlanRevisionSummary` is `{ id, createdAt }`. GET `/api/plan` returns `revisions` summaries, not the latest snapshot’s units — the client cannot compare dirty state after reload without that payload.

Vitest is Node-only (`src/**/*.test.ts`). UI contracts are source-read tests (`PlanCalendar.test.ts`). `plan-revisions.test.ts` currently asserts generate snapshots the pre-generate week. `accept-proposition.test.ts` asserts Accept writes `CURRENT` onto `plan_revisions`.

## Desired End State

On `/dashboard` Week the month section is `space-y-2`. One flex strip: month heading `text-base`, nav cluster, generate (same `onClick` and `generatePlanButtonLabel`), then snapshot controls. `md+` is one nowrap row; below `md` (including 390px) the strip wraps (`gap-2`).

Below `sm` only: cells are `min-h-12 p-1`; day number; stronger today border without the TODAY word; type color dot without the type word; km as `8` or `8.5` with no `km` suffix; no **Rest**. From `sm:` today’s cell copy stays (type name + km, Rest, TODAY). Seven-column grid stays.

When `structure` is set, it is the lead line in the open day panel (`text-base` / `font-medium`, above type and km). On `sm+` cells, a truncated second line with that string; hidden below `sm`. Read the existing field. No new column. No hardcoded session strings.

Primary history CTA is **Save snapshot**, enabled when the visible week’s units differ from the latest `plan_revisions` row for that Monday, or when there is no snapshot yet. Helper **Unsaved changes** in that dirty state; hidden when the week matches the latest snapshot. Compact **Restore** `<select>` only when `revisions.length > 0` (`aria-label="Restore"`, placeholder **Restore**). **Week history** / **Restore a version** / **No snapshots** are gone as the primary control.

Generate, Accept, and unit edit persist the plan as today and do not insert `plan_revisions`. The member archives a version only via Save snapshot. `restoreWeek` / `POST /api/plan/restore` stay (including restore’s existing pre-restore snapshot). `POST /api/plan/undo` is untouched.

### Key Discoveries:

- `snapshotWeekIfChanged` (`src/lib/services/plan.ts:378`) no-ops when `weeksEqual` and swallows insert errors so persist can continue. Manual save must **always** insert the current week, then `trimRevisions`, and must **surface** insert failures (member asked to save).
- `weeksEqual` / `unitsMatch` already compare date, type, km, frozen, and structure. Reuse that equality for dirty detection. Do not import `plan.ts` from the calendar island — duplicate a small `weekUnitsEqual` in `plan-month.ts`.
- GET `/api/plan` returns revision **summaries only**. Dirty-after-reload needs the latest row’s units (or a null). Add `latestSnapshotUnits` on GET. Snapshot POST stays `{ weekStart, revisions, undoAvailable }` as locked — after a 200 the client already has the week it just saved.
- `accept-proposition.test.ts` currently expects Accept to snapshot `CURRENT`. That assertion must flip with the persist change (Phase 1–3 floor file; do not drop the file).
- `plan-revisions.test.ts` generate/undo/cap cases are wired through `generateAndPersist` inserting a row. Cap and undo-from-snapshot move onto `snapshotCurrentWeek`. Generate asserts **no** new revision.
- PUT `/api/plan/units` returns a **week** slice. Dirty is for workspace `weekStart` (same Monday as generate/restore), not a clicked day in another week of the month.
- Existing `PlanCalendar.test.ts` greps `>Rest<` and `Today`. Phone hiding uses `hidden sm:block` / `hidden sm:inline` so those strings remain in source. Do not remove the Rest/TODAY copy; hide it below `sm`.
- Merge classes with `cn()`. No `"use client"`. No new table.

## What We're NOT Doing

- Replacing the month grid with a list.
- Profile, races overlay, or chat Accept/Reject UI.
- Changing `generatePlan` fill logic or `POST /api/plan` generate body (a later change retargets the purple button to chat).
- A migration or new snapshot table.
- Hardcoded month workouts or fixture structure strings in UI.
- Removing `restoreWeek` / `POST /api/plan/restore` / `POST /api/plan/undo`.
- Stopping restore’s existing `snapshotWeekIfChanged` of the pre-restore live week.
- Playwright, jsdom, Testing Library, visual snapshots.
- `"use client"` or concatenating Tailwind class strings.
- Stamping roadmap done, writing `lessons.md`, or archiving this change.

## Implementation Approach

Backend first so the UI can compare and POST against a real contract: add `snapshotCurrentWeek`, `snapshotBodySchema`, `POST /api/plan/snapshots`, `latestSnapshotUnits` on GET, and strip auto-insert from generate / Accept / edit. Rewrite the revision tests that encoded auto-archive.

Then chrome: one toolbar strip, responsive cells, structure as lead/truncated line, Save snapshot + dirty helper + Restore select, workspace POST + dirty from `latestSnapshotUnits` vs the `weekStart` slice.

LOCKED: files and behaviors in `change.md` Notes. LOCKED: reuse `plan_revisions`. LOCKED: keep generate button wiring. ASSUMED: GET `latestSnapshotUnits` so dirty survives reload (FU-114). ASSUMED: Save snapshot is outline/`sm`, not a second purple button (FU-115).

## Critical Implementation Details

- **Manual insert vs auto snapshot.** `snapshotCurrentWeek` always `insertRevision` of `listWeek` then `trimRevisions` (REVISION_CAP 10). It does not skip on `weeksEqual`. It does not swallow errors. `snapshotWeekIfChanged` remains for `restoreWeek` only.
- **Dirty Monday.** Filter calendar `units` with `weekDates(weekStart)` before `weekUnitsEqual` against `latestSnapshotUnits`. `latestSnapshotUnits === null` (no row) is dirty. Matching arrays hide **Unsaved changes** and disable Save snapshot (still disable while `busy`).
- **Restore after auto-snapshot.** Restore still archives the pre-restore live week as the new latest row. After a successful restore, set client `latestSnapshotUnits` to the week slice **before** merge (that is now the latest row). The restored live week is then dirty — Save snapshot is enabled. Do not special-case restore as clean.
- **Forbidden primary copy.** Do not leave `Week history`, `Restore a version`, or `No snapshots` as the select’s label/placeholder. Restore placeholder is **Restore**. Save snapshot visible text is **Save snapshot**. Unsaved helper is **Unsaved changes**.
- **Cell source locks.** Keep `grid-cols-7`. Keep Rest and TODAY strings in source behind `sm:` visibility. Compact km goes through `formatCompactKm` in `plan-month.ts` (`roundKm` then integer with no decimals else one decimal; no `km` suffix). Do not ship workout recipe strings.

## Phase 1: Manual snapshot API and stop auto-archive

### Overview

Members can archive the current week on demand. Generate, Accept, and edit no longer write `plan_revisions`. Restore still does. GET exposes the latest snapshot units for dirty detection.

### Changes Required:

#### 1. `snapshotCurrentWeek` + stop auto-insert

**File**: `src/lib/services/plan.ts`

**Intent**: Persist generate/edit as live plan only; provide an explicit snapshot function that inserts the current week and trims.

**Contract**: Remove `snapshotWeekIfChanged` from `generateAndPersist`. Remove `insertRevision` / `trimRevisions` from the changed branch of `editUnit`. Leave `restoreWeek` → `snapshotWeekIfChanged` unchanged. Export `snapshotBodySchema` (`weekStart` optional ISO date, same shape as generate). Export `snapshotCurrentWeek(client, userId, weekStart)` that resolves Monday, `listWeek`, `insertRevision` of those units, `trimRevisions`, `readRevisionStack`, and returns `{ weekStart, revisions, undoAvailable }` (or `{ ok: false, error }` on DB failure — do not swallow). Export `readLatestRevisionUnits` (latest row’s parsed units, or `null` if none/unreadable). Keep `insertRevision` / `trimRevisions` private. `REVISION_CAP` stays 10.

#### 2. Stop Accept auto-snapshot

**File**: `src/lib/services/chat.ts`

**Intent**: Accept lands the proposed week without archiving the previous one.

**Contract**: Drop `snapshotWeekIfChanged` import and the call before `replaceWeek`. Still `replaceWeek` then set proposition accepted. Do not change `gateAccept` / hard-bounds.

#### 3. POST `/api/plan/snapshots` and GET `latestSnapshotUnits`

**File**: `src/pages/api/plan/snapshots.ts`, `src/pages/api/plan.ts`

**Intent**: Authenticated members save the live week; the month GET can tell whether that week matches the latest snapshot.

**Contract**: New route `export const prerender = false`. POST: `locals.user` or `unauthorized()`; `snapshotBodySchema` + `resolveWeekStart` (400 `VALIDATION_ERROR` / `date must be YYYY-MM-DD` like restore); `createClient` or 503; `snapshotCurrentWeek`; on `{ ok: false }` return 500 `DB_ERROR` (or 404 only if the service uses `NOT_FOUND` — it should not); 200 `{ weekStart, revisions, undoAvailable }`. Same JSON error helper pattern as `restore.ts`. GET `/api/plan` adds `latestSnapshotUnits: TrainingUnit[] | null` next to existing `revisions` (null when no row). Do not change POST `/api/plan` generate body or `generatePlan` fill.

#### 4. Revision and gate tests

**File**: `src/lib/services/plan-revisions.test.ts`, `src/lib/services/accept-proposition.test.ts`, `src/pages/api/product-gates.test.ts`

**Intent**: Tests encode manual snapshot and the absence of auto-archive, not the old generate-undo story.

**Contract**: Rewrite generate cases: successful `generateAndPersist` does not increase `plan_revisions` count; failed generate still inserts none; undo after generate-from-empty is `NOTHING_TO_UNDO` (or equivalent empty stack) and does **not** clear the generated week. Move cap-trim onto `snapshotCurrentWeek` (11th insert drops oldest). Add `snapshotCurrentWeek` happy path (inserts current units, returns revisions). Add `snapshotBodySchema` parse tests. Assert `editUnit` on a changed unit does not insert a `plan_revisions` row. Flip Accept soft-land case: `plan_revisions` count stays 0 (hard-bound case already expects 0). Add POST `/api/plan/snapshots` to `GATES` in `product-gates.test.ts`.

### Success Criteria:

#### Automated Verification:

- `src/pages/api/plan/snapshots.ts` exports `prerender = false`; logged-out POST returns 401 UNAUTHORIZED JSON with no Location; success body is `{ weekStart, revisions, undoAvailable }`
- `generateAndPersist`, `acceptProposition`, and `editUnit` do not call `snapshotWeekIfChanged` or `insertRevision`; `restoreWeek` still does
- GET `/api/plan` JSON includes `latestSnapshotUnits`; `snapshotCurrentWeek` inserts current week units then trims to cap 10
- `npm test -- src/lib/services/plan-revisions.test.ts src/lib/services/accept-proposition.test.ts src/pages/api/product-gates.test.ts` exits 0
- `npm test` exits 0
- `npm run lint` exits 0

---

## Phase 2: Compact month chrome and Save snapshot UI

### Overview

One toolbar strip, denser phone cells, structure as the session line, and Save snapshot wired to the new POST with dirty/clean from `latestSnapshotUnits`.

### Changes Required:

#### 1. Labels and equality helpers

**File**: `src/components/plan/plan-month.ts`

**Intent**: Compact km and week equality live next to existing generate labels, not hardcoded in JSX.

**Contract**: Keep `generatePlanButtonLabel` / `weekHasUnits` / merge helpers unchanged. Add `formatCompactKm(km)` using `roundKm`: integer → `"8"`, otherwise one decimal `"8.5"` (no `km` suffix). Add `weekUnitsEqual` matching server `weeksEqual` (date, type, km, frozen, structure). Add `unitsInWeek(units, weekStart)` via `weekDates`. Do not add session recipe strings.

#### 2. Toolbar, cells, structure, snapshot controls

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: The month is readable at 390px; a structured day reads as a session; history is save-first.

**Contract**:

- Section `space-y-2`. One flex strip: `flex flex-wrap items-center gap-2 md:flex-nowrap`. Order: `h2` `text-base font-semibold` month heading, nav cluster (prev / Today / next, same handlers), generate button (same `onClick={onGenerate}` and `generatePlanButtonLabel(busy, activeWeekHasUnits)`), then snapshot controls. Merge with `cn()`.
- New props: `snapshotDirty: boolean`, `onSaveSnapshot: () => void`. Keep `onRestore`.
- Save snapshot: visible text **Save snapshot**; `disabled={busy || !snapshotDirty}`. **Unsaved changes** helper only when `snapshotDirty`. Restore `<select>` only if `revisions.length > 0`; `aria-label="Restore"`; empty option **Restore**; same `onChange` → `onRestore`. Do not render Week history / Restore a version / No snapshots.
- Cells: `min-h-12 p-1 sm:min-h-20 sm:p-2`; keep `grid-cols-7` and today `border-white/60`. TODAY word `hidden sm:inline`. Type name `hidden sm:inline`; keep the color dot at all breakpoints. Rest `hidden sm:block`. Km: below `sm` `formatCompactKm(unit.distanceKm)` with no suffix; from `sm:` keep `{unit.distanceKm.toFixed(1)} km`.
- Structure: if `unit.structure` is non-empty, panel lead line `text-base font-medium` **above** type and km (view mode, not the edit form). Cell: `hidden sm:block truncate` second line with that string; omit below `sm`. Do not invent structure text.
- Keep day-panel Edit / Log / Freeze, selection, Escape, padding-day inertness, and existing cell-no-action aria-label locks.

#### 3. Wire Save snapshot and dirty state

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Save snapshot uses the same busy/error path as generate; dirty follows the active week vs latest snapshot.

**Contract**: Hold `latestSnapshotUnits: TrainingUnit[] | null` (null = no snapshot). On `loadMonth` 200, read `latestSnapshotUnits` from the GET body (null if missing/unreadable). `snapshotDirty` = `latestSnapshotUnits === null || !weekUnitsEqual(unitsInWeek(units, weekStart), latestSnapshotUnits)`. `saveSnapshot` POSTs `/api/plan/snapshots` with `{ weekStart }`, `credentials: "same-origin"`, busy + `setCalendarError` like `generate`. On 200: `applyStack`, set `latestSnapshotUnits` to a copy of `unitsInWeek(units, weekStart)`. Generate / accept / saveUnit do **not** clear dirty except via the comparison (they must not write `latestSnapshotUnits`). Restore: before merging new units, if the POST succeeded, set `latestSnapshotUnits` to the pre-restore `unitsInWeek` (restore’s auto-snapshot). Pass `snapshotDirty` and `onSaveSnapshot` into `PlanCalendar`. Do not change PlanChat Accept/Reject.

#### 4. Source-read and helper tests

**File**: `src/components/plan/PlanCalendar.test.ts`, `src/components/plan/PlanWorkspace.test.ts`, `src/components/plan/plan-month.test.ts`

**Intent**: Lock chrome and wiring without jsdom or hardcoded workouts.

**Contract**: Keep formatter tests and cell-no-action expects. Add locks for `space-y-2`, `text-base`, `md:flex-nowrap`, `gap-2`, `min-h-12`, `p-1`, `Save snapshot`, `Unsaved changes`, `aria-label="Restore"`, `formatCompactKm`, `hidden sm:block` / `hidden sm:inline` around Rest/TODAY/type/structure as specified, `grid-cols-7`, `generatePlanButtonLabel`, `onClick={onGenerate}`. Assert source does **not** contain `Week history`, `Restore a version`, `No snapshots` as those exact strings. Assert no hardcoded structure recipes (do not add fixture strings like `"4x1k"` to the component). `PlanWorkspace.test.ts`: source contains `/api/plan/snapshots` and `JSON.stringify({ weekStart })` on that path; does not POST snapshots from generate. Add `formatCompactKm` (8 → `"8"`, 8.5 → `"8.5"`) and `weekUnitsEqual` cases to the existing `plan-month.test.ts` (do not duplicate them in `PlanCalendar.test.ts`). No Playwright.

### Success Criteria:

#### Automated Verification:

- `PlanCalendar.tsx` uses `space-y-2`, `text-base` month heading, `md:flex-nowrap` + `gap-2` strip, `min-h-12 p-1` below `sm`, `grid-cols-7`, `Save snapshot`, `aria-label="Restore"`, `formatCompactKm`, structure as panel lead `text-base font-medium`, and does not contain `Week history` / `Restore a version` / `No snapshots`
- `PlanWorkspace.tsx` POSTs `/api/plan/snapshots` with `{ weekStart }` and derives dirty from `latestSnapshotUnits` vs `unitsInWeek`
- `formatCompactKm(8) === "8"` and `formatCompactKm(8.5) === "8.5"`; `generatePlanButtonLabel` source and onClick unchanged
- `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts src/components/plan/plan-month.test.ts src/lib/services/plan-revisions.test.ts` exits 0
- `npm test` exits 0
- `npm run lint` exits 0

#### Manual Verification:

- At desktop (`md+`) the month heading, nav, generate, and snapshot controls sit on one nowrap row; at ~390px they wrap to two short rows with `gap-2`
- Below `sm`, in-month cells show day number, today border without TODAY, type dot without type word, compact km without `km`, no Rest; from `sm` today’s copy (TODAY, type word, `N.0 km`, Rest) remains; grid stays seven columns
- A day with `structure` set shows that string as the panel lead line above type and km, and as a truncated second line on `sm+` cells only
- Save snapshot is enabled with **Unsaved changes** when the week has no snapshot or differs from the latest; after a successful save both hide/disable; generate/edit/Accept do not add a snapshot by themselves; Restore select appears only when revisions exist and still restores

---

## Testing Strategy

### Unit Tests:

- `snapshotCurrentWeek` inserts current units and trims at 11.
- `generateAndPersist` / `acceptProposition` / `editUnit` do not insert revisions.
- `snapshotBodySchema` rejects non-ISO `weekStart`.
- `formatCompactKm` / `weekUnitsEqual`.
- Product gates: logged-out POST `/api/plan/snapshots` → 401 JSON.

### Integration Tests:

- Memory persist: snapshot then restore still lands units; restore still adds a pre-restore row (existing `restoreWeek` cases).
- Accept persist-skip (hard bounds) unchanged; soft Accept no longer writes `plan_revisions`.

### Manual Testing Steps:

1. Open `/dashboard` Week at desktop and ~390px: toolbar wrap vs nowrap; phone cells vs `sm` copy.
2. Open a day that has structure: panel lead line; `sm+` cell truncation; hidden on xs.
3. Generate a week, confirm no new Restore option until Save snapshot; save; helper clears; Restore lists the new row; restore still works.

## Performance Considerations

One extra `plan_revisions` select of the latest units on GET (single row). Snapshot POST is member-initiated, cap 10. No extra month refetch.

## Migration Notes

No SQL. Existing `plan_revisions` rows remain pickable. After deploy, generate/edit/Accept stop appending rows; members who relied on auto-archive must Save snapshot before generate if they want that week back. Restore of older rows still works.

## References

- Change notes: `context/changes/calendar-month-polish/change.md`
- Restore route: `src/pages/api/plan/restore.ts`
- Test cookbook: `context/foundation/test-plan.md` §6
- Prior calendar chrome: `context/archive/2026-09-02-calendar-day-panel/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Manual snapshot API and stop auto-archive

#### Automated

- [x] 1.1 `src/pages/api/plan/snapshots.ts` exports `prerender = false`; logged-out POST returns 401 UNAUTHORIZED JSON with no Location; success body is `{ weekStart, revisions, undoAvailable }` — d5ee285
- [x] 1.2 `generateAndPersist`, `acceptProposition`, and `editUnit` do not call `snapshotWeekIfChanged` or `insertRevision`; `restoreWeek` still does — d5ee285
- [x] 1.3 GET `/api/plan` JSON includes `latestSnapshotUnits`; `snapshotCurrentWeek` inserts current week units then trims to cap 10 — d5ee285
- [x] 1.4 `npm test -- src/lib/services/plan-revisions.test.ts src/lib/services/accept-proposition.test.ts src/pages/api/product-gates.test.ts` exits 0 — d5ee285
- [x] 1.5 `npm test` exits 0 — d5ee285
- [x] 1.6 `npm run lint` exits 0 — d5ee285

### Phase 2: Compact month chrome and Save snapshot UI

#### Automated

- [x] 2.1 `PlanCalendar.tsx` uses `space-y-2`, `text-base` month heading, `md:flex-nowrap` + `gap-2` strip, `min-h-12 p-1` below `sm`, `grid-cols-7`, `Save snapshot`, `aria-label="Restore"`, `formatCompactKm`, structure as panel lead `text-base font-medium`, and does not contain `Week history` / `Restore a version` / `No snapshots` — b7d92d5
- [x] 2.2 `PlanWorkspace.tsx` POSTs `/api/plan/snapshots` with `{ weekStart }` and derives dirty from `latestSnapshotUnits` vs `unitsInWeek` — b7d92d5
- [x] 2.3 `formatCompactKm(8) === "8"` and `formatCompactKm(8.5) === "8.5"`; `generatePlanButtonLabel` source and onClick unchanged — b7d92d5
- [x] 2.4 `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts src/components/plan/plan-month.test.ts src/lib/services/plan-revisions.test.ts` exits 0 — b7d92d5
- [x] 2.5 `npm test` exits 0 — b7d92d5
- [x] 2.6 `npm run lint` exits 0 — b7d92d5

#### Manual

- [x] 2.7 At desktop (`md+`) the month heading, nav, generate, and snapshot controls sit on one nowrap row; at ~390px they wrap to two short rows with `gap-2`
- [x] 2.8 Below `sm`, in-month cells show day number, today border without TODAY, type dot without type word, compact km without `km`, no Rest; from `sm` today’s copy (TODAY, type word, `N.0 km`, Rest) remains; grid stays seven columns
- [x] 2.9 A day with `structure` set shows that string as the panel lead line above type and km, and as a truncated second line on `sm+` cells only
- [x] 2.10 Save snapshot is enabled with **Unsaved changes** when the week has no snapshot or differs from the latest; after a successful save both hide/disable; generate/edit/Accept do not add a snapshot by themselves; Restore select appears only when revisions exist and still restores
