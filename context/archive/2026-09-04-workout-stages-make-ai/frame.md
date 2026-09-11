# Frame Brief: Explicit workout stage kinds plus Make AI from the description

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Accepted Notes (Gate 1, options 5a+6a together): day-edit Structure is free text; the stages chart infers `kind` from regex on that string; `training_units` has `structure text` only. There is no `stages` jsonb, no Seg 1… kind selects, and no `POST /api/plan/stages-from-description`. Make AI must return JSON stages without upserting units or posting chat. S-05.* and S-06.* ship in this change; do not ship parser prefixes in `structure` or hidden coach Send.

## Initial Framing (preserved)

- **User's stated cause or approach**: Kind must be an explicit field on persisted stages; Make AI is a dedicated JSON endpoint beside Structure, not a coach Send.
- **User's proposed direction**: Persist `training_units.stages jsonb` `{kind, label, duration, target}`, editor kind select, chart colors from `kind`, derived `structure` one-liner, new POST that fills the editor.
- **Pre-dispatch narrowing**: Wave-audit bundle (P-05 + P-06). Not separated in a live interview.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Stored model vs derived parse** — HEAD `WorkoutStage` is `{kind, label, weight}` computed by `parseWorkoutStages`; Notes store `{kind, label, duration, target}`. ← initial framing (persist kinds)
2. **Editor surface** — Structure `<input>` vs Seg 1… rows; chart only in read-only panel today.
3. **LLM transport** — new POST vs reuse chat Completions; Notes forbid calendar mutation and `/api/chat/messages`.
4. **Legacy rows** — regex fallback only when `stages` is null.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Kind is inferred at render, not stored | `workout-stages.ts:66-79`, `WorkoutStagesChart.tsx:33` | STRONG |
| Stage payload shape in Notes ≠ HEAD type | Notes `{duration, target}` vs `WorkoutStage.weight` (`workout-stages.ts:5-8`) | STRONG |
| Make AI route absent | no `src/pages/api/plan/stages-from-description.ts` | STRONG |
| Hidden coach Send would hit Accept/auto-apply | `sendMessage` → `applyMutations` + persist (`chat.ts:338-361`) | STRONG |
| Chart already uses kind for color | `WorkoutStagesChart.tsx:6-18` | STRONG (framing holds) |

## Narrowing Signals

- Gate 1 chose (a) for both P-05 and P-06; S-05 seed line forbidding Make AI in the same change is superseded in Notes.
- S-06.5 fallback (structure-only if stages persist is not shipped) is unused once S-05.4 writes `stages`.

## Cross-System Convention

JSON columns on `training_units` would be new; existing persist is `structure text` via `unitEditSchema`. LLM JSON+zod already exists for propose (`openai-chat.ts` `parsedProposeSchema`), not for stages.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: persist an explicit stage list (including kind) as the source of truth for the editor and chart, and fill that list from Structure via a non-mutating LLM POST — without treating HEAD’s `{weight}` parser as the stored schema.

The initial framing holds on “explicit kind + no chat Send.” Plan must reconcile Notes `{duration, target}` with HEAD `{weight}` used for bar width, and extend `UNIT_COLUMNS` / `unitEditSchema` / RLS-covered ADD COLUMN. Confidence stays MEDIUM because of that schema mapping and the migration harness.

## Confidence

- **MEDIUM** — evidence points one way but convention or signal weaker

Bundle of two P-NN; `duration`/`target` vs `weight` unchecked in a migration; harness `migrateOverFixture` + hardcoded filename list not executed in this audit.

## What Changes for /10x-plan

Plan the jsonb column + editor + chart-from-kind + POST `/api/plan/stages-from-description`. Do not plan option 5b/6b. Ask one verification question on duration/target vs weight. Do not re-explore files already listed in `research.md` unless `git_commit` is behind HEAD.

## References

- Source files: `src/components/plan/workout-stages.ts:3-122`, `src/components/plan/PlanCalendar.tsx:321-354`, `src/lib/services/plan.ts:25`, `:49-54`
- Related research: `context/changes/workout-stages-make-ai/research.md`
- Investigation tasks: wave-audit HEAD read (calendar + schema surfaces)
