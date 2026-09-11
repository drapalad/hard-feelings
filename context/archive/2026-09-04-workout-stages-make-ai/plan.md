# Explicit workout stage kinds plus Make AI — Implementation Plan

## Overview

Persist explicit per-segment `kind` / `label` / `duration` / `target` as `training_units.stages` jsonb, drive bar colors from that `kind` field, and add a **Make AI** button beside Structure that POSTs the description to a non-mutating Completions endpoint and fills the day-edit segment list. Structure stays a derived one-liner for cells. This change ships S-05.* and S-06.* together.

## Current State Analysis

`TrainingUnit` has optional `structure?: string` only (`src/types.ts`). `training_units.structure text`; no `stages` column (`supabase/migrations/20260813130000_training_units.sql`). Owner RLS (`select/insert/update/delete_own`) already covers new columns — do not add policies.

`UNIT_COLUMNS` / `unitEditSchema` / `editUnit` write date, type, distance_km, structure, frozen (`src/lib/services/plan.ts`). PUT `/api/plan/units` is the calendar persist path (`src/pages/api/plan/units.ts`). `PlanWorkspace.saveUnit` JSON.stringifies `UnitEditPayload` (`src/components/plan/PlanWorkspace.tsx`). `applyMutations` copies type/distance/structure and **drops any field it does not copy** (`src/lib/services/plan-adaptation.ts`) — stages must be preserved when a mutation omits them, and included when the editor sends them.

`WorkoutStage` is `{ kind, label, weight }` (`src/components/plan/workout-stages.ts`). `parseWorkoutStages` infers kind via regex (`WU`/`CD`/tempo…). Empty structure → one `work` bar. `WorkoutStagesChart` colors from that inferred kind; work bars also depend on workout `type`. Day-edit is a single Structure `<input>` with a comment slot beside it (`PlanCalendar.tsx`). Chart mounts only in the read-only panel. There is no `/api/plan/stages-from-description`. Chat Completions+zod lives in `completeOpenAiPropose` (`src/lib/services/openai-chat.ts`) — do not fold this feature into that file (Flag snapshot / propose schema stay untouched).

`src/lib/test/migration-safety.test.ts` hard-codes the migration filename list and the newest-file name. A new SQL file must update that list. Do not `UPDATE` member tables. Do not add RLS.

HEAD already includes calendar-mobile-chrome (icon-only generate below `sm`, Type+Distance one row, log in closed disclosure, Make AI comment slot), load-chart-tabs (one chart, tabs `km per week` / `daily load (decay 0.85)`, default decay), and flag-admin-technical (content sentinel `<!--hf-technical-payload-->`). Do not regress those.

Repo-wide `npm run lint` is red at HEAD on untouched training-load / pace-estimate files. Phase gates use scoped tests, touched-file eslint, `npx astro check` — not repo-wide `npm run lint`.

## Desired End State

A member opens a planned day, clicks Edit, and sees Structure with a **Make AI** button (accessible name `Make AI`) in the existing slot beside it. They can list **Seg 1**, **Seg 2**, … each with an explicit kind select (`warmup` | `work` | `recovery` | `cooldown`), duration, label, and target. Changing kind recolors that segment on `WorkoutStagesChart` without requiring WU/CD/tempo in the sentence. Save persists `stages` jsonb `{kind, label, duration, target}` on `training_units` and a derived `structure` one-liner for cells. Clicking Make AI with `2km WU, 5km 4:20, 2km CD` POSTs `/api/plan/stages-from-description`, returns JSON stages (warmup 2 km, work 5 km @ 4:20, cooldown 2 km), and fills the editor — no unit upsert, no `/api/chat/messages`, no new chat bubble. Legacy rows with structure and null stages still parse via regex for the chart only.

### Key Discoveries:

- Notes Files omit `PlanWorkspace.tsx` and `plan-adaptation.ts`, but Save and `applyMutations` will wipe or never send `stages` unless those files join the write path.
- Chart in-memory model uses `weight` for bar width; persist shape uses `duration` + `target` strings. Map duration → weight with the existing clause-weight rules (km as km, minutes at 5:00 /km until FU-132).
- `generatePlan` spreads frozen units (`{ ...unit, frozen: true }`), so frozen stages survive generate if `listWeek` selected them. New generated units have no stages.
- `asDtoTrainingUnit` / revision JSON must round-trip `stages` or restore/undo drops them.
- Completions env is `OPENAI_API_KEY` / `OPENAI_MODEL` via `astro:env/server` plus `loadOpenAiModel` (`src/lib/services/llm-settings.ts`). Call the LLM only on the server.
- Hosted apply is `DEP-*`, not an Automated gate (test-plan §6.5; AGENTS.md).

