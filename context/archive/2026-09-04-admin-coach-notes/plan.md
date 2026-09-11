# Admin coach notes — Implementation Plan

## Overview

Add a persisted `project_settings.coach_notes` column, an Admin **Coach notes (all members)** textarea on the Chat model card, round-trip `coachNotes` on GET/PATCH `/api/admin/settings`, and inject `Admin coach notes: <text>` into `systemPrompt` on every member OpenAI completion (first-pass and extra follow-up) when non-empty. Option (a) only. Keep existing `Member coach notes:` injection from `profiles.coach_notes`.

## Current State Analysis

`project_settings` is a singleton (`id = 'default'`) with `openai_model`, `updated_at`, `updated_by` (`supabase/migrations/20260831194000_project_llm_settings.sql`). There is no `coach_notes`. RLS already covers the table: `project_settings_select_authenticated`, `project_settings_insert_admin`, `project_settings_update_admin`. Members may SELECT the row (same as the model id); they cannot INSERT/UPDATE. Do not add policies.

`PATCH /api/admin/settings` body is `{ openaiModel }` only. GET returns `{ openaiModel, resolvedModel, envFallback }`. Non-admin → `notFound()` (404). Unauthenticated → 401 (`product-gates.test.ts`). `setStoredOpenAiModel` upserts `{ id, openai_model, updated_by, updated_at }` — memory merge and PostgREST column-list both leave unspecified columns alone.

Admin page 404s when `!Astro.locals.isAdmin`. The Chat model card mounts `AdminLlmSettings` with openaiModel / resolvedModel / envFallback only. One purple **Save model** button PATCHes `openaiModel`.

`systemPrompt` (`src/lib/services/openai-chat.ts:310–352`) injects horizon, Profile JSON, **`Member coach notes:`** from `request.profile.coachNotes` when non-empty, currentLoad, optional extra. No admin/operator free-text. `completeOpenAiPropose` has no Supabase client. `completeSendTurn` (`src/lib/services/chat.ts:534–581`) calls `complete(firstRequest)` then, on a valid `dataRequest`, `complete({ ...firstRequest, extra })`. Both calls share the same request object minus `extra`.

`src/lib/test/migration-safety.test.ts` hard-codes the ordered filename list. Newest file today is `20260904180000_profile_last_race.sql`. Notes lock `20260904120100_project_coach_notes.sql`, which sorts **after** `20260904120000_profile_coach_notes.sql` and **before** last-race — insert in the list, do not change `newest.name`.

Wave-audit `research.md` `git_commit` is older than this HEAD (`user-coach-notes` already ships Member inject). Treat research as a hint; files above are verified on this worktree.

## Desired End State

An admin can type **Coach notes (all members)** on `/admin`, click Save, and have the text stored on the `project_settings` singleton (server-clamped to 2000 characters; empty stored as SQL NULL). After reload, the textarea is filled. Members never see or edit this field. On every OpenAI completion for a member send — first-pass **and** extra follow-up — a non-empty note appears as a dedicated `Admin coach notes: <text>` line. Empty/null notes omit that line. `Member coach notes:` from `profiles.coach_notes` still injects when the member has notes. The model picker, isAdmin 404, and existing GET model fields stay.

### Key Discoveries:

- Inject belongs in `systemPrompt`. `completeOpenAiPropose` cannot load the column (no client). `completeSendTurn` must load notes once and put them on `firstRequest` so `{ ...firstRequest, extra }` reuses them. That is why `chat.ts` is in scope — not a second prompt builder.
- Keep `Member coach notes:` exactly as shipped. Add `Admin coach notes:` as a sibling line (after member notes when both exist). Do not fold admin text into Profile JSON.
- `ProposeCompleteFn` does not list `adminCoachNotes`. Passing a wider `firstRequest` object is valid (excess-property checks apply to literals, not variables). Chat tests capture it on an intersection type; do not widen `propose-adaptation.ts`.
- Hosted apply is `DEP-026`, not an Automated gate (test-plan §6.5).
- Repo-wide `npm run lint` is already red at HEAD on untouched training-load / pace-estimate files. Phase gates use scoped tests, touched-file eslint, `npx astro check`, and `npm test` / `npm run build` — not repo-wide `npm run lint`.

