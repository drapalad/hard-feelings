# Explicit workout stage kinds plus Make AI — Plan Brief

> Full plan: `context/changes/workout-stages-make-ai/plan.md`
> Research: `context/changes/workout-stages-make-ai/research.md`

## What & Why

Day-edit Structure is free text; the stage chart infers `kind` with regex, so colors lie when the sentence has no WU/CD/tempo. Persist explicit `{kind, label, duration, target}` on `training_units.stages` and add **Make AI** beside Structure to fill those segments from the description without a coach Send.

## Starting Point

`training_units` has `structure text` only. `parseWorkoutStages` regex-infers kind. Chart lives in the read-only panel. PUT `/api/plan/units` writes structure. Completions+zod exists only on chat propose. A comment slot beside Structure is reserved for this button.

## Desired End State

Edit a day: Seg 1/2/3 with kind selects; bars follow `kind`; Structure stays; Make AI next to it. `2km WU, 5km 4:20, 2km CD` becomes three stages in the editor with no chat bubble. Save persists jsonb + a derived structure one-liner. Legacy null-stages rows still parse structure for the chart.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Persist shape | jsonb array of `{kind, label, duration, target}` strings; chart `weight` derived from duration | Notes lock the JSON fields; existing clause-weight maps km/min onto bars | Plan |
| Make AI vs Save | POST returns JSON only; persist on existing PUT Save; derive `structure` when stages nonempty | S-06.2 forbids calendar write from Make AI; S-05.4 owns the column | Plan |
| Regex vs stages | Non-empty `stages` is source of truth; regex only if stages null | S-05.1 / S-05.5; “easy jog” must not invent kind | Plan |
| Chat mutations | `applyMutations` preserves `stages` when omitted | Otherwise any chat/calendar patch wipes jsonb; chat schema stays untouched | Plan |
| Chart during edit | Mount chart in the edit form from editor stages | S-05.3: changing kind recolors without WU/CD in the sentence | Unattended |
| Empty editor | Seed from persisted `unit.stages` only; else empty list + Structure + Make AI/Add | Kind is chosen in the editor, not inferred from prose | Unattended |
| LLM failures | Trimmed structure required; no API key → 503; bad Completions JSON → 502; handler never opens Supabase | Make AI must not be able to upsert; 503 matches other missing-secret plan routes | Unattended |
| Tests / lint | Handler 401 + no-upsert mock; migration-safety filename list; PUT stages contract; touched-file eslint not repo `npm run lint` | Test-plan §6.4/§6.5; HEAD lint already red on unrelated files | Plan |

## Scope

**In scope:** migration `20260904121000_unit_stages.sql`; types; parser/chart; PUT write path; `POST /api/plan/stages-from-description`; Seg editor + Make AI; DEP-027 for hosted apply.

**Out of scope:** S1: prefixes; hidden coach Send; chart npm lib; client-side LLM; new RLS; hosted `db push`; chat propose schema / Flag sentinel / load-chart / generate chrome.

## Architecture / Approach

Editor state holds `UnitStage[]`. Chart colors from `kind`. Make AI → server Completions (zod) → fill state. Save → PUT `stages` + derived `structure`. Legacy rows: regex parse for display only.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Migration + helpers | `stages jsonb`, types, parse prefers JSON | Filename oracle / harness |
| 2. Persist write | UNIT_COLUMNS, PUT, applyMutations, revisions | Mutations dropping stages |
| 3. Make AI API | Non-mutating Completions POST | Accidental upsert or chat Send |
| 4. Day-edit UI | Seg list, Make AI slot, live recolor | Compact chrome regressions |

**Prerequisites:** none (HEAD already has the Make AI comment slot).
**Estimated effort:** ~4 phase commits in one unattended run.

## Open Risks & Assumptions

- Hosted column missing until DEP-027: production Save of stages will 500; Make AI still works (no DB write).
- Completions quality is not gated beyond the example fixture in tests.

## Success Criteria (Summary)

- Kind select, not regex, drives colors when stages exist
- Make AI fills three matching Segs without a chat bubble or unit upsert
- Reload after Save still shows those stages
