---
date: 2026-09-04T16:05:00+02:00
researcher: wave-audit
git_commit: 760e00179b4676413204b47e76f7a7b25770bdd0
branch: master
repository: hard-feelings
topic: "workout-stages-make-ai: files named in Notes"
tags: [research, wave-audit]
status: complete
last_updated: 2026-09-04
last_updated_by: wave-audit
---

# Research: workout-stages-make-ai

## Research Question
What exists at HEAD for the files listed in Notes?

## Summary

- `TrainingUnit` has optional `structure?: string` only (`src/types.ts:9-15`). `training_units.structure text`; no `stages` jsonb (`supabase/migrations/20260813130000_training_units.sql:4-17`). `UNIT_COLUMNS` / `unitEditSchema` are date, type, distance_km, structure, frozen (`src/lib/services/plan.ts:25`, `:49-54`).
- `WorkoutStage` is `{ kind, label, weight }` — not `{ kind, label, duration, target }` (`src/components/plan/workout-stages.ts:3-8`). `parseWorkoutStages` infers kind via regex (`WARMUP`/`COOLDOWN`/`RECOVERY`/`WORK_HINT`, `:25-28`, `:66-79`). Empty/blank structure → one `work` fallback (`:87-91`, `:118-120`).
- `WorkoutStagesChart` colors from parsed `kind` (work bar also depends on workout `type`) (`src/components/plan/WorkoutStagesChart.tsx:6-18`, `:33-41`). Day-edit is a single Structure `<input>` (`src/components/plan/PlanCalendar.tsx:321-331`); chart is in the read-only panel (`:354`).
- `src/pages/api/plan/stages-from-description.ts` does not exist. No “Make AI” string in `PlanCalendar.tsx`. LLM JSON parse for stages is not a dedicated service; chat uses `parsedProposeSchema` in `openai-chat.ts`.
- Persist of structure is `PUT /api/plan/units` (`src/pages/api/plan/units.ts:35-42`).

## Code References

- `src/types.ts:9-15` - TrainingUnit
- `supabase/migrations/20260813130000_training_units.sql:4-36` - columns + owner RLS including delete_own
- `src/lib/services/plan.ts:25` - UNIT_COLUMNS
- `src/lib/services/plan.ts:49-54` - unitEditSchema
- `src/components/plan/workout-stages.ts:3-8` - WorkoutStage fields
- `src/components/plan/workout-stages.ts:66-122` - clauseKind + parseWorkoutStages
- `src/components/plan/WorkoutStagesChart.tsx:24-48` - parse then color by kind
- `src/components/plan/PlanCalendar.tsx:321-331` - Structure field
- `src/components/plan/PlanCalendar.tsx:354` - WorkoutStagesChart in read-only panel
- `src/components/plan/workout-stages.test.ts:4-32` - parser tests including blank → one work stage
- `src/components/plan/WorkoutStagesChart.test.ts` - stage colors + `aria-label="Workout stages"`
- `src/components/plan/PlanCalendar.test.ts:128-132` - source-scan chart from unit.structure

## Architecture Insights

Kind is derived at render time from prose, not stored. The in-memory stage model uses `weight` for bar width, not duration/target. Make AI as a non-mutating POST would be a new route next to `units.ts`; chat `completeOpenAiPropose` is the existing Completions+zod JSON pattern (`src/lib/services/openai-chat.ts:180-205`).

## Open Questions

- Test harness / migrate path for `training_units.stages jsonb`: filename list (`migration-safety.test.ts:12-24`), ADD COLUMN vs after===before oracle, memory-supabase row shape.
- How `duration` / `target` map onto existing `weight` (parser tests assert km/min weights).
- Whether edit-mode should render Seg 1… while Structure remains a derived one-liner — DayPanel currently shows chart only when not editing (`PlanCalendar.tsx:351-369` vs `:282-350`).
- LLM JSON helper location (`src/lib/services/` vs inline in the new route); Completions env (`OPENAI_API_KEY`) not traced for a second caller.
- `calendar-mobile-chrome` also edits DayPanel Structure chrome — merge order.
