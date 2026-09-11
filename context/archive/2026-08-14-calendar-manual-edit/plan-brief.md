# Calendar Manual Edit — Plan Brief

> Full plan: `context/changes/calendar-manual-edit/plan.md`

## What & Why

FR-005 requires viewing the plan **and** manually editing a workout with undo or version restore — S-02 shipped view/freeze/generate only. Without edit+undo, a bad type/km change (or chat Accept overwrite) has no recovery, which is the plan-chaos case Socrates already closed.

## Starting Point

`training_units` is one row per member per date. Calendar shows type/km and Freeze. Chat Accept/`replaceWeek` overwrites the week with no unit history. `applyMutations` patches existing dates and keeps `frozen`. `PATCH /api/plan/units` is freeze-only.

## Desired End State

The member edits a filled day’s type, km, and optional structure, sees validator warnings (including hard, non-blocking), and can Undo last edit for that week. Generate and chat Accept reset the undo stack. Empty days stay generate/chat territory.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Edit existing units only (type, km, structure); no create/delete/move | `applyMutations` already skips unknown dates; UNIQUE `(user_id, date)` is one unit per day | Plan |
| Recovery UX | Week snapshot stack + “Undo last edit”, not a version picker | PRD allows undo **or** restore; a stack meets chaos-recovery without a history UI | Unattended |
| Hard bounds | Persist the edit; return `validatePlan` soft+hard as warnings; never 409 | PRD non-acceptable hard bounds target AI accept; member dictation + undo is the recovery | Unattended |
| Frozen days | Keep `frozen`; new type/km become the anchor; `frozenUnits` from the updated week | Freeze remains the existing PATCH; passing old anchors would false-positive `FROZEN_ANCHOR_DROPPED` | Plan |
| Pending chat | Reject pending on successful edit and undo | Same stale-snapshot rule as `sendMessage` → `rejectPending` | Plan |
| Generate / Accept | Clear the week’s revision stack | Undo means “undo my last calendar edit”, not revert a generate | Unattended |
| Editable fields | Not date, not frozen via PUT | Date would break the unique key; freeze already has PATCH | Plan |
| UI | Inline cell editor; native select; no new shadcn Dialog | Matches `SetupForm`; only `Button` is installed | Plan |
| No-op save | Do not snapshot or reject pending | Avoids burning the stack and killing a proposition for a no-change Save | Plan |
| Tests | Vitest on `applyUnitEdit` + schema; no Playwright / DB mocks | Matches S-02/S-03; GHA has no Supabase | Plan |

## Scope

**In scope:** `plan_revisions` + RLS + DEP-012; `applyUnitEdit`; PUT unit + POST undo; GET `undoAvailable`; clear stack on generate/accept; reject pending on real edit/undo; dashboard inline edit + Undo.

**Out of scope:** Version picker; empty-day create; S-05 logging; S-07 LLM; blocking saves on hard bounds; new shadcn packages; hosted `db push`; closing DEP-001–DEP-011.

## Architecture / Approach

PUT → `applyUnitEdit` → snapshot current week JSON → UPDATE one `training_units` row → `validatePlan` (display) → `rejectPending`. POST undo pops latest jsonb through `replaceWeek`. `plan.ts` owns revisions; routes call exported `rejectPending` so `plan.ts` never imports `chat.ts`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema and RLS | `plan_revisions` + DEP-012 | Hosted DB never gets the SQL |
| 2. Pure edit helper | `applyUnitEdit` + zod | Frozen flag accidentally cleared |
| 3. Persist and HTTP | PUT/undo/GET + clear on generate/accept | `plan.ts` ↔ `chat.ts` cycle; snake_case jsonb |
| 4. Calendar UX | Inline edit + Undo | Hard warnings look like a block; empty-day create creep |

**Prerequisites:** S-02 `training_units` + calendar (on disk, impl_reviewed). S-03 chat optional but present — reject-pending hooks into it.
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- Production undo/edit writes fail until DEP-012; Worker rollback does not drop `plan_revisions`.
- Undo restores a **week** snapshot, so it can also revert freeze flags captured in that snapshot.
- If `weeklyKm` is missing or `<= 0`, skip `validatePlan` and return empty validation (edit still persists).

## Success Criteria (Summary)

- Member can change a filled day’s type/km and reload sees it.
- Undo restores the previous week; generate clears Undo.
- Hard validator output never prevents a manual save; chat Accept still 409s on hard bounds.
