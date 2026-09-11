# Calendar Version Restore Implementation Plan

## Overview

Close FU-001: the calendar gets a week-history picker, and Generate / chat Accept must snapshot the current week onto `plan_revisions` instead of wiping the stack. Restoring a pre-generate snapshot returns that week. Manual save stays warnings-only (FU-002 untouched).

## Current State Analysis

S-04 shipped a per-week snapshot stack (`plan_revisions`, cap 10) plus one “Undo last edit” button. `editUnit` snapshots the current week, then updates one unit. `undoWeek` pops the latest revision and `replaceWeek`s it. `hasRevision` is a boolean; `GET /api/plan` and dashboard SSR expose `undoAvailable` only.

`generateAndPersist` (`src/lib/services/plan.ts`) calls `clearRevisions` after `replaceWeek`. `acceptProposition` (`src/lib/services/chat.ts`) does the same. `POST /api/plan` hardcodes `undoAvailable: false`. `PlanWorkspace.accept` also forces undo off. That is the FU-001 defect: Generate/Accept extinguish recovery.

`plan_revisions` columns (`id`, `user_id`, `week_start`, `units` jsonb, `created_at`) are enough. Hosted SQL already applied (DEP-012). No new migration. Labels come from `created_at`.

`PROTECTED_ROUTES` is `["/dashboard", "/admin"]`. JSON `/api/plan*` and `/api/chat*` stay off that list; they 401 via `unauthorized()`. `plan.ts` must not import `chat.ts`. shadcn inventory is still `Button` only. Tests use Vitest + `createMemorySupabase`. That harness has `plan_revisions` but not `races`, and the query builder has no `.limit()` — `undoWeek` uses `.limit(1).maybeSingle()`, so undo/restore tests need that method.

## Desired End State

A signed-in member who generates (or Accepts) a week can restore the pre-replace week from history. The picker lists up to 10 snapshots for the current week, labeled from `created_at`. One-step Undo still pops the latest snapshot. Restoring a non-latest snapshot lands that week as live and **keeps later snapshots**. Failed generate/accept does not write a snapshot. Another member cannot list or restore this member’s revisions. Unauthenticated JSON returns 401. FU-001 is closed. FU-002 is unchanged.

### Key Discoveries:

- Snapshot-before-replace already exists in `editUnit` (`insertRevision` then `trimRevisions`). Generate and Accept should reuse that path and drop `clearRevisions` at those call sites.
- `insertRevision` stores camelCase `TrainingUnit[]` DTO JSON (same as undo parse via `asDtoTrainingUnit`). Keep that shape.
- `POST /api/plan` currently returns `undoAvailable: false` even if a snapshot was written — the HTTP contract must report the real stack after generate.
- `PlanWorkspace.accept` hardcodes `setUndoAvailable(false)` regardless of the Accept body. Accept must return stack fields; the client must read them.
- Memory harness: unknown tables return empty selects (no error). `listRaces` → `races` would look like “no A race” unless `races` is added to `MEMORY_TABLES`. `.limit()` is missing and must be added for undo/restore tests.
- `replaceWeek` only **upserts**. An empty snapshot (`units: []`) therefore cannot clear a generated week — dates not in the payload stay. First-generate undo/restore needs the window to match the snapshot exactly.
- Do not import `chat.ts` from `plan.ts`. Restore’s `rejectPending` stays in the HTTP handler, same as undo.

## What We're NOT Doing

- 409 on PUT units for hard bounds; any edit to FU-002 (leave the item as-is).
- New hosted SQL / `plan_revisions` columns / new tables. Worker `db push`. New DEP.
- Discarding later snapshots on restore (linear undo-from-middle). That alternative is FU-020.
- Removing the Undo button (folding recovery into the picker only). That alternative is FU-021.
- Empty-day create/delete, logging changes, LLM, Admin, landing copy.
- Playwright / jsdom / visual regression. New shadcn packages.
- Adding `/api/*` to `PROTECTED_ROUTES`. Touching `context/foundation/roadmap.md`. Closing unrelated FU/DEP items. Using FU-018 / FU-019.

## Implementation Approach

Extract a shared “snapshot current week if it differs from the incoming week, then persist, never clear” helper for generate, accept, and restore. Keep `undoWeek` as pop-latest. Add `listRevisions` + `restoreWeek`. Extend `GET /api/plan` with `{ id, createdAt }[]`. Add `POST /api/plan/restore`. Wire a native `<select>` picker next to Undo. Close FU-001 when that ships.

## Critical Implementation Details