## What We're NOT Doing

- Option (5b): parser prefixes `S1:` in `structure`.
- Option (6b): hidden coach Send / POST `/api/chat/messages` from Make AI.
- Inferring kind from “easy jog” (or any Structure prose) once `stages` exist; regex fallback only for legacy null-stages rows.
- A chart npm library (recharts, Chart.js, …).
- Persisting calendar mutations from `POST /api/plan/stages-from-description` (no upsert, no `editUnit`, no `replaceWeek`).
- Calling the LLM from the client; POSTing from a mock in production code.
- New RLS policies; `UPDATE`/`DELETE` of member rows in the migration.
- Applying the migration to hosted/production Supabase in this run (`DEP-027`).
- Changing Flag snapshot sentinel, load-chart tabs, generate chrome, last-race, or coach notes.
- Playwright / e2e (test-plan §6.3).
- Putting stages on the chat propose schema / `openai-chat.ts`.

## Implementation Approach

Four phases: (1) additive `stages jsonb` + shared `UnitStage` type + parse/format helpers that prefer persisted stages, (2) real read/write path through `UNIT_COLUMNS` / PUT / `applyMutations` / revisions, (3) non-mutating Completions endpoint with zod JSON, (4) compact day-edit Seg list + Make AI in the reserved slot, chart colored from `kind`.

## Critical Implementation Details

**Write path.** Make AI only returns JSON. Persist happens on the existing Save → PUT `/api/plan/units`. If the editor has stages, PUT sends `stages` and a derived `structure` one-liner; if stages are empty, PUT sends the Structure field as today and `stages` null.

**applyMutations.** When `mutation.stages` is omitted, keep `existing.stages`. When it is `[]` or a list, write that list (empty → omit/null). Chat mutations stay stages-unaware and must not wipe stored stages.

**Kind source of truth.** `parseWorkoutStages` / `WorkoutStagesChart`: if `stages` is a non-empty array, use each object’s `kind` and map `duration` → `weight`; do not run `clauseKind` on labels. Else fall back to today’s regex-on-structure.

## Phase 1: Migration, types, and stage helpers

### Overview

