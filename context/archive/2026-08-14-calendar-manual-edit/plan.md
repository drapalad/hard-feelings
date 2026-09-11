# Calendar Manual Edit Implementation Plan

## Overview

Let a signed-in member change a calendar workout’s type, distance, and optional structure, then undo that edit by restoring the previous week snapshot. This is roadmap S-04 (FR-005 edit + undo). Chat accept/reject, generate, and freeze stay as they are.

## Current State Analysis

S-02 is on disk: `training_units` (one row per member per date), `GET`/`POST /api/plan`, `PATCH /api/plan/units` (freeze flag only), `replaceWeek` upsert, dashboard `PlanCalendar` via `PlanWorkspace`. Generate fills a week; freeze does not regenerate.

S-03 is on disk: chat propose → pending `plan_propositions` JSON snapshot → Accept `replaceWeek`s the week with no unit history. `applyMutations` patches existing dates only and never touches `frozen`. `rejectPending` is private in `chat.ts`. `validatePlan` is the only bound surface. Hard bounds block **chat accept** (409); they do not currently apply to freeze or generate persistence beyond `generatePlan` failing closed.

There is no type/km editor, no revision table, and no undo control. `PROTECTED_ROUTES` is still `["/dashboard"]` only. JSON APIs return 401 via `unauthorized()`. shadcn inventory is `Button` only; `SetupForm` uses `FormField` + native `<select>`. DEP-009 (`training_units` hosted) and DEP-010 (chat SQL) are open. Next free deploy id is **DEP-012** (DEP-011 is privacy/cookies).

## Desired End State

A signed-in member with at least one stored unit can open that day, change type / km / structure, save, and see the cell update plus any `validatePlan` soft or hard messages as warnings. They can Undo last edit for that week (repeatable down a short stack) and get the previous week back. Empty days stay empty (no create-from-empty). Frozen flag stays unless they use the existing Freeze control. Successful edit/undo rejects a pending chat proposition for that week so Accept cannot clobber the calendar. Generate and chat Accept clear the undo stack. Another member cannot read revisions. Unauthenticated JSON returns 401; `/api/plan*` is not on `PROTECTED_ROUTES`.

### Key Discoveries:

- `PATCH /api/plan/units` is freeze-only (`freezeWriteSchema` requires `frozen`). Do not overload it for content edits — add `PUT` on the same file.
- `applyMutations` (`src/lib/services/plan-adaptation.ts`) already patches type/km/structure on existing dates, keeps `frozen`, skips unknown dates. Reuse it; do not fork a second mutator.
- `replaceWeek` has no history. Undo needs a new `plan_revisions` table storing camelCase `TrainingUnit[]` JSON (same convention as `plan_propositions.proposed_units` — do not store snake_case in jsonb).
- Chat `rejectPending` is not exported and `chat.ts` already imports `plan.ts`. `plan.ts` must not import `chat.ts`. Export `rejectPending` and call it from the PUT/undo **routes** (orchestration), not from `plan.ts`.
- `validatePlan` `FROZEN_ANCHOR_DROPPED` compares against the `frozenUnits` argument. Pass frozen units from the **updated** week so editing a frozen day’s type/km rewrites the anchor instead of hard-failing. Do not 409 on hard volume/consecutive-longs — member dictation + undo is the recovery (PRD hard-bound NFR is about AI accept).
- JSON APIs must not join `PROTECTED_ROUTES`. Cookie SSR `createClient` only. RLS isolation.
- UTC `YYYY-MM-DD` via `utcMondayOf` / `weekDates`. Never `new Date("YYYY-MM-DD")`.
- Hosted SQL is a separate DEP: this slice needs **DEP-012**. Do not close DEP-001–DEP-011.

## What We're NOT Doing

