---
change_id: coach-races-context-accept
title: Coach sees all races and Accept-gates add or remove
status: archived
created: 2026-09-04
updated: 2026-09-04
archived_at: 2026-09-04T22:35:23Z
---

## Notes

Files: `src/lib/services/openai-chat.ts`, `src/lib/services/chat.ts`, `src/lib/services/races.ts` (reuse writes), `src/types.ts`, `src/components/plan/PlanChat.tsx`, `src/components/plan/PlanWorkspace.tsx`, `src/pages/api/chat/accept.ts`, `src/pages/api/chat/dismiss.ts`. Pending store: `races_patch jsonb` on existing `chat_profile_freeze_pending` (same Accept/Dismiss as profile/freeze). Do not add table `chat_race_pending`.
Depends on: none.

### Sequencing

Not in parallel with `user-coach-notes`, `admin-coach-notes`, `iso-week-bleed-volume`, `chat-delete-units`, `flag-admin-technical` (`openai-chat.ts` / `chat.ts`). Not in parallel with `chat-drop-pending-propositions` (`accept.ts` / `dismiss.ts` / pending store).

### Option

(a) first-pass race JSON + propose `races: { add, remove, patch }` + Accept-gated persist.
Do not ship (b). S-09.5 is the rejected skip — do not follow it; implement S-09.3 and S-09.4. Pending store is already picked above (`races_patch` on `chat_profile_freeze_pending`).

### Today

First-pass `systemPrompt` injects Profile JSON (`weeklyKm`, weekdays, mix — no races) and rolling `currentLoad`. `listRaces` runs only in `fetchCoachExtra` after `dataRequest`. Propose JSON has `mutations`, `log`, `dataRequest`, `profile`, `freeze`, `unfreeze` — no race add/remove. Profile/freeze already Accept-gate via `chat_profile_freeze_pending` and `/api/chat/accept`. Calendar km/type still auto-apply. Asking to save a distant race produced: the profile has no race/goal field.

### Requirements

- [ ] S-09.1 On every first-pass completion, load races with `listRaces` and inject compact JSON (all upcoming races plus A-priority with goals; not sliced to the chat week or `dataRequest` range). Fields: `id`, `date`, `priority`, `name`, `goal`.
- [ ] S-09.2 First-pass prompt must state races live on the `races` table, not on Profile; never reply that the profile has no race or goal field.
- [ ] S-09.3 (a) Extend propose JSON with optional `races: { add, remove, patch }` (`add`: date, priority, name?, goal?; `remove`: id; `patch`: id plus fields). Do not auto-apply race writes on Send. Persist pending (reuse `chat_profile_freeze_pending` or new `chat_race_pending` — pick one, name migration + RLS).
- [ ] S-09.4 (a) Review card lists the mutation (e.g. `Add race: Spring HM · 12 Apr 2027 · A`) with **Accept** and **Dismiss**, same pattern as profile/freeze. Accept calls existing `insertRace` / `updateRace` / `deleteRace` and `validateRaceList` (one A, unique date); then clears pending. Dismiss drops pending without writing `races`.
- [ ] S-09.5 (b) Skip S-09.3 and S-09.4; add/remove stay Profile UI and `/api/races`. First-pass context (S-09.1–S-09.2) still ships.

### Do not

Auto-apply race writes on Send; put races onto `Profile`; change SetupForm race editor; persist finish times; require Accept for km/type mutations. Do not implement S-09.5.

### Supabase

Extend `chat_profile_freeze_pending` with `races_patch jsonb`; existing own-row policies cover the column; do not add RLS. Name the migration in the plan (e.g. `20260904140000_chat_race_pending.sql` is unused — no new table). Fixture-only decision; implement on real tables, not a stub card.

### Visible

Distant-race ask yields an Accept card, not a “no field” refusal; first-pass cites upcoming/A races and does not claim the profile lacks a race field.