## What We're NOT Doing

- Option (b): env `COACH_ADMIN_NOTES`.
- Adding `profiles.coach_notes` (already shipped by `user-coach-notes`).
- Changing the model picker (input, datalist, suggestions, resolved-model line).
- Dropping isAdmin 404 on `/admin` or `notFound()` on GET/PATCH settings.
- New RLS policies; hosted `db push` (DEP-026).
- Migrating a live/hosted DB from a mock.
- Playwright / e2e (test-plan §6.3).
- Injecting only on first-pass, or stripping `coachNotes` from Profile JSON.
- Fixing HEAD lint in `TrainingLoadChart.tsx` / `training-load.ts` / `training-load.test.ts` / `pace-estimate.test.ts`.

## Implementation Approach

Three phases: (1) additive migration + llm-settings get/set + GET/PATCH `coachNotes` contracts; (2) Admin textarea + SSR seed + same-card Save; (3) load notes in `completeSendTurn`, inject in `systemPrompt`, prove first-pass and extra follow-up.

## Critical Implementation Details

**PATCH omit vs write.** `openaiModel` stays required on PATCH (existing clients and tests). `coachNotes` is optional. When the key is omitted, do not include `coach_notes` in the upsert — existing notes survive a model-only save. When the key is present (including JSON `null`), write `coach_notes`. The Admin island always sends both.

**Empty.** Trim; whitespace-only and `""` store SQL NULL; GET returns `null`; Admin island seeds `""`.

**Clamp.** Transform `slice(0, 2000)` after trim — do not 400 over-length. Textarea `maxLength={2000}` is UX only; server still clamps.

**Prompt.** After the Member coach notes block (still gated on trimmed `request.profile.coachNotes`), if trimmed `request.adminCoachNotes` is non-empty, `parts.push(\`Admin coach notes: ${text}\`)`. Omit the line when null/empty/whitespace. Extra follow-up reuses `firstRequest.adminCoachNotes` via spread.

**Load.** In `completeSendTurn`, when `complete` is defined, `await getStoredCoachNotes(client)` and set `adminCoachNotes` on `firstRequest`. Stub `proposeAdaptation` path (`complete === undefined`) does not call OpenAI — no inject needed. Read failure → treat as empty (omit the line); do not fail the send.

**Migration order.** File `20260904120100_project_coach_notes.sql` sorts between profile coach notes and last-race. Update the ordered list in `migration-safety.test.ts`; leave `newest.name` as last-race.

## Phase 1: Migration, settings service, and PATCH/GET contracts

### Overview