- Version-history picker / restore-by-id UI (undo stack only). Chat-style diff for manual edits.
- Creating units on empty days, deleting days, or changing `date`.
- Changing `frozen` through PUT (keep `PATCH` freeze).
- Blocking manual saves on `validation.hard` (that remains chat Accept only).
- Workout logging (S-05), LLM chat (S-07), Admin (S-06), BoundCode changes, algorithm rewrite.
- Adding `/api/*` to `PROTECTED_ROUTES`, service-role Supabase, or client-exposed secrets.
- New shadcn Dialog/Input/Select — native select + existing `FormField`/`Button`/`ServerError`.
- Playwright / jsdom / CI Supabase / hosted `db push`.
- Snapshotting generate or chat Accept onto the undo stack (those operations **clear** it).
- Closing DEP-001–DEP-011.

## Implementation Approach

Add `plan_revisions` (week JSON snapshots, RLS). Pure `applyUnitEdit` decides NOT_FOUND / no-op / next week. On a real change: snapshot current week, UPDATE the one `training_units` row (keep `frozen`), trim the stack to 10, run `validatePlan` for display, reject pending chat. Undo pops the latest snapshot through `replaceWeek`. Dashboard: inline cell editor + Undo last edit when the stack is non-empty.

## Critical Implementation Details

**Do not import `chat.ts` from `plan.ts`.** Export `rejectPending(client, userId, weekStart)` from `src/lib/services/chat.ts`. PUT and POST undo handlers call it after a successful calendar write. `generateAndPersist` and `acceptProposition` call `clearRevisions` from `plan.ts` after `replaceWeek`.

**Frozen units are the new values.** After applying the patch, `frozenUnits = nextWeek.filter((u) => u.frozen)` before `validatePlan`. Editing a frozen cell does not clear `frozen`.

**No-op does not snapshot.** If type, km, and structure are unchanged, return the current unit/week with `changed: false` and `undoAvailable` unchanged and skip `rejectPending`.

**`applyMutations` will not clear on `null`.** `structure ?? existing` keeps the previous structure when the patch is `null`. `applyUnitEdit` must send `""` when the caller passed `null`.

**Cap 10 revisions per member per week.** After insert, delete older rows for that `(user_id, week_start)` beyond the 10 newest `created_at`.

**`GET /api/plan` grows additively:** `{ weekStart, units, undoAvailable }`. `POST /api/plan` (generate) returns `undoAvailable: false`. Dashboard SSR passes `undoAvailable` into `PlanWorkspace`.

---

## Phase 1: Schema and RLS

### Overview

Store per-week undo snapshots so a later phase can restore without inferring history from `training_units`.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_plan_revisions.sql` (new; timestamp at implement time)

**Intent**: Durable undo stack for a member’s week, isolated by RLS, independent of Worker rollback.

**Contract**:

- `plan_revisions`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`; `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`; `week_start date NOT NULL`; `units jsonb NOT NULL`; `created_at timestamptz NOT NULL DEFAULT now()`.
- Index `(user_id, week_start, created_at DESC)` for latest-pop and trim.
- `ENABLE ROW LEVEL SECURITY` and granular SELECT, INSERT, DELETE policies (`auth.uid() = user_id`). UPDATE policy optional (stack is insert/delete only) — if omitted, do not add a combined ALL policy. No UPDATE needed for this slice.
- Comment that Worker rollback does not undo this SQL.

#### 2. Deploy backlog

**File**: `context/deployment/deferred.md`

**Intent**: Hosted Supabase must receive this SQL separately from Worker deploys.

**Contract**: Append **DEP-012** (next free id): apply `*_plan_revisions.sql` to the hosted project behind `SUPABASE_URL`; Source = this plan; note Worker rollback does not undo SQL. Leave DEP-001–DEP-011 unchanged.

### Success Criteria:

#### Automated Verification:

- `supabase/migrations/` contains a `*_plan_revisions.sql` file with `plan_revisions` as specified (`units jsonb`, FK to `auth.users`, index on `(user_id, week_start, created_at DESC)`)
- The table enables RLS with separate SELECT, INSERT, and DELETE policies on `auth.uid() = user_id`
- `context/deployment/deferred.md` has an open DEP-012 for applying this migration to hosted Supabase; DEP-001–DEP-011 statuses are unchanged

---

## Phase 2: Pure edit helper and schemas

### Overview

Lock “existing day only / keep frozen / no-op detection” in Vitest before HTTP or SQL writes.

### Changes Required:

#### 1. `applyUnitEdit` + write schema

**File**: `src/lib/services/plan.ts` (and colocated `src/lib/services/plan.test.ts`)

**Intent**: One pure function the PUT path and tests share, built on `applyMutations` so skip-unknown-date and frozen-preserve stay in one place.

**Contract**:

- Export `unitEditSchema`: `{ date: YYYY-MM-DD, type: WorkoutType, distanceKm: finite number ≥ 0, structure?: string | null }` (structure max length 500).
- Export `applyUnitEdit(units, date, patch): { ok: false; code: "NOT_FOUND" } | { ok: true; units: TrainingUnit[]; changed: boolean }`. Missing date → `NOT_FOUND`. Before `applyMutations`, map `structure: null` → `""` (`applyMutations` treats `null` as “keep” via `??`, and `""` as clear). Omit `structure` on the mutation when the patch field is `undefined` (keep existing). `changed` is false when the sorted week equals the input week (type, km, structure, frozen).
- Do not write to the database in this phase.

### Success Criteria:

#### Automated Verification:

- `applyUnitEdit` on an unknown date returns `NOT_FOUND`; on a known date changes type/km and keeps `frozen`
- `structure: ""` or `null` clears structure; omitted `structure` (`undefined`) keeps the existing value
- Unchanged type/km/structure returns `changed: false`
- `unitEditSchema` rejects negative km and unknown types
- `npm test` exits 0
- `npm run lint` exits 0

---

## Phase 3: Persist, undo, and HTTP

### Overview

Wire snapshot/update/undo to `training_units` + `plan_revisions`, expose PUT + POST undo, extend GET, and keep generate/accept from leaving a stale undo stack.

### Changes Required:

#### 1. Revision I/O and unit update

**File**: `src/lib/services/plan.ts`

**Intent**: Snapshot the current week before a real edit; pop on undo; drop the stack when generate or accept rewrites the week.

**Contract**:

- `hasRevision(client, userId, weekStart): Promise<boolean>`
- `clearRevisions(client, userId, weekStart): Promise<void>` — delete all rows for that week
- `editUnit(client, userId, patch): Promise<EditUnitResult>` — `listWeek` for `utcMondayOf(patch.date)`; `applyUnitEdit`; `NOT_FOUND` if missing; if `changed`, insert `{ units: currentWeek }` camelCase JSON, trim to 10 newest, UPDATE that day’s `type`/`distance_km`/`structure` only (not `frozen`); load profile `weeklyKm` (if `null` or `<= 0`, skip `validatePlan` and return empty validation — do not use a 0 ceiling); `validatePlan` with frozen units from the **new** week; return `{ unit, units, validation, undoAvailable, changed }`.
- `undoWeek(client, userId, weekStart): Promise<UndoWeekResult>` — load latest revision; `NOTHING_TO_UNDO` if none; `replaceWeek` with parsed units; delete that revision; return `{ units, undoAvailable }`. Invalid stored JSON → `DB_ERROR`.
- `generateAndPersist`: after successful `replaceWeek`, `clearRevisions` for that Monday.
- Parse revision JSON with a camelCase `TrainingUnit` mapper (mirror `chat.ts` `asTrainingUnit`; do not persist `distance_km` in jsonb).

#### 2. Export `rejectPending`

**File**: `src/lib/services/chat.ts`

**Intent**: Let plan routes invalidate a stale pending proposition without a `plan.ts` → `chat.ts` import.

**Contract**: Export the existing `rejectPending` function (same UPDATE `status = rejected` for pending rows on that week). `acceptProposition`: after successful `replaceWeek`, call `clearRevisions`.

#### 3. HTTP

**Files**: `src/pages/api/plan/units.ts` (add `PUT`), `src/pages/api/plan/undo.ts` (new), `src/pages/api/plan.ts` (`GET`/`POST` `undoAvailable`)

**Intent**: JSON APIs matching S-02/S-03 (zod, `prerender = false`, 401 JSON, try/catch `DB_ERROR`).

**Contract**:

- `PUT /api/plan/units`: body `unitEditSchema`. 400 validation; 404 `NOT_FOUND`; 503/500 as siblings. On success `jsonOk({ unit, units, validation, undoAvailable, changed })`. Call `rejectPending` only when `changed` is true.
- `POST /api/plan/undo`: body `{ weekStart?: string }` via existing `generateBodySchema` / `resolveWeekStart`. 404 `NOTHING_TO_UNDO`. Success `{ weekStart, units, undoAvailable }`. Call `rejectPending` after a successful pop.
- `GET /api/plan`: add `undoAvailable: boolean` (from `hasRevision`). `POST /api/plan` success body adds `undoAvailable: false`.
- Do not add `/api/plan` to `PROTECTED_ROUTES`.

### Success Criteria:

#### Automated Verification:

- `src/pages/api/plan/units.ts` and `src/pages/api/plan/undo.ts` export `prerender = false`
- Handlers return 401 JSON (not a redirect) when `locals.user` is missing
- `PROTECTED_ROUTES` still does not include `/api/plan`
- `GET /api/plan` success payload includes `undoAvailable`
- `generateAndPersist` / `acceptProposition` call `clearRevisions` after a successful week replace (source inspection)
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

---

## Phase 4: Calendar edit and undo UX

### Overview

The member edits a filled day in place and can undo last edit without leaving `/dashboard`.

### Changes Required:

#### 1. Island + SSR

**Files**: `src/components/plan/PlanCalendar.tsx`, `src/components/plan/PlanWorkspace.tsx`, `src/pages/dashboard.astro`

**Intent**: Fetch/state stays in `PlanWorkspace`; calendar stays presentational; first paint knows whether Undo is available.

**Contract**:

- `dashboard.astro` loads `hasRevision` in its **own** try/catch (not the `listWeek` catch). Failure → `undoAvailable = false`; do not clear `units`. Pass `undoAvailable` into `PlanWorkspace`.
- Calendar: filled day has an Edit control; empty days do not. Edit mode (owned by calendar local state or workspace — implementer’s call) shows native `<select>` of the six `WorkoutType`s, a km number field, optional structure text, Save/Cancel. Reuse `Button` / `ServerError` / `cn()`. No `"use client"`.
- Save → `PUT /api/plan/units` with `credentials: "same-origin"`. On success replace `units`, set `soft` from `validation.soft` **and show hard messages in the same warning list** (hard is informational here), set `undoAvailable`, clear pending `proposition` when the edit changed the week.
- Undo last edit button in the calendar header, disabled when `!undoAvailable` or `busy` → `POST /api/plan/undo`. On success replace units, update `undoAvailable`, clear proposition.
- Week nav `GET /api/plan` must read `undoAvailable`. Generate POST body includes `undoAvailable: false` — use it. On successful chat Accept, set `undoAvailable` false locally (server `clearRevisions`; accept JSON need not add the field).
- Surface API `code: message` on `calendarError` as today.

### Success Criteria:

#### Automated Verification:

- `PlanCalendar` exposes edit fields for a filled unit and has no create-on-empty-day control
- `PlanWorkspace` calls `PUT /api/plan/units` and `POST /api/plan/undo`
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Sign in with a generated week; edit a day’s type and km; reload keeps the edit
- Undo restores the previous type/km; a second undo restores the snapshot before that (or disables when the stack is empty)
- Generate after an edit disables Undo; a pending chat proposition disappears after a successful save
- Editing a frozen day keeps the Frozen badge; Freeze still works; empty days stay without an editor

---

## Testing Strategy

### Unit Tests:

- `applyUnitEdit` NOT_FOUND / change / no-op / frozen preserved / structure cleared.
- `unitEditSchema` rejects bad type and negative km.
- Existing `unauthorized()` 401 JSON test remains.

### Integration Tests:

- None in CI (no Supabase in GHA). Local `npx supabase db reset` proves the migration applies; not a Progress Manual row.

### Manual Testing Steps:

1. `npx supabase start` and apply migrations; sign in; generate a week.
2. Edit type/km; reload; Undo; confirm generate clears Undo.
3. Start a chat proposition, then save a manual edit; confirm Accept is gone / pending rejected.

## Performance Considerations