Add nullable `stages jsonb` on `training_units`, introduce the persist DTO, and teach the parser/chart model to prefer that JSON over regex. No HTTP or UI yet.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260904121000_unit_stages.sql`

**Intent**: Store explicit stage objects on the existing unit row. Existing owner RLS covers the column; do not add policies.

**Contract**: `ALTER TABLE training_units ADD COLUMN stages jsonb;`. No CHECK that would reject legacy null. No `UPDATE`, no `CREATE POLICY`, no `DROP`. Comment that Worker rollback does not undo this SQL. Filename sorts after `20260904120100_project_coach_notes.sql` and before `20260904180000_profile_last_race.sql`.

#### 2. Types

**File**: `src/types.ts`

**Intent**: Shared persist DTO for stages on units, mutations, and API bodies.

**Contract**: Export `WorkoutStageKind = "warmup" | "work" | "recovery" | "cooldown"` and `UnitStage = { kind, label, duration, target }` with `duration` and `target` as strings. `TrainingUnit.stages?: UnitStage[]`. `UnitMutation.stages?: UnitStage[] | null`. `workout-stages.ts` re-exports `WorkoutStageKind` from `@/types` (chart imports stay on `./workout-stages`); do not keep a second union in that file.

#### 3. Parse / format / weight

**File**: `src/components/plan/workout-stages.ts`

**Intent**: Chart and editor share one mapping: persisted stages win; regex is legacy-only; duration strings feed bar width; stages format the cell one-liner.

**Contract**: Extend `ParseWorkoutStagesInput` with optional `stages?: UnitStage[]`. If `stages` is non-empty, return one `WorkoutStage` per item (`kind` from the field, `label` from the field, `weight` from duration via existing km/min rules, floor 1). Do not call `clauseKind` on those rows. Empty/blank structure fallback unchanged when stages are absent. Export `formatStructureFromStages(stages: UnitStage[]): string` (comma-separated `duration` + optional label + optional ` @ target`). Export `durationToWeight(duration: string): number` (reuse clause-weight logic). Keep `WorkoutStage.weight` as the chart view-model field.

#### 4. Chart prefers stages

**File**: `src/components/plan/WorkoutStagesChart.tsx`

**Intent**: Color bars from the stage `kind` field when stages are provided.

**Contract**: Optional `stages?: UnitStage[]` prop passed into `parseWorkoutStages`. Keep native `div` bars, `cn()`, `aria-label="Workout stages"`, no chart library. Work-bar color may still depend on workout `type` for `kind === "work"`; warmup/recovery/cooldown stay kind colors even when the label has no WU/CD/tempo.

#### 5. Migration-safety list

**File**: `src/lib/test/migration-safety.test.ts`

**Intent**: Filename oracle includes the new expand-only file. Newest-file assertion follows filename order (last_race stays last).

**Contract**: Insert `"20260904121000_unit_stages.sql"` in the ordered list between project_coach_notes and profile_last_race. Newest name remains `20260904180000_profile_last_race.sql`. Distinctive `training_units` seed (`distance_km: 42`, `structure: "member-a-monday"`) still matches after the candidate.

### Success Criteria:

#### Automated Verification:

- File `supabase/migrations/20260904121000_unit_stages.sql` exists and contains `ADD COLUMN stages jsonb` and no `CREATE POLICY` / `UPDATE` / `DELETE FROM` / `DROP`
- `npm test -- src/components/plan/workout-stages.test.ts src/components/plan/WorkoutStagesChart.test.ts src/lib/test/migration-safety.test.ts`
- Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`)
- `npx astro check`

---

## Phase 2: Persist stages on unit write

### Overview

Select, upsert, edit, and revision round-trip the jsonb column. PUT `/api/plan/units` accepts `stages`. `applyMutations` does not drop them.

### Changes Required:

#### 1. Row mapping and UNIT_COLUMNS

**File**: `src/lib/services/plan.ts`

**Intent**: Real column on the write path, not a stub.

**Contract**: `UNIT_COLUMNS` includes `stages`. `TrainingUnitRow.stages` is `UnitStage[] | null`. `toTrainingUnit` / `toTrainingUnitRow` / `asTrainingUnitRow` / `asDtoTrainingUnit` round-trip a validated array (zod `unitStageSchema`: kind enum, label/duration/target strings max 100, array max 20). Invalid jsonb → treat as absent, do not throw the whole week. `unitEditSchema` adds `stages` optional nullable array of that object. `applyUnitEdit` / `editUnit` / the `.update({…})` payload write `stages` (null when empty). `unitsMatch` compares stages (JSON-stable) so a kind-only edit is `changed: true`.

#### 2. Preserve on chat-style mutations

**File**: `src/lib/services/plan-adaptation.ts`

**Intent**: Calendar Save can set stages; chat mutations that omit `stages` must not wipe them.

**Contract**: Create/patch copies `existing.stages` when `mutation.stages` is `undefined`. When `mutation.stages` is `null` or `[]`, omit stages on the next unit. When it is a non-empty array, copy it. `unitsEqual` includes stages so diffs are honest.

#### 3. PUT handler

**File**: `src/pages/api/plan/units.ts`

**Intent**: Zod already on `unitEditSchema`; handler keeps passing `parsed.data` into `editUnit`. Extra `userId` still stripped.

**Contract**: No new route. Invalid kind / extra stage keys → 400 `VALIDATION_ERROR` (zod strips unknown keys on the stage object if the schema does not passthrough; unknown kind fails). Persist `user_id` remains `locals.user.id`.

#### 4. Preserve-without-a-key

**File**: `src/lib/services/plan-adaptation.ts` (same as §2)

**Intent**: Existing `plan-adaptation.test.ts` equality fixtures must stay green.

**Contract**: When `existing.stages` is absent and the mutation omits `stages`, the next unit must not gain a `stages` property. Do not change `UnitEditPayload` in this phase — that type is Phase 4.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/pages/api/plan-contracts.test.ts src/lib/services/plan.test.ts src/lib/services/plan-adaptation.test.ts`
- PUT with a valid `stages` array stores jsonb on the session row; extra `userId` does not move rows; invalid kind leaves the store unchanged (400)
- Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`)
- `npx astro check`