Add nullable `coach_notes` on `project_settings`, teach llm-settings to read/write it without wiping `openai_model`, and extend GET/PATCH `/api/admin/settings` so `coachNotes` round-trips (clamp, empty→null, omit-to-preserve).

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260904120100_project_coach_notes.sql`

**Intent**: Store project-wide admin coach notes on the existing singleton. Existing policies cover the column; do not add RLS.

**Contract**: `ALTER TABLE project_settings ADD COLUMN coach_notes text;` (nullable, no DEFAULT required). Comment that Worker rollback does not undo this SQL. No `UPDATE`, no `CREATE POLICY`, no `DROP`, no CHECK (length is enforced in zod). Filename exactly as Notes.

#### 2. llm-settings service

**File**: `src/lib/services/llm-settings.ts`

**Intent**: Read and write `coach_notes` on the singleton without changing model resolve fallbacks.

**Contract**:
- `getStoredCoachNotes(client)`: `select("coach_notes")` on `id = default`; parse like the model helper (non-empty trimmed string or `null`); errors/missing row → `null`.
- `setStoredOpenAiModel` keeps writing only `openai_model` + audit columns (model-only PATCH must not send `coach_notes: null`).
- Add `setStoredCoachNotes(client, coachNotes: string | null, updatedBy)` **or** a combined upsert that includes `coach_notes` only when the caller passed notes. PATCH handler uses the path that writes notes only when the body had `coachNotes`.
- `loadOpenAiModel` / `resolveOpenAiModel` / `openaiModelIdSchema` unchanged.

#### 3. PATCH/GET handler

**File**: `src/pages/api/admin/settings.ts`

**Intent**: Persist and return `coachNotes`. Keep isAdmin 404 and openaiModel validation.

**Contract**:
- `prerender = false` stays.
- Extend `patchBodySchema` with optional `coachNotes: z.string().nullable()`. After parse, **rebuild like `profileWriteSchema`**: if `coachNotes` is `undefined` (omitted), strip the key so `'coachNotes' in data` is false; if present, trim; empty/whitespace → `null`; else `slice(0, 2000)`. A naive `.transform(emptyToNull)` that always sets the key would make model-only PATCH write `coach_notes: null` and wipe notes.
- `openaiModel` remains required (`openaiModelIdSchema.nullable()`).
- `settingsPayload` adds `coachNotes: string | null` (null when unset).
- Keep `notFound()` for non-admin; 401 for logged-out.

#### 4. Service + API tests

**File**: `src/lib/services/llm-settings.test.ts`

**Intent**: Round-trip notes; model-only upsert leaves notes intact.

**Contract**: After `setStoredCoachNotes("Keep long easy")`, `getStoredCoachNotes` returns that string. Empty/whitespace → `null`. `setStoredOpenAiModel` after notes are set does not clear `getStoredCoachNotes`.

**File**: `src/pages/api/admin/settings.test.ts`

**Intent**: Persist, 404, clamp, empty→null, omit-to-preserve (test-plan §6.4). Literal JSON bodies.

**Contract**:
- Existing non-admin GET/PATCH still 404 `NOT_FOUND` (no `createClient`).
- Existing model round-trip still 200; expected JSON **adds** `coachNotes: null` when unset.
- PATCH `{ openaiModel, coachNotes: "Keep long easy" }` round-trips on GET; store `coach_notes`. Extra `userId` stripped (zod).
- PATCH `coachNotes: ""` stores null / GET `coachNotes: null`.
- PATCH 2001-character `coachNotes` succeeds; stored length 2000.
- After notes exist, PATCH `{ openaiModel: "gpt-4o-mini" }` **without** `coachNotes` leaves notes intact.
- Invalid `openaiModel` still 400 `VALIDATION_ERROR`.

#### 5. Migration-safety filename lock

**File**: `src/lib/test/migration-safety.test.ts`

**Intent**: The harness walks on-disk files in name order; the expected list must include the new file.

**Contract**: Insert `"20260904120100_project_coach_notes.sql"` **after** `"20260904120000_profile_coach_notes.sql"` and **before** `"20260904180000_profile_last_race.sql"`. `newest.name` remains `"20260904180000_profile_last_race.sql"`.

### Success Criteria:

#### Automated Verification:

- Migration file exists at `supabase/migrations/20260904120100_project_coach_notes.sql` and adds `coach_notes text` with no new POLICY and no UPDATE of `project_settings`
- `npm test -- src/lib/test/migration-safety.test.ts src/lib/services/llm-settings.test.ts src/pages/api/admin/settings.test.ts src/pages/api/product-gates.test.ts`
- Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`)
- `npx astro check`

---

## Phase 2: Admin Chat model card textarea

### Overview

Show **Coach notes (all members)** on the existing Chat model card, seed from SSR, and persist via the same Save that already PATCHes the model (picker chrome unchanged).

### Changes Required:

#### 1. Admin page seed

**File**: `src/pages/admin.astro`

**Intent**: Pass stored notes into the island. Keep isAdmin 404 and the model load path.

**Contract**: When `showPanel && supabase`, also `getStoredCoachNotes`. Pass `coachNotes={coachNotes}` (`null` when unset or load error). Do not change the 404 HTML branch. Model picker props unchanged.

#### 2. AdminLlmSettings island

**File**: `src/components/admin/AdminLlmSettings.tsx`

**Intent**: Textarea + persist `coachNotes` with the existing Save. Members never mount this island.

