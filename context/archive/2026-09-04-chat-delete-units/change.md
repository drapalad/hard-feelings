---
change_id: chat-delete-units
title: Coach and day panel can delete a calendar workout
status: archived
created: 2026-09-04
updated: 2026-09-04
archived_at: 2026-09-04T22:35:23Z
---

## Notes

Files: `src/types.ts`, `src/lib/services/openai-chat.ts` (`parsedProposeSchema` / `PROPOSE_JSON_SCHEMA` / system prompt), `src/lib/services/plan-adaptation.ts` (`applyMutations`), `src/lib/services/chat.ts` (`persistProposedUnits` / `incomingForWeek`), `src/lib/services/plan.ts` (`replaceWeek` leftover DELETE), `src/components/plan/PlanCalendar.tsx` (day-panel). Tests: `plan-adaptation.test.ts`, `propose-adaptation.test.ts`, chat persist tests. No new table; reuse `training_units` DELETE + `training_units_delete_own`.
Depends on: none.

### Sequencing

Not in parallel with `iso-week-bleed-volume`, `workout-stages-make-ai`, `calendar-mobile-chrome`, `load-chart-tabs` (`PlanCalendar.tsx`). Not in parallel with other `openai-chat.ts` / `chat.ts` changes: `user-coach-notes`, `admin-coach-notes`, `coach-races-context-accept`, `flag-admin-technical`.

### Option

(a) `delete: true` in propose schema + `applyMutations` removes the date + persist DELETE + day-panel **Delete workout**.
Do not ship (b) type recovery / 0 km.

### Today

`UnitMutation` has date, optional type/distanceKm/structure — no delete. `applyMutations` only upserts/creates (`byDate.set`); it never removes a date. Propose JSON allows nullable type/km but null means “leave existing”. Prompt: “Never emit a full replacement week.” `replaceWeek` already DELETEs ISO-week dates missing from the incoming list; chat `incomingForWeek` still copies existing units outside the create horizon, so omitting a date does not persist a removal. Day panel has Edit / Freeze / Log, no Delete.

### Requirements

- [ ] S-03.1 Extend propose JSON and `UnitMutation` with `delete: true` (preferred) or an explicit remove sentinel — not “type and km both null” unless you document that as delete and stop treating null as keep-existing.
- [ ] S-03.2 `applyMutations`: when delete is set, drop that date from the plan map (skip frozen). Do not upsert recovery/0 km.
- [ ] S-03.3 Persist must DELETE the `training_units` row for that user+date (leftover path in `replaceWeek` is fine). `incomingForWeek` must not re-insert a deleted date from existing rows, including dates outside the create horizon.
- [ ] S-03.4 Day-panel **Delete workout** on a unit (not Rest) uses the same delete persist; do not POST from a mock.
- [ ] S-03.5 Prompt: allow a delete mutation for one date; keep “do not emit a full replacement week.”
- [ ] S-03.6 Option (a) is schema + apply + persist DELETE + day-panel. Do not ship (b) 0 km recovery unless chosen.

### Do not

Add a `rest` workout type; delete logs automatically; change freeze/generate.

### Supabase

No new table. Reuse `training_units` DELETE and `training_units_delete_own`. Decision-pack calendar was mocked (filtered one date out of client state, no write) — implement real schema delete + persist, not a stub cell.

### Visible

An in-month cell that had a workout is empty (Rest / no type/km), not a 0 km recovery.