**Snapshot is the replace prelude, not the aftermath.** On generate and accept: if `weeksEqual(current, next)` skip snapshot (same as edit no-op); otherwise `insertRevision(current)` + `trimRevisions` **then** `replaceWeek(next)`. Failed `generatePlan` / hard-bound Accept: no snapshot, no replace. Swallow missing-table errors around snapshot the same way `editUnit` does — persist still succeeds.

**Restore is checkout, not reset.** `restoreWeek` loads the row by `id` + `user_id` + `week_start`. It snapshots the live week (if different), `replaceWeek`s the stored units, and does **not** delete the chosen row or any later rows. Cap 10 still trims oldest after the new snapshot. Undo remains pop-latest (`delete` that row after apply).

**Do not call `clearRevisions` from generate or accept.** Remove those call sites. Delete the export if nothing else uses it.

**`replaceWeek` must replace the window.** After upserting incoming units, delete `training_units` rows for that `user_id` whose `date` is in `weekDates(weekStart)` and not in the incoming set. Generate/accept/undo/restore then actually restore an empty pre-generate week. Do not delete dates outside the week window.

---

## Phase 1: Snapshot on generate and accept

### Overview

Generate and Accept stop wiping history. A successful week replace snapshots the pre-replace week so Undo (and later the picker) can return to it.

### Changes Required:

#### 1. Shared snapshot helper and true week replace

**File**: `src/lib/services/plan.ts`

**Intent**: One path for “snapshot current week then persist next”, used by generate, accept, and (in Phase 2) restore. Undo/restore of an empty week must actually clear generated days.

**Contract**: Helper takes the already-loaded current units and the next week. Skip insert when `weeksEqual`. On insert, `trimRevisions` to cap 10. Try/catch so a missing `plan_revisions` table does not fail the persist. `generateAndPersist` calls it instead of `clearRevisions` after a successful `generatePlan`. Do not snapshot when generate returns `ok: false`. `replaceWeek` upserts incoming rows, then deletes in-window dates that are not in `units` (same `weekDates` window it already filters on).

#### 2. Accept snapshots instead of clearing

**File**: `src/lib/services/chat.ts`

**Intent**: Accept is a plan-replacing op; recovery must survive it the same way as generate.

**Contract**: After hard-bound gate passes, snapshot `current` then `replaceWeek(proposedUnits)`. Do not `clearRevisions`. Do not snapshot when Accept returns `HARD_BOUNDS` / missing pending / missing weeklyKm. Keep `plan.ts` free of `chat.ts` imports. Export the helper from `plan.ts` so `acceptProposition` can call it (name is the implementer’s).

#### 3. Generate HTTP reports the stack

**File**: `src/pages/api/plan.ts`

**Intent**: The client must not assume generate killed undo.

**Contract**: Successful `POST /api/plan` returns the real `undoAvailable` (`hasRevision` after persist), not hardcoded `false`. Missing revisions table → `undoAvailable: false` (existing GET catch).

#### 4. Memory harness for generate tests

**File**: `src/lib/test/memory-supabase.ts`

**Intent**: `generateAndPersist` needs `races` and undo/restore tests need `.limit()`.

**Contract**: Add `races` to `MEMORY_TABLES` / empty store / seed. Add `.limit(n)` that truncates the ordered result. Update `memory-supabase.test.ts` (“five persist tables” → include `races`).

#### 5. Tests

**File**: `src/lib/services/plan.test.ts` (or a sibling `plan-revisions.test.ts` if that file would get too large)

**Intent**: Pin that generate snapshots and does not clear; undo of that snapshot returns the pre-generate week.

**Contract**: Vitest + `createMemorySupabase`. Seed profile + A-race + a distinctive current week. After `generateAndPersist`, `plan_revisions` has that week; live `training_units` are the generated week; `undoWeek` restores the distinctive week. A second generate still leaves a snapshot (stack not empty). Failed generate (`MISSING_WEEKLY_KM` / no A race) inserts no revision and does not replace. Extra case: current week empty → generate → undo → `listWeek` is empty (proves `replaceWeek` deletes leftover dates).

**File**: `src/lib/services/accept-proposition.test.ts`

**Intent**: Soft-band Accept snapshots the pre-accept week and does not clear.

**Contract**: After a successful Accept, a revision exists whose units equal the pre-accept week; live units equal the proposed week. Hard-bound Accept inserts no revision and leaves `training_units` unchanged (existing persist-skip tests stay).

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including new generate-snapshot and accept-snapshot cases
- `npm run lint` passes
- `generateAndPersist` and `acceptProposition` do not call `clearRevisions` (source inspection)
- Failed generate / hard-bound Accept insert no `plan_revisions` row (test)

---

## Phase 2: List and restore API

### Overview