One week, ≤7 units, ≤10 jsonb snapshots. Trim after insert. Do not treat this slice as a reason to close DEP-002.

## Migration Notes

Additive table. Local: `npx supabase db reset` (or `migration up`) after start. Hosted: apply the new file via DEP-012 **before** expecting production undo to persist. Rolling back the Worker does not drop `plan_revisions`. No backfill. Missing table ⇒ undo/edit writes fail until DEP-012.

## References

- Roadmap S-04: `context/foundation/roadmap.md`
- PRD FR-005 (edit + undo or version restore): `context/foundation/prd.md`
- S-02: `src/lib/services/plan.ts`, `src/pages/api/plan.ts`, `src/pages/api/plan/units.ts`, `PlanCalendar.tsx`
- S-03: `src/lib/services/chat.ts` (`rejectPending`, `acceptProposition`), `applyMutations`, `validatePlan`
- AGENTS: zod APIs, `prerender = false`, RLS migrations, `PROTECTED_ROUTES`, `cn()`
- Deploy backlog: `context/deployment/deferred.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and RLS

#### Automated

- [x] 1.1 `supabase/migrations/` contains a `*_plan_revisions.sql` file with `plan_revisions` as specified (`units jsonb`, FK to `auth.users`, index on `(user_id, week_start, created_at DESC)`) — f4dbb0a
- [x] 1.2 The table enables RLS with separate SELECT, INSERT, and DELETE policies on `auth.uid() = user_id` — f4dbb0a
- [x] 1.3 `context/deployment/deferred.md` has an open DEP-012 for applying this migration to hosted Supabase; DEP-001–DEP-011 statuses are unchanged — f4dbb0a

### Phase 2: Pure edit helper and schemas

#### Automated

- [x] 2.1 `applyUnitEdit` on an unknown date returns `NOT_FOUND`; on a known date changes type/km and keeps `frozen` — b09af03
- [x] 2.2 `structure: ""` or `null` clears structure; omitted `structure` (`undefined`) keeps the existing value — b09af03
- [x] 2.3 Unchanged type/km/structure returns `changed: false` — b09af03
- [x] 2.4 `unitEditSchema` rejects negative km and unknown types — b09af03
- [x] 2.5 `npm test` exits 0 — b09af03
- [x] 2.6 `npm run lint` exits 0 — b09af03

### Phase 3: Persist, undo, and HTTP

#### Automated

- [x] 3.1 `src/pages/api/plan/units.ts` and `src/pages/api/plan/undo.ts` export `prerender = false` — baf6d22
- [x] 3.2 Handlers return 401 JSON (not a redirect) when `locals.user` is missing — baf6d22
- [x] 3.3 `PROTECTED_ROUTES` still does not include `/api/plan` — baf6d22
- [x] 3.4 `GET /api/plan` success payload includes `undoAvailable` — baf6d22
- [x] 3.5 `generateAndPersist` / `acceptProposition` call `clearRevisions` after a successful week replace (source inspection) — baf6d22
- [x] 3.6 `npm test` exits 0 — baf6d22
- [x] 3.7 `npm run lint` exits 0 — baf6d22
- [x] 3.8 `npm run build` exits 0 — baf6d22

### Phase 4: Calendar edit and undo UX

#### Automated

- [x] 4.1 `PlanCalendar` exposes edit fields for a filled unit and has no create-on-empty-day control — e5e7b5a
- [x] 4.2 `PlanWorkspace` calls `PUT /api/plan/units` and `POST /api/plan/undo` — e5e7b5a
- [x] 4.3 `npm run lint` exits 0 — e5e7b5a
- [x] 4.4 `npm run build` exits 0 — e5e7b5a

#### Manual

- [x] 4.5 Sign in with a generated week; edit a day’s type and km; reload keeps the edit
- [x] 4.6 Undo restores the previous type/km; a second undo restores the snapshot before that (or disables when the stack is empty)
- [x] 4.7 Generate after an edit disables Undo; a pending chat proposition disappears after a successful save
- [x] 4.8 Editing a frozen day keeps the Frozen badge; Freeze still works; empty days stay without an editor