**Contract**:
- Prop `coachNotes: string | null`. `useState(initialCoachNotes ?? "")` on first render, not an effect after `""`.
- Label **Coach notes (all members)**; native `<textarea>` with `cn(...)` matching the model input family (`border-white/20 bg-white/10`, `maxLength={2000}`).
- Existing Save still PATCHes `/api/admin/settings`; body includes `openaiModel` **and** `coachNotes` (empty string or trimmed text — server maps empty → null).
- `SettingsPayload` / `isSettingsPayload`: accept `coachNotes: string | null` (missing → treat as `""` seed, do not fail the response).
- Do not change the model input, datalist, suggestions, or resolved-model line. Keep the **Save model** label (picker chrome).
- No member-facing copy of this field on Profile or chat UI.

#### 3. Source-read lock

**File**: `src/components/admin/AdminLlmSettings.test.ts` (new)

**Intent**: CI-cheap lock that the textarea and PATCH body exist without Playwright.

**Contract**: `readFileSync` of the sibling tsx. Assert label `Coach notes (all members)`, a `<textarea`, `maxLength={2000}`, and `coachNotes` in the PATCH `JSON.stringify` body. Assert model `datalist` / `openai-model` still present.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/admin/AdminLlmSettings.test.ts src/pages/api/admin/settings.test.ts`
- Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`)
- `npx astro check`

#### Manual Verification:

- As admin, type Coach notes (all members), Save model, reload `/admin`: textarea still shows the text
- Clear the textarea, Save model, reload: textarea empty
- Signed-out or non-admin GET `/admin` is still 404, not the Chat model card

---

## Phase 3: Inject Admin coach notes on every member completion

### Overview

Load `project_settings.coach_notes` once per send turn and inject `Admin coach notes:` in `systemPrompt` for both first-pass and extra follow-up. Keep `Member coach notes:`.

### Changes Required:

#### 1. Request field + systemPrompt

**File**: `src/lib/services/openai-chat.ts`

**Intent**: Dedicated admin line on every `completeOpenAiPropose` call that carries notes. Do not touch Member inject.

**Contract**: `LlmProposeRequest` gains optional `adminCoachNotes?: string | null`. In `systemPrompt`, after the existing Member coach notes block, if `request.adminCoachNotes?.trim()` is non-empty, push `Admin coach notes: ${trimmed}`. Omit when missing/null/whitespace. Extra JSON block unchanged. Do not put admin notes on `LlmProposeExtra` (that would add “Follow-up extra JSON is included” on first-pass).

#### 2. completeSendTurn load

**File**: `src/lib/services/chat.ts`

**Intent**: Both `complete` calls in a send turn see the same admin notes.

**Contract**: Import `getStoredCoachNotes` from `./llm-settings` (chat.ts has no llm-settings import today). When `complete` is defined, load once and set `adminCoachNotes` on `firstRequest` (alongside `...input`). The extra call stays `{ ...firstRequest, extra }`. Load errors → `null` / omit. Do not load when `complete` is undefined.

#### 3. Prompt + send tests

**File**: `src/lib/services/openai-chat.test.ts`

**Intent**: Inject when set; omit when empty; do not drop Member inject.

**Contract**: New case: `adminCoachNotes: "Keep Sundays long"` → prompt contains `Admin coach notes: Keep Sundays long`. Existing default request (no field) still `not.toContain("Admin coach notes:")`. Existing Member inject test still `toContain("Member coach notes: Keep Fridays easy")`. Combined case: both lines present when both are set.

**File**: `src/lib/services/chat.test.ts`

**Intent**: First-pass and extra follow-up both receive `adminCoachNotes`.

**Contract**: Add a **sibling** send test (do not overload the existing extra-follow-up assertions). Seed `project_settings: [{ id: "default", coach_notes: "Project-wide cue" }]` plus the same calendar fixtures the extra-follow-up test uses so `complete` is called twice. `calls[0]` and `calls[1]` both have `adminCoachNotes === "Project-wide cue"`. A second case with no `project_settings` row: both calls have null/undefined/empty and the send still succeeds.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/services/openai-chat.test.ts src/lib/services/chat.test.ts src/lib/services/llm-settings.test.ts src/pages/api/admin/settings.test.ts src/components/admin/AdminLlmSettings.test.ts`
- `npm test`
- Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`)
- `npx astro check`
- `npm run build`