The week’s revision list is a first-class JSON field. Restoring a chosen snapshot lands that week without discarding later snapshots. Undo stays pop-latest.

### Changes Required:

#### 1. Types

**File**: `src/types.ts`

**Intent**: Shared DTO for picker rows (id + timestamp only; no units on the list payload).

**Contract**: e.g. `PlanRevisionSummary { id: string; createdAt: string }` (ISO). Do not add a label column.

#### 2. listRevisions and restoreWeek

**File**: `src/lib/services/plan.ts`

**Intent**: Read the week’s stack; restore a specific snapshot as checkout, not reset.

**Contract**:

- `listRevisions(client, userId, weekStart)` → summaries newest-first, filtered by `user_id` + `week_start`, cap-aware (whatever is stored, already trimmed).
- `restoreWeek(client, userId, weekStart, revisionId)`: load by id + user + monday; 404-shaped error if missing / wrong week; snapshot live week if different; `replaceWeek` stored units; **do not delete** the chosen row or later rows; return `{ units, undoAvailable, revisions }`.
- `undoWeek` unchanged: pop latest only.
- `hasRevision` can stay as `list.length > 0` or existing count query.

#### 3. GET /api/plan and mutating responses

**File**: `src/pages/api/plan.ts`

**Intent**: Week load includes picker rows. Generate response includes them too.

**Contract**: GET success body adds `revisions: PlanRevisionSummary[]` (empty array on revisions-table miss, same catch as `undoAvailable`). POST generate includes `revisions` + real `undoAvailable`.

**File**: `src/pages/api/plan/units.ts`, `src/pages/api/plan/undo.ts`, `src/pages/api/chat/accept.ts`

**Intent**: After edit / undo / accept, the picker can refresh without a second GET.

**Contract**: Successful PUT units, POST undo, and POST accept include `revisions` and `undoAvailable` when the stack is readable. Undo already returns `undoAvailable`; add `revisions`. Accept currently omits both — the **handler** may `listRevisions` / `hasRevision` after `acceptProposition` succeeds; do not invent a `chat.ts` → extra plan import cycle beyond the existing `plan.ts` imports. PUT already has `undoAvailable` — add `revisions`.

#### 4. POST /api/plan/restore

**File**: `src/pages/api/plan/restore.ts` (new)

**Intent**: Authz JSON restore of one snapshot.

**Contract**: `export const prerender = false`. Zod body `{ weekStart?: string, revisionId: uuid }`. `unauthorized()` when logged out. 400 on bad body. 404 `NOT_FOUND` when the id is not this user’s this week. On success: `rejectPending` in the handler (not in `plan.ts`), same try/catch as undo; `jsonOk({ weekStart, units, undoAvailable, revisions })`. Do not add this path to `PROTECTED_ROUTES`.

#### 5. Dashboard SSR

**File**: `src/pages/dashboard.astro`

**Intent**: First paint has picker rows, not only a boolean.

**Contract**: Load `listRevisions` (empty on error). Pass `revisions` into `PlanWorkspace` (Phase 3 consumes them). Keep `undoAvailable` as `revisions.length > 0` or `hasRevision`.

#### 6. Tests

**File**: `src/lib/services/plan.test.ts` / `plan-revisions.test.ts`

**Intent**: Restore checkout semantics, ownership, cap, undo still pops.

**Contract**:

- Restore a non-latest revision → live units match that snapshot; later revision rows still exist; a new snapshot of the pre-restore live week exists (unless weeksEqual).
- Restore of another user’s id or another `week_start` → not found; target week unchanged.
- Undo after generate still pops latest and restores pre-generate.
- Cap 10: an 11th snapshot trims the oldest.
- B cannot list or restore A’s revisions (`ownership.test.ts` or sibling).

**File**: `src/pages/api/product-gates.test.ts`

**Intent**: Restore is a gated JSON route.

**Contract**: Add `POST /api/plan/restore` to `GATES`. Logged-out → 401 JSON, no `Location`, no `units`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including restore-keeps-later, ownership, cap, and product-gates for restore
- `npm run lint` passes
- `PROTECTED_ROUTES` does not include `/api/plan/restore` (source inspection)
- PUT units still persist when `validatePlan.hard.length > 0` (existing edit path unchanged; no 409 added)

---

## Phase 3: Picker UX and FU-001 close

### Overview

The calendar shows the week’s history and can restore a chosen snapshot. Undo last remains. FU-001 is marked done. FU-002 is not edited.

### Changes Required:

#### 1. Calendar picker

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Version restore is visible next to Undo, using existing Button / native form controls.

