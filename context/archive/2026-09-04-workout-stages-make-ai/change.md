---
change_id: workout-stages-make-ai
title: Explicit workout stage kinds plus Make AI from the description
status: archived
created: 2026-09-04
updated: 2026-09-04
archived_at: 2026-09-04T22:35:22Z
---

## Notes

Files: `src/types.ts`, `src/components/plan/PlanCalendar.tsx`, `src/components/plan/WorkoutStagesChart.tsx`, `src/components/plan/workout-stages.ts`, unit write schema (`src/lib/services/plan.ts`, maybe `src/pages/api/plan/units.ts`), `src/pages/api/plan/stages-from-description.ts` (new), `src/lib/services/` LLM JSON parse (zod). No calendar write from the Make AI endpoint. Migration `20260904121000_unit_stages.sql`.
Depends on: none.

### Sequencing

Not in parallel with `chat-delete-units`, `iso-week-bleed-volume`, `calendar-mobile-chrome`, `load-chart-tabs` (`PlanCalendar.tsx`). If `calendar-mobile-chrome` lands first, it leaves a comment slot beside Structure; this change adds the **Make AI** button. If this change lands first, compact day-edit must keep that button.

### Option

(a) persist `training_units.stages jsonb` `{kind, label, duration, target}` + kind select in the editor + `POST /api/plan/stages-from-description` (LLM returns JSON stages, no calendar mutation, no coach Send).
This change ships S-05.* and S-06.* together. The S-05 seed line “Do not … ship Make AI in this change” is superseded. S-06.5 fallback (fill derived `structure` only if stages persist is not shipped) is unused once S-05.4 writes `stages`.
Do not ship (5b) parser prefixes `S1:` in `structure`. Do not ship (6b) hidden coach Send.

### Today

Day-panel Edit has a free-text Structure field. Chart calls `parseWorkoutStages`, which infers `kind` from regex on that string (`warmup`/`WU`, `cool-down`/`CD`, tempo…). `training_units` has `structure text` only. No `stages` jsonb. Empty structure → one work bar. There is no `/api/plan/stages-from-description`. Coach Send would mutate via propose/Accept and pollute the thread.

### Requirements

- [ ] S-05.1 Each stage has an explicit `kind` (`warmup` | `work` | `recovery` | `cooldown`) chosen in the editor, not inferred from label or Structure prose.
- [ ] S-05.2 The day panel lists labeled segments **Seg 1**, **Seg 2**, … each with a kind select (and duration, label, target).
- [ ] S-05.3 `WorkoutStagesChart` colors bars from the stage `kind` field. Changing kind recolors that segment without requiring WU/CD/tempo in the sentence.
- [ ] S-05.4 Persist JSON `stages` `{kind, label, duration, target}` on `training_units`. Keep `structure` as a derived one-liner for cells. Migration `20260904121000_unit_stages.sql` adds `stages jsonb`; existing owner RLS covers the new column. Decision-pack screen was mocked — do the real column and write path.
- [ ] S-05.5 Stop using regex-on-structure as the source of truth for kind once `stages` exist. Optional fallback only for legacy rows that have structure and null stages.
- [ ] S-06.1 In day-edit, keep the Structure text field and put a **Make AI** button next to it (accessible name `Make AI`).
- [ ] S-06.2 On click, call `POST /api/plan/stages-from-description` with the Structure text; return JSON stages `{kind, label, duration, target}` — do not upsert units, do not POST `/api/chat/messages`.
- [ ] S-06.3 Apply the returned stages into the day-edit stages UI so the description `2km WU, 5km 4:20, 2km CD` becomes three segments: warmup 2 km, work 5 km @ 4:20, cooldown 2 km.
- [ ] S-06.4 Do not implement option (b) hidden coach Send unless chosen — it pollutes the thread and hits Accept/auto-apply.
- [ ] S-06.5 This change fills stages that `workout-stage-kinds` owns. If that change is not shipped, still fill a derived `structure` one-liner from the same description so the field and chart update.

### Do not

Infer kind from “easy jog”; add a chart npm lib; persist calendar mutations from Make AI; call the LLM from the client; POST from a mock.

### Supabase

Migration `20260904121000_unit_stages.sql` adds `stages jsonb` on `training_units`; existing owner RLS covers the new column; do not add RLS. Decision-pack screens were mocked (local stages, no POST, no Completions) — implement the real column and write path, not a stub.

### Visible

Day panel under the grid shows Seg 1/2/3 with kind selects; bar colors follow kind, not the sentence. Structure stays filled; Make AI is next to it; three matching stages appear below without a new chat bubble.