---

## Phase 3: POST `/api/plan/stages-from-description`

### Overview

Authenticated Completions call that returns JSON stages. The handler does not touch `training_units` or chat.

### Changes Required:

#### 1. LLM JSON helper

**File**: `src/lib/services/stages-from-description.ts` (new)

**Intent**: Server-side Completions + zod, same family as `completeOpenAiPropose`, without importing or editing `openai-chat.ts`.

**Contract**: `completeStagesFromDescription({ structure: string }, { apiKey, model, fetchImpl? })` POSTs `https://api.openai.com/v1/chat/completions` with `response_format.json_schema` named `workout_stages`, strict schema: `{ stages: UnitStage[] }`. System prompt requires explicit kinds and the example `2km WU, 5km 4:20, 2km CD` → warmup `"2 km"` / work `"5 km"` target `"4:20"` / cooldown `"2 km"`. Parse content as JSON, `unitStagesSchema.safeParse`. Inject `fetchImpl` for tests. Timeout via `AbortSignal.timeout`. Do not call `editUnit` / `replaceWeek` / any Supabase table.

#### 2. HTTP route

**File**: `src/pages/api/plan/stages-from-description.ts` (new)

**Intent**: Non-mutating JSON endpoint next to `units.ts`.

**Contract**: `export const prerender = false`. POST only. `locals.user` missing → `unauthorized()` (401 JSON, no Location). Body zod: `{ structure: z.string().max(500) }`; trim and require min 1 else 400 `VALIDATION_ERROR`. Do **not** call `createClient` / Supabase — this route must not be able to upsert. Missing/blank `OPENAI_API_KEY` → 503 `UNAVAILABLE`. Completions/schema failure → 502 `UPSTREAM_ERROR`. Success `jsonOk({ stages })`. Do not POST `/api/chat/messages`. Do not add the path to `PROTECTED_ROUTES`. Use `loadOpenAiModel` only if you already have a Supabase client; otherwise `OPENAI_MODEL` / `DEFAULT_OPENAI_MODEL` is enough (no DB). Prefer `resolveOpenAiModel(null, OPENAI_MODEL)` so the handler never opens a client.

#### 3. Product gates

**File**: `src/pages/api/product-gates.test.ts`

**Intent**: Logged-out POST is 401 JSON like other plan routes (test-plan §6.4).

**Contract**: Import `POST` from `./plan/stages-from-description` and append a GATES row.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/services/stages-from-description.test.ts src/pages/api/plan/stages-from-description.test.ts src/pages/api/product-gates.test.ts`
- Logged-out POST → 401 `{ error: { code: "UNAUTHORIZED", message: "Sign in required" } }`, no `Location`, body has no `units` / `messages`
- Signed-in POST with mocked Completions returns the example three stages; handler does not call `createClient` / `editUnit` / `replaceWeek`
- Handler source does not contain `editUnit`, `replaceWeek`, or `/api/chat/messages`
- Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`)
- `npx astro check`

---

## Phase 4: Day-edit Seg list and Make AI

### Overview

Fill the reserved Structure slot with **Make AI**, list labeled segments with kind selects, show the chart from editor stages (including in edit mode so a kind change recolors immediately), and Save through the existing PUT.

### Changes Required:

#### 1. Day panel editor

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Compact day-edit keeps Type+Distance on one row, Structure + Make AI beside it, then Seg 1…N. Do not reopen the log disclosure or change generate chrome.