**Contract**: Props: `revisions: { id, createdAt }[]` and `onRestore(revisionId: string)`. Native `<select>` (same field styling as type editor via `cn()`). Options labeled from `createdAt` (locale time or ISO — no DB label). Disabled when `busy` or `revisions.length === 0`. Keep “Undo last edit” gated on `undoAvailable`. No new shadcn. No CSS-selector tests.

#### 2. Workspace wiring

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Keep picker and undo in sync after load / generate / edit / undo / restore / accept.

**Contract**: State for `revisions`. Parse `revisions` from GET plan, POST generate, PUT units, POST undo, POST restore, POST accept. Stop forcing `setUndoAvailable(false)` on accept (and do not ignore generate’s real flag). Restore: `POST /api/plan/restore` with `{ weekStart, revisionId }`; apply units + stack fields; clear pending proposition on success (same as undo). Week navigation via existing `loadWeek` already hits GET.

#### 3. Close FU-001

**File**: `context/backlog.md`

**Intent**: This change is the FU-001 next step; mark it done when picker + generate-restore ship.

**Contract**: FU-001 `Status: done`, checkbox ticked, moved to `## Done`, `Done: 2026-08-31`, note that generate/accept snapshot and the picker shipped in `calendar-version-restore`. **Do not edit FU-002 at all** (not even Notes). Do not touch FU-018/019. Do not close unrelated FUs.

### Success Criteria:

#### Automated Verification:

- `npm test` passes
- `npm run lint` passes
- FU-001 is `Status: done` under `## Done`; FU-002 body is byte-identical to before this change (diff)

#### Manual Verification:

- On a running dashboard: generate a week, confirm the picker lists a snapshot, restore it, and see the pre-generate week; Undo last still pops the latest snapshot

---

## Testing Strategy

### Unit Tests:

- Generate snapshots distinctive pre-week; undo returns it; stack not cleared on a second generate
- Failed generate / hard Accept: no revision row
- Restore non-latest keeps later rows and snapshots current
- Restore wrong user / wrong week: not found
- Cap 10 trims oldest
- Logged-out POST restore → 401 JSON

### Integration Tests:

- Two-user: B restore/list does not read or mutate A’s `plan_revisions` or `training_units`

### Manual Testing Steps:

1. Sign in, generate a week, note a distinctive day, generate again, restore the older snapshot from the picker.
2. Confirm Undo last still reverts the most recent snapshot.
3. Accept a chat proposition and confirm history is still listed (not wiped).

## Performance Considerations

At most 10 jsonb week snapshots per member per week. List payload is id + timestamp only. No extra round-trip if mutating endpoints return `revisions`.

## Migration Notes

No new SQL. Existing `plan_revisions` (DEP-012 already applied) is sufficient. Worker rollback does not drop that table. If the table is missing locally, snapshot/list/restore fail open (empty history) the same way undo already does.

## References

- FU-001: `context/backlog.md`
- S-04 brief: `context/archive/2026-08-14-calendar-manual-edit/plan-brief.md` (Recovery UX was stack + Undo; Generate/Accept cleared)
- PRD FR-005; roadmap S-04 notes (version picker still FU-001)
- `src/lib/services/plan.ts`, `src/lib/services/chat.ts`, `src/components/plan/PlanCalendar.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Snapshot on generate and accept

#### Automated

- [x] 1.1 `npm test` passes, including new generate-snapshot and accept-snapshot cases — b67badc
- [x] 1.2 `npm run lint` passes — b67badc
- [x] 1.3 `generateAndPersist` and `acceptProposition` do not call `clearRevisions` (source inspection) — b67badc
- [x] 1.4 Failed generate / hard-bound Accept insert no `plan_revisions` row (test) — b67badc

### Phase 2: List and restore API

#### Automated

- [x] 2.1 `npm test` passes, including restore-keeps-later, ownership, cap, and product-gates for restore — d8cda01
- [x] 2.2 `npm run lint` passes — d8cda01
- [x] 2.3 `PROTECTED_ROUTES` does not include `/api/plan/restore` (source inspection) — d8cda01
- [x] 2.4 PUT units still persist when `validatePlan.hard.length > 0` (existing edit path unchanged; no 409 added) — d8cda01

### Phase 3: Picker UX and FU-001 close

#### Automated

- [x] 3.1 `npm test` passes — 615188c
- [x] 3.2 `npm run lint` passes — 615188c
- [x] 3.3 FU-001 is `Status: done` under `## Done`; FU-002 body is byte-identical to before this change (diff) — 615188c

#### Manual

- [ ] 3.4 On a running dashboard: generate a week, confirm the picker lists a snapshot, restore it, and see the pre-generate week; Undo last still pops the latest snapshot
