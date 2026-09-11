# Restore week history only through the picker Implementation Plan

## Overview

Remove the calendar **Undo last edit** button so week recovery is picker-only (FU-021). Confirm FU-020 checkout-keep-later with no restore-semantics change. Keep `POST /api/plan/undo`.

## Current State Analysis

`PlanCalendar.tsx` renders Generate, **Undo last edit** (gated on `undoAvailable`), and a Week history `<select>` that calls `onRestore`. `PlanWorkspace.tsx` implements `undo()` via `POST /api/plan/undo` and `restore()` via `POST /api/plan/restore`. `dashboard.astro` passes `undoAvailable={revisions.length > 0}`. `undoWeek` and product-gates still cover the undo route. Restore of a non-latest snapshot is checkout-keep-later (`restoreWeek` in `plan.ts`).

## Desired End State

The member restores a week only by choosing a snapshot in Week history. There is no Undo button and no island handler that posts to `/api/plan/undo`. Generate/Accept snapshot behavior and checkout-keep-later are unchanged. FU-020 and FU-021 are Status: done.

### Key Discoveries:

- FU-021 Next step names removing the Undo **button**, not deleting the undo API.
- `formatRevisionLabel` tests do not cover the Undo control.
- JSON `undoAvailable` is still returned from plan/accept/restore/units.

## What We're NOT Doing

- Changing `restoreWeek` (keep later snapshots).
- Deleting `src/pages/api/plan/undo.ts` or `undoWeek`.
- FU-002 / 409 on PUT; new SQL; Playwright; other FU/DEP except closing FU-020 and FU-021.

## Implementation Approach

Strip Undo from the React island and dashboard props. Close both FU items in `context/backlog.md`.

## Phase 1: Picker-only UI and close FU-020/021

### Overview

One recovery control on the calendar: Week history.

### Changes Required:

#### 1. Calendar island

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Picker is the only restore control.

**Contract**: Delete the **Undo last edit** button and the `undoAvailable` / `onUndo` props. Keep Generate and the Week history `<select>` (`aria-label="Week history"`, `onRestore`). Do not change `formatRevisionLabel`.

#### 2. Workspace + dashboard

**Files**: `src/components/plan/PlanWorkspace.tsx`, `src/pages/dashboard.astro`

**Intent**: No client path to pop-latest undo.

**Contract**: Remove `undo()` / `fetch("/api/plan/undo")` / `onUndo`. Stop passing `undoAvailable` into `PlanWorkspace`. `applyStack` may ignore `undoAvailable` and still apply `revisions`. Keep `restore()` → `POST /api/plan/restore`.

#### 3. Backlog

**File**: `context/backlog.md`

**Intent**: Record the human’s two answers.

**Contract**: FU-020 Status: done, under `## Done`, Done: 2026-08-31, Notes: confirmed checkout-keep-later (no code). FU-021 Status: done, under `## Done`, Done: 2026-08-31, Notes: picker-only in `calendar-undo-in-picker`; Undo button removed. Do not reopen FU-002.

### Success Criteria:

#### Automated Verification:

- `src/components/plan/PlanCalendar.tsx` contains `Week history` and `aria-label="Week history"` and contains none of `Undo last edit`, `onUndo`, or `undoAvailable`
- `src/components/plan/PlanWorkspace.tsx` contains `/api/plan/restore` and does not contain `/api/plan/undo`
- `src/pages/api/plan/undo.ts` still exists
- `context/backlog.md` FU-020 and FU-021 are Status: done under `## Done` with Done: 2026-08-31
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- On dashboard, Generate still fills the week; Week history can restore a snapshot; there is no Undo last edit button

---

## Testing Strategy

### Unit Tests:

- Existing `plan-revisions.test.ts` (undoWeek / restoreWeek) must stay green. No new Playwright.

### Manual Testing Steps:

1. Sign in → dashboard → Generate → pick a Week history snapshot → week matches that snapshot.
2. Confirm no Undo last edit control.

## Performance Considerations

One fewer button and one fewer client POST path.

## References

- `context/backlog.md` → FU-020, FU-021
- `context/changes/calendar-version-restore/plan-brief.md`
- `src/components/plan/PlanCalendar.tsx`
- `src/components/plan/PlanWorkspace.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Picker-only UI and close FU-020/021

#### Automated

- [x] 1.1 `src/components/plan/PlanCalendar.tsx` contains `Week history` and `aria-label="Week history"` and contains none of `Undo last edit`, `onUndo`, or `undoAvailable` — 90d051b
- [x] 1.2 `src/components/plan/PlanWorkspace.tsx` contains `/api/plan/restore` and does not contain `/api/plan/undo` — 90d051b
- [x] 1.3 `src/pages/api/plan/undo.ts` still exists — 90d051b
- [x] 1.4 `context/backlog.md` FU-020 and FU-021 are Status: done under `## Done` with Done: 2026-08-31 — 90d051b
- [x] 1.5 `npm test` exits 0 — 90d051b
- [x] 1.6 `npm run lint` exits 0 — 90d051b
- [x] 1.7 `npm run build` exits 0 — 90d051b

#### Manual

- [x] 1.8 On dashboard, Generate still fills the week; Week history can restore a snapshot; there is no Undo last edit button
