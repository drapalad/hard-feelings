# Calendar Version Restore — Plan Brief

> Full plan: `context/changes/calendar-version-restore/plan.md`

## What & Why

FR-005 requires undo **or** version restore. S-04 shipped a snapshot stack plus one Undo, then **cleared** that stack on Generate and chat Accept — so a bad generate could not be restored. This change adds a week-history picker and treats generate/accept like any other plan-replacing op: snapshot first, never wipe.

## Starting Point

`plan_revisions` (cap 10, DEP-012 done) already stores camelCase week JSON. `editUnit` snapshots; `undoWeek` pops latest. `generateAndPersist` / `acceptProposition` call `clearRevisions`. UI is a single “Undo last edit” boolean.

## Desired End State

The member can pick a prior week snapshot (labels from `created_at`) and land it as live. Generate/Accept leave history intact; restoring the pre-generate snapshot returns that week. Undo last still pops the latest. FU-001 closed; FU-002 untouched.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Picker + snapshot on generate/accept; no FU-002 | Locked: restore must work through Generate; hard-bound 409 stays a later change | Unattended |
| Undo vs picker | Keep “Undo last edit” as pop-latest; picker is restore-by-id | Undo still maps to “undo the last mutating op”; picker is history, not a second undo | Unattended |
| Restore non-latest | Checkout: land that snapshot, **keep later rows** | Version restore is not linear undo-from-middle; later snapshots stay pickable | Unattended |
| Restore prelude | Snapshot live week first if it differs | Same prelude as generate/edit so the replaced live week is not lost | Plan |
| No-op snapshot | Skip insert when `weeksEqual(current, next)` | Matches edit no-op; avoids burning the cap 10 | Plan |
| Failed ops | No snapshot on failed generate or hard-bound Accept | Nothing was replaced, so there is nothing to recover | Plan |
| `replaceWeek` | Upsert incoming, then delete in-window dates not in the payload | Empty pre-generate snapshots cannot restore if leftover days stay | Unattended |
| API | `revisions` on GET `/api/plan` (and mutating responses); `POST /api/plan/restore` | Same additive GET as `logs` / `undoAvailable`; restore is a new write | Plan |
| Labels | Derive from `created_at`; no migration | Existing columns are enough; locked “no new hosted SQL” | Unattended |
| Tests | Vitest + memory-supabase; add `races` + `.limit()`; no Playwright | Cheapest layer that pins snapshot/restore/ownership | Plan |
| Pending chat | `rejectPending` on successful restore (handler, not `plan.ts`) | Same stale-proposition rule as undo | Plan |

## Scope

**In scope:** Snapshot-before-replace on generate/accept; list + restore API; native picker + keep Undo; close FU-001; harness `races` / `.limit()`.

**Out of scope:** FU-002 / 409 on PUT; new SQL; discard-later restore; removing Undo; Playwright; `/api` on `PROTECTED_ROUTES`; unrelated FU/DEP; FU-018/019.

## Architecture / Approach

`snapshotIfChanged` → `replaceWeek` for generate, accept, restore. `undoWeek` still pops. GET returns `{ id, createdAt }[]`. Restore looks up `id+user+week_start`, does not delete later rows. Calendar `<select>` + existing Undo button.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Snapshot on generate/accept | Stack survives replace; tests | Harness missing `races` / `.limit()` |
| 2. List + restore API | Checkout restore; 401/ownership | Accidental delete of later snapshots |
| 3. Picker UX + FU-001 | Native select; backlog close | Client still forcing `undoAvailable: false` on accept |

**Prerequisites:** S-04 `plan_revisions` on disk (archived). DEP-012 already applied.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- Missing local `plan_revisions` still fail-open (empty history), same as today’s undo.
- Undo after restore pops the snapshot of the *pre-restore* live week (because restore snapshots first) — that is intentional.
- `replaceWeek` gaining in-window deletes is the only way empty-week restore works; callers already pass a full week snapshot or a generated 7-day plan.
- FU-020 / FU-021 record the two defensible alternatives (discard-later; fold Undo into the picker).

## Success Criteria (Summary)

- Generate then restore (or Undo) returns the pre-generate week; Accept does not wipe history.
- Picker lists up to 10 timestamps; restoring a non-latest snapshot keeps later ones.
- FU-001 done; FU-002 unchanged.