---

## Testing Strategy

### Unit Tests:

- `getStoredCoachNotes` / model-only upsert preserve notes
- `systemPrompt` via `completeOpenAiPropose` fetch body: Admin inject when set, omit when empty, Member inject unchanged
- AdminLlmSettings source-read: label, textarea, PATCH `coachNotes`

### Integration Tests:

- GET/PATCH contracts in `settings.test.ts` (404, clamp, empty→null, omit-to-preserve, model round-trip still 200)
- `chat.test.ts` extra follow-up carries `adminCoachNotes` on both complete calls
- `migration-safety.test.ts` ordered filenames including `20260904120100_project_coach_notes.sql`
- `product-gates.test.ts` logged-out 401 unchanged

### Manual Testing Steps:

1. Admin: save notes, reload `/admin`, textarea filled
2. Clear notes, save, reload, textarea empty
3. Non-admin `/admin` still 404

## Performance Considerations

One nullable text column on a singleton row. Prompt adds at most ~2000 characters on completions that already send Profile JSON. One extra SELECT of `project_settings` per member send that uses OpenAI (not on the stub path).

## Migration Notes

Additive nullable column, no backfill, no RLS. Existing singleton stays NULL (empty textarea until Save). Hosted apply is DEP-026; Worker rollback does not undo SQL. Local `npx supabase` apply is optional and not an Automated gate.

Rollback: `ALTER TABLE project_settings DROP COLUMN coach_notes;` (hosted) or revert the Worker; do not ship a down migration in this change.

Until DEP-026 is applied, production Admin Save of notes will 500; model-only PATCH that omits `coachNotes` stays safe.

## References

- Related research: `context/changes/admin-coach-notes/research.md`
- Notes: `context/changes/admin-coach-notes/change.md`
- Sibling member notes: `context/changes/user-coach-notes/plan.md`
- Table + RLS: `supabase/migrations/20260831194000_project_llm_settings.sql`
- Test-plan §6.1 (unit), §6.4 (API contracts), §6.5 (migration safety)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration, settings service, and PATCH/GET contracts

#### Automated

- [x] 1.1 Migration file exists at `supabase/migrations/20260904120100_project_coach_notes.sql` and adds `coach_notes text` with no new POLICY and no UPDATE of `project_settings` — 6910ba0
- [x] 1.2 `npm test -- src/lib/test/migration-safety.test.ts src/lib/services/llm-settings.test.ts src/pages/api/admin/settings.test.ts src/pages/api/product-gates.test.ts` — 6910ba0
- [x] 1.3 Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`) — 6910ba0
- [x] 1.4 `npx astro check` — 6910ba0

### Phase 2: Admin Chat model card textarea

#### Automated

- [x] 2.1 `npm test -- src/components/admin/AdminLlmSettings.test.ts src/pages/api/admin/settings.test.ts` — 48ead59
- [x] 2.2 Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`) — 48ead59
- [x] 2.3 `npx astro check` — 48ead59

#### Manual

- [ ] 2.4 As admin, type Coach notes (all members), Save model, reload `/admin`: textarea still shows the text
- [ ] 2.5 Clear the textarea, Save model, reload: textarea empty
- [ ] 2.6 Signed-out or non-admin GET `/admin` is still 404, not the Chat model card

### Phase 3: Inject Admin coach notes on every member completion

#### Automated

- [x] 3.1 `npm test -- src/lib/services/openai-chat.test.ts src/lib/services/chat.test.ts src/lib/services/llm-settings.test.ts src/pages/api/admin/settings.test.ts src/components/admin/AdminLlmSettings.test.ts` — 4214eb1
- [x] 3.2 `npm test` — 4214eb1
- [x] 3.3 Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`) — 4214eb1
- [x] 3.4 `npx astro check` — 4214eb1
- [x] 3.5 `npm run build` — 4214eb1
