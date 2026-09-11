# Coach and day panel can delete a calendar workout — Plan Brief

> Full plan: `context/changes/chat-delete-units/plan.md`
> Research: `context/changes/chat-delete-units/research.md`

## What & Why

Coach chat and the day panel can only upsert or UPDATE a `training_units` row. Removing a workout today would require a fake 0 km recovery. This slice adds option (a) `delete: true` so one date is dropped from the plan map and the row is DELETEd — the cell reads Rest.

## Starting Point

`applyMutations` never `Map.delete`s. `incomingForWeek` re-seeds out-of-horizon dates. `replaceWeek` leftover DELETE already exists. The day panel has Edit / Log / Freeze, no Delete. `toRawProposeResult` would strip an uncopied `delete` flag on the live send path.

## Desired End State

A `delete: true` mutation (chat, skip frozen) or **Delete workout** (calendar, including frozen) removes that user+date row. Visible: empty Rest cell, not 0 km recovery. Null type/km still mean keep-existing. Logs stay. No `rest` type.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Schema flag | `delete: true` on propose JSON + `UnitMutation`; null type/km stay keep-existing | Locked option (a); null already means leave existing | Notes |
| applyMutations | `Map.delete` the date; skip frozen on chat; no recovery/0 km upsert | S-03.2; frozen skip already in `applyMutations` | Notes / Research |
| Persist deleted dates | Explicit list from `mutation.delete`, not “missing from proposed” | Inferring missing would leftover-DELETE keep-merge days | Unattended |
| mondaysToPersist | Union Mondays of deleted dates | Otherwise an out-of-horizon delete never reaches `replaceWeek` | Unattended |
| Day-panel HTTP | `DELETE /api/plan/units?date=` → `deleteUnit` → `replaceWeek` leftover | Same table/policy as chat; mirrors `DELETE /api/plan/logs` | Unattended |
| Frozen calendar delete | Allow (`skipFrozen: false`); chat still skips | FU-119: freeze blocks the coach, not day-panel Save | Unattended |
| Prompt | One-date delete allowed; keep “Never emit a full replacement week.” | S-03.5 | Notes |

## Scope

**In scope:** propose schema + sanitize/round-trip, `applyMutations` delete, chat persist leftover DELETE (in- and out-of-horizon), day-panel **Delete workout**, 401/contracts/source-scan tests.

**Out of scope:** option (b) 0 km recovery; `rest` type; auto-delete logs; freeze/generate changes; new table; Playwright.

## Architecture / Approach

LLM/calendar emit `{ date, delete: true }` → `applyMutations` drops the date → chat passes those dates into `incomingForWeek` / `mondaysToPersist` so `replaceWeek` leftover DELETEs the row. Day panel uses the same apply+replaceWeek via `DELETE /api/plan/units`. Client `mergeWeekSlice` drops the date; the cell is Rest.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Delete mutation contract | Schema, prompt, sanitize round-trip, `applyMutations` | `toRawProposeResult` strips `delete` |
| 2. Chat persist DELETE | Explicit deleted dates through persist | Out-of-horizon re-seed |
| 3. Day-panel Delete workout | DELETE route + **Delete workout** + merge | Mock-only UI / Rest still showing a unit |

**Prerequisites:** `training_units_delete_own` already on hosted (DEP-009). HEAD must keep bleed-Monday, compact day-edit, Make AI, stages-on-non-delete, load-chart tabs, Flag, coach notes.
**Estimated effort:** ~3 phases, one unattended implement pass.

## Open Risks & Assumptions

- Calendar Delete of a frozen unit is allowed (FU-144); reversing that is a later change.
- The stub proposer is not required to emit deletes; keyed LLM follows the prompt.
- Repo-wide `npm run lint` stays red on untouched files; gates use touched-file eslint.

## Success Criteria (Summary)

- Chat `delete: true` removes the row (including out-of-horizon); frozen chat deletes no-op
- Day-panel **Delete workout** persists the same DELETE; in-month cell is Rest, not 0 km
- Null type/km still keep-existing; no `rest` type; logs remain