**Contract**: Replace the Make AI comment slot with a `type="button"` control whose accessible name is `Make AI` (`aria-label="Make AI"`; visible text may be `Make AI`). Keep Structure as a text field. Below it, render one row per editor stage labeled **Seg 1**, **Seg 2**, … each with a kind `<select>` (`warmup` | `work` | `recovery` | `cooldown`) plus duration, label, and target inputs (`cn()` for classes). Seed editor stages from `unit.stages` when that array is non-empty; otherwise start empty (Structure text remains; user clicks Make AI or Add). Add-segment control so S-05.2 works without Make AI. Make AI `preventDefault`, POST `/api/plan/stages-from-description` with `{ structure: editStructure }`, `credentials: "same-origin"`; on 200, set editor stages from `body.stages` (do not call `onSaveUnit`, do not fetch `/api/chat/messages`). On error, surface the API message in the panel; do not apply partial stages. Mount `WorkoutStagesChart` in the edit form with `stages={editStages}` (and type/distance) so changing kind recolors without WU/CD in Structure. Read-only chart passes `stages={unit.stages}` and `structure={unit.structure}`. Save: if editor stages length > 0, `onSaveUnit` with those stages and `structure: formatStructureFromStages(editStages)`; else structure from the text field and omit/empty stages. Keep `grid grid-cols-2` Type+Distance, closed `<details>` Log, icon-only generate below `sm`.

#### 2. PUT body from workspace

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Save already `JSON.stringify(payload)`; ensure `asUnit`/`GET` units keep `stages` on client state after Save/load.

**Contract**: No extra persist call. `UnitEditPayload` with `stages` is sent as-is. `asUnit` may stay a cast; GET `/api/plan` must have selected `stages` (Phase 2 `UNIT_COLUMNS`) so reload shows Segs.

#### 3. Source-scan tests

**Files**: `src/components/plan/PlanCalendar.test.ts`, `src/components/plan/WorkoutStagesChart.test.ts`

**Intent**: Lock Make AI name, Seg labels, kind select, chart-from-stages, and HEAD chrome.

**Contract**: Assert `aria-label="Make AI"`, `"Seg 1"`, kind select options including `warmup`, POST path `/api/plan/stages-from-description`, and that the file does not contain `/api/chat/messages`. Keep existing assertions for LoadChartTabs, icon-only generate, closed Log details, Type+Distance `grid-cols-2`. Chart test: kind field drives class even when label is `easy jog`.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/WorkoutStagesChart.test.ts src/components/plan/workout-stages.test.ts src/pages/api/plan-contracts.test.ts src/pages/api/product-gates.test.ts src/lib/services/stages-from-description.test.ts src/pages/api/plan/stages-from-description.test.ts src/lib/services/chat.test.ts`
- `npm test`
- Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`)
- `npx astro check`

#### Manual Verification:

- Open a planned day → Edit: Type and Distance stay one row; Structure stays; **Make AI** sits beside it; log is still inside a closed disclosure
- Paste `2km WU, 5km 4:20, 2km CD`, click Make AI: Seg 1/2/3 appear with kinds warmup / work / cooldown; no new chat bubble
- Change a kind: that bar recolors without editing Structure
- Save, reload: segments and colors persist; cell still shows a structure one-liner
- Phone width: generate stays icon-only below `sm`; day-edit stays compact
- Load chart still has one chart and tabs `km per week` / `daily load (decay 0.85)` with decay default
- Flag still stores the technical snapshot sentinel on assistant content

---

## Testing Strategy

### Unit Tests:

- Persisted stages win over regex; `kind` is not inferred from “easy jog” when stages exist
- Duration `"2 km"` → weight 2; `"10 min"` → weight 2 at 5:00 /km; `formatStructureFromStages` one-liner
- Completions helper: mocked `fetchImpl` returns the three-stage example; bad JSON throws
- Chart source: `cn()`, kind colors, no recharts/chart.js; kind field used when `stages` passed

### Integration Tests:

- Migration-safety ordered filenames + expand-only candidate keeps Member A unit payload
- PUT `/api/plan/units` stages persist; 400 invalid kind; extra `userId` stripped (test-plan §6.4 Risk #5)
- POST `/api/plan/stages-from-description` 401 logged out; 200 mock; handler never calls `createClient`
- `chat.test.ts` Flag sentinel still present (do not drop `FLAG_TECHNICAL_MARKER`)

### Manual Testing Steps:

1. Edit a day, Make AI on `2km WU, 5km 4:20, 2km CD`, confirm three Segs and colors, Save, reload
2. Confirm no new chat message
3. Confirm generate / load-chart / Flag chrome unchanged

## Performance Considerations

One Completions round-trip per Make AI click; no persist. jsonb on a one-row-per-day table. Chart stays a handful of `div`s.

## Migration Notes

Additive nullable `stages jsonb`, no backfill, no RLS. Existing rows keep NULL stages (regex fallback). Hosted apply is DEP-027; Worker rollback does not undo SQL. Local `npx supabase` apply is optional and not an Automated gate.

Rollback: `ALTER TABLE training_units DROP COLUMN stages;` (hosted) or revert the Worker; do not ship a down migration in this change.

## References

- Related research: `context/changes/workout-stages-make-ai/research.md`
- Notes: `context/changes/workout-stages-make-ai/change.md`
- Completions+zod pattern: `src/lib/services/openai-chat.ts` (`completeOpenAiPropose`) — copy the pattern, do not edit that file
- Unit write: `src/lib/services/plan.ts`, `src/pages/api/plan/units.ts`
- Test-plan §6.4 (API contracts), §6.5 (migration safety)
- HEAD chrome: `src/components/plan/PlanCalendar.test.ts` (generate, Log details, LoadChartTabs, Make AI slot)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration, types, and stage helpers

#### Automated

- [x] 1.1 File `supabase/migrations/20260904121000_unit_stages.sql` exists and contains `ADD COLUMN stages jsonb` and no `CREATE POLICY` / `UPDATE` / `DELETE FROM` / `DROP` — 8a882c7
- [x] 1.2 `npm test -- src/components/plan/workout-stages.test.ts src/components/plan/WorkoutStagesChart.test.ts src/lib/test/migration-safety.test.ts` — 8a882c7
- [x] 1.3 Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`) — 8a882c7
- [x] 1.4 `npx astro check` — 8a882c7

### Phase 2: Persist stages on unit write

#### Automated

- [x] 2.1 `npm test -- src/pages/api/plan-contracts.test.ts src/lib/services/plan.test.ts src/lib/services/plan-adaptation.test.ts` — 86a87b4
- [x] 2.2 PUT with a valid `stages` array stores jsonb on the session row; extra `userId` does not move rows; invalid kind leaves the store unchanged (400) — 86a87b4
- [x] 2.3 Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`) — 86a87b4
- [x] 2.4 `npx astro check` — 86a87b4

### Phase 3: POST `/api/plan/stages-from-description`

#### Automated

- [x] 3.1 `npm test -- src/lib/services/stages-from-description.test.ts src/pages/api/plan/stages-from-description.test.ts src/pages/api/product-gates.test.ts` — ec706a2
- [x] 3.2 Logged-out POST → 401 `{ error: { code: "UNAUTHORIZED", message: "Sign in required" } }`, no `Location`, body has no `units` / `messages` — ec706a2
- [x] 3.3 Signed-in POST with mocked Completions returns the example three stages; handler does not call `createClient` / `editUnit` / `replaceWeek` — ec706a2
- [x] 3.4 Handler source does not contain `editUnit`, `replaceWeek`, or `/api/chat/messages` — ec706a2
- [x] 3.5 Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`) — ec706a2
- [x] 3.6 `npx astro check` — ec706a2

### Phase 4: Day-edit Seg list and Make AI

#### Automated

- [x] 4.1 `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/WorkoutStagesChart.test.ts src/components/plan/workout-stages.test.ts src/pages/api/plan-contracts.test.ts src/pages/api/product-gates.test.ts src/lib/services/stages-from-description.test.ts src/pages/api/plan/stages-from-description.test.ts src/lib/services/chat.test.ts` — 09a9b39
- [x] 4.2 `npm test` — 09a9b39
- [x] 4.3 Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`) — 09a9b39
- [x] 4.4 `npx astro check` — 09a9b39

#### Manual

- [ ] 4.5 Open a planned day → Edit: Type and Distance stay one row; Structure stays; **Make AI** sits beside it; log is still inside a closed disclosure
- [ ] 4.6 Paste `2km WU, 5km 4:20, 2km CD`, click Make AI: Seg 1/2/3 appear with kinds warmup / work / cooldown; no new chat bubble
- [ ] 4.7 Change a kind: that bar recolors without editing Structure
- [ ] 4.8 Save, reload: segments and colors persist; cell still shows a structure one-liner
- [ ] 4.9 Phone width: generate stays icon-only below `sm`; day-edit stays compact
- [ ] 4.10 Load chart still has one chart and tabs `km per week` / `daily load (decay 0.85)` with decay default
- [ ] 4.11 Flag still stores the technical snapshot sentinel on assistant content
