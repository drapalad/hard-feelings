# Member coach notes on Profile — Implementation Plan

## Overview

Add a persisted `profiles.coach_notes` column, a Profile **Coach notes** textarea with Save, round-trip `coachNotes` on GET/PUT `/api/profile`, and inject `Member coach notes: <text>` into the first-pass (and extra-follow-up) `systemPrompt` when the text is non-empty. Option (a) only.

## Current State Analysis

`profiles` has weekly km, weekday prefs, mix, and last-race columns (`20260904180000_profile_last_race.sql`). There is no `coach_notes`. Owner RLS (`profiles_select_own` / `insert_own` / `update_own` / `delete_own`) already covers new columns. `weekly_km` is `NOT NULL`.

`Profile` is prefs only (`src/types.ts`). `ProfileView` adds nullable last-race fields. `ProfilePatch = Partial<Profile>` feeds chat freeze — last-race (and notes) must stay off `Profile`.

PUT `/api/profile` validates `profileWriteSchema` (six pref fields) and `upsertProfile` writes only those columns plus `user_id`. Omitting extra columns preserves them (memory merge; PostgREST upsert SET is the sent keys). Chat freeze calls `upsertProfile` with a prefs-only `Profile` (`src/lib/services/chat.ts` `acceptPendingProfileFreeze`). PATCH is last-race only. DELETE still drops the whole row (empty weekly km; FU-134).

First-pass and extra follow-up both call `completeOpenAiPropose` → the same `systemPrompt` (`src/lib/services/openai-chat.ts:199`, `:310–348`). Today it injects `Profile JSON: ${JSON.stringify(request.profile)}` and `currentLoad`. `sendMessage` already loads `getProfile` and passes the `ProfileView` into `completeSendTurn`.

SetupForm Profile tab has Weekly kilometres (own Save PUT), Race calendar, Estimated paces (own Save PATCH). No Coach notes. SSR `dashboard.astro` → `DashboardTabs` → `SetupForm` seeds last-race props from `getProfile`.

`src/lib/test/migration-safety.test.ts` hard-codes the ordered migration filename list; newest file today is `20260904180000_profile_last_race.sql`. Notes lock `20260904120000_profile_coach_notes.sql` (filename is free). That timestamp sorts **before** last-race, so the new file is inserted in the list, not appended as newest.

Wave-audit `research.md` `git_commit` is older than this HEAD (last-race already shipped). Treat research as a hint; files above are verified on this worktree.

## Desired End State

A member can type Coach notes on Profile, click Save, and have the text stored on their `profiles` row (server-clamped to 2000 characters; empty stored as SQL NULL). After reload, the textarea is filled. On every OpenAI first-pass (and the extra-follow-up completion that reuses `systemPrompt`), a non-empty note appears as a dedicated `Member coach notes: <text>` line, not only inside Profile JSON. Empty/null notes omit that line. Last-race columns, chip, PATCH, and seed stay unchanged.

### Key Discoveries:

- Notes lock PUT + `profileWriteSchema`, not a notes PATCH. Last-race used PATCH so weekly-km Save could omit those fields. For notes, Coach notes Save PUTs prefs + `coachNotes`; weekly-km Save **omits** `coachNotes` so `upsertProfile` does not write the column and existing notes survive (same omit-to-preserve as last-race).
- Chat freeze `upsertProfile(nextProfile)` must keep omitting `coach_notes` — do not add notes to `Profile` / `ProfilePatch`.
- Inject belongs in `systemPrompt` in `openai-chat.ts`. `chat.ts` already passes `ProfileView`; no second load path. Extra follow-up gets the line automatically.
- `FormField` is `<input>` only. Coach notes uses a native `<textarea>` with `cn(fieldClass)` — same visual family as Weekly kilometres (`h2` + `form space-y-3` + purple Save), not a new shadcn primitive.
- Hosted apply is `DEP-025`, not an Automated gate (test-plan §6.5).
- Repo-wide `npm run lint` is already red at HEAD on untouched training-load / pace-estimate files. Phase gates use scoped tests, touched-file eslint, `npx astro check`, and `npm test` / `npm run build` — not repo-wide `npm run lint`.

## What We're NOT Doing

- Option (b): local-only textarea.
- Admin-global notes; `project_settings.coach_notes`.
- Changing race/mix/last-race fields, PATCH last-race, or Riegel.
- Putting `coachNotes` on `Profile` / `ProfilePatch` / chat freeze payloads.
- New RLS policies; `UPDATE` backfill; hosted `db push` (DEP-025).
- Migrating a live/hosted DB from a mock.
- Playwright / e2e (test-plan §6.3).
- Changing DELETE `/api/profile` so empty weekly km keeps the row (FU-134).
- Fixing HEAD lint in `TrainingLoadChart.tsx` / `training-load.ts` / `training-load.test.ts` / `pace-estimate.test.ts`.

## Implementation Approach

Three phases: (1) additive migration + `ProfileView.coachNotes` + optional `coachNotes` on `profileWriteSchema` + `getProfile` / `upsertProfile` parse and conditional write; (2) PUT/GET contracts including clamp, empty→null, omit-to-preserve, owner strip; (3) Coach notes UI + SSR seed + `systemPrompt` inject + source-read / prompt tests.

`dashboard.astro` and `DashboardTabs.tsx` are not in Notes’ Files line but are required to seed SetupForm on first paint (same wiring persist-race-result used for last-race). `chat.ts` needs no product change unless a `ProfileView` fixture breaks.

## Critical Implementation Details

**PUT omit vs write.** `upsertProfile` includes `coach_notes` in the upsert object only when the write DTO has `coachNotes` (`string | null`). `undefined` (prefs-only PUT and chat freeze) omits the key. Postgres/memory then leave the column alone.

**Empty.** Trim; whitespace-only and `""` store SQL NULL; GET/`ProfileView` use `null`; SetupForm seeds `""`.

**Clamp.** Zod transform `slice(0, 2000)` after trim — do not 400 over-length. Textarea `maxLength={2000}` is UX only; server still clamps.

**Seed.** `useState(initialCoachNotes ?? "")` on first render, not an effect after `""`.

**Prompt.** After Profile JSON, if trimmed `request.profile.coachNotes` is non-empty, `parts.push(\`Member coach notes: ${text}\`)`. Omit the line when null/empty. Do not strip `coachNotes` from Profile JSON.

**Migration order.** File `20260904120000_profile_coach_notes.sql` sorts before `20260904180000_profile_last_race.sql`. Update the ordered list in `migration-safety.test.ts`; leave `newest.name` as last-race.

## Phase 1: Migration, types, schema, and profile service

### Overview

Add nullable `coach_notes` on `profiles`, expose it on `ProfileView`, extend PUT zod, and teach `getProfile` / `upsertProfile` to round-trip it without touching last-race or freeze prefs.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260904120000_profile_coach_notes.sql`

**Intent**: Store member coach notes on the existing profile row. Existing owner RLS covers the column; do not add policies.

**Contract**: `ALTER TABLE profiles ADD COLUMN coach_notes text;` (nullable, no DEFAULT required). Comment that Worker rollback does not undo this SQL. No `UPDATE`, no `CREATE POLICY`, no `DROP`, no CHECK (length is enforced in zod). Filename exactly as Notes.

#### 2. Types

**File**: `src/types.ts`

**Intent**: Expose notes on the GET/SSR/UI view without polluting generate/chat `Profile`.

**Contract**: `ProfileView` gains `coachNotes: string | null`. `Profile` and `ProfilePatch` unchanged.

#### 3. PUT write schema

**File**: `src/lib/services/profile-races.ts`

**Intent**: Accept optional `coachNotes` on PUT. Extra keys (including `userId` / `user_id`) still strip. Over-length is clamped, not rejected.

**Contract**: Add optional `coachNotes: z.string()`. After parse: trim; empty → `null`; otherwise `slice(0, 2000)`. **Invariant:** a body that omitted `coachNotes` must not have the key on `safeParse` data (do not default omitted → `null`). A naive `z.string().optional().transform(emptyToNull)` would add `coachNotes: null` to every prefs PUT and wipe notes on weekly-km Save. Strip or rebuild the object so omitted stays absent; only then `upsertProfile` can use `'coachNotes' in profile`. Existing pref refinements unchanged.

#### 4. Profile service

**File**: `src/lib/services/profile.ts`

**Intent**: Select and parse `coach_notes` on GET; write it on PUT only when the client sent `coachNotes`; keep last-race omit-to-preserve.

**Contract**:
- `SELECT_COLUMNS` appends `coach_notes`.
- Parse: non-empty string (after trim) or `null`.
- `emptyProfileView` / `toProfileView` always set `coachNotes` (`null` when missing).
- `upsertProfile(client, userId, profile: Profile & { coachNotes?: string | null })` writes the six pref columns as today; adds `coach_notes: profile.coachNotes` **only when** `'coachNotes' in profile` (including explicit `null`). Chat freeze keeps passing a plain `Profile`.
- Last-race parse/update unchanged.

#### 5. GET/PUT fixtures (exact JSON)

**File**: `src/pages/api/profile.test.ts`

**Intent**: `toProfileView` adds `coachNotes` on every GET/PUT. Existing `toEqual` assertions fail unless they include `coachNotes: null` in this phase.

**Contract**: Extend no-row GET, sparse-row GET, and PUT round-trip expected JSON with `coachNotes: null`. Do not add clamp / omit-preserve cases yet (Phase 2). Last-race PATCH tests still pass last-race fields; add `coachNotes: null` wherever a full `ProfileView` is asserted.

#### 6. Migration-safety filename lock

**File**: `src/lib/test/migration-safety.test.ts`

**Intent**: The harness walks on-disk files in name order; the expected list must include the new file.

**Contract**: Insert `"20260904120000_profile_coach_notes.sql"` **before** `"20260904180000_profile_last_race.sql"`. `newest.name` remains `"20260904180000_profile_last_race.sql"`.

#### 7. Schema unit tests (this phase)

**File**: `src/lib/services/profile-races.test.ts`

**Intent**: Prove optional notes, clamp, empty→null, extra key strip, and prefs-only body still accepts.

**Contract**: Prefs-only `VALID_PROFILE` still succeeds and `expect(parsed.data).not.toHaveProperty("coachNotes")`. `coachNotes: "  hi  "` → `"hi"`. `""` / `"   "` → `null` **and** `toHaveProperty("coachNotes")`. 2001-char string → length 2000. Extra `userId` stripped. Existing pref rejection cases unchanged.

### Success Criteria:

#### Automated Verification:

- Migration file exists at `supabase/migrations/20260904120000_profile_coach_notes.sql` and adds `coach_notes text` with no new POLICY and no UPDATE of `profiles`
- `profileWriteSchema` unit tests: omit / empty / clamp / strip as in Changes Required 7 (`src/lib/services/profile-races.test.ts`)
- GET/PUT exact JSON in `src/pages/api/profile.test.ts` includes `coachNotes: null` when unset
- `npm test -- src/lib/test/migration-safety.test.ts src/lib/services/profile-races.test.ts src/pages/api/profile.test.ts`
- `npx astro check`

---

## Phase 2: PUT persist contracts

### Overview

Prove PUT writes `coach_notes`, GET returns it, omitting the field preserves an existing note, extra owner keys strip, and last-race PATCH is untouched.

### Changes Required:

#### 1. Profile route

**File**: `src/pages/api/profile.ts`

**Intent**: PUT already `safeParse`s `profileWriteSchema` and passes `parsed.data` to `upsertProfile`. Once the schema and service accept `coachNotes`, the handler wires through with no new verb.

**Contract**: Keep `prerender = false`. Do not add a notes PATCH. Pass `parsed.data` through (includes optional `coachNotes`). GET already returns `getProfile` — no handler change once `ProfileView` has the field.

#### 2. API contract tests

**File**: `src/pages/api/profile.test.ts`

**Intent**: Persist, authz, omit-to-preserve, clamp (test-plan §6.4 Risks #1 / #5 / #6). Literal JSON bodies; do not `safeParse` in the test.

**Contract**:
- Logged-out PUT still 401 JSON (existing).
- PUT with `coachNotes: "Keep long easy"` round-trips on GET and store (`coach_notes`); extra `userId` / `user_id` persist as session user; victim row unchanged.
- PUT `coachNotes: ""` stores null / GET `coachNotes: null`.
- PUT body with 2001-character `coachNotes` succeeds; stored value length 2000.
- After PUT with notes, PUT of prefs **without** `coachNotes` leaves `coach_notes` intact; GET still returns the note. Last-race columns still intact (existing PATCH then prefs PUT case).
- Invalid prefs still 400 `VALIDATION_ERROR`; store unchanged (existing).

### Success Criteria:

#### Automated Verification:

- `npm test -- src/pages/api/profile.test.ts src/lib/services/profile-races.test.ts`
- `npx astro check`

---

## Phase 3: Profile Coach notes UI, SSR seed, and first-pass inject

### Overview

Add a Coach notes section on Profile with textarea + Save. Seed from SSR. Inject `Member coach notes:` in `systemPrompt` when non-empty.

### Changes Required:

#### 1. SetupForm Coach notes

**File**: `src/components/setup/SetupForm.tsx`

**Intent**: Persist notes via PUT of current prefs + `coachNotes`. Same visual family as Weekly kilometres. Do not change last-race PATCH.

**Contract**:
- Prop `coachNotes: string | null`. Seed `useState(coachNotes ?? "")`.
- New `<section>` **after** Weekly kilometres and **before** Race calendar: `h2` “Coach notes”, caption that these notes go to the coach on every chat turn, `<textarea id="coachNotes">` with `cn(fieldClass)`, `maxLength={2000}`, `rows={4}`, purple Save (`Saving...` / `Save`). Native textarea — do not extend `FormField`.
- Save PUTs `{ weeklyKm, longWeekdays, restWeekdays, mixEasy, mixThreshold, mixSpeed, coachNotes }` using the same pref values as `saveKm` (require a parseable weekly km; if km is empty, show an error and do not DELETE). Empty textarea sends `""` (server stores null).
- Weekly-km `saveKm` PUT body stays prefs-only (no `coachNotes` key) so notes survive km Save.
- Last-race PATCH unchanged.

#### 2. SSR seed

**Files**: `src/pages/dashboard.astro`, `src/components/dashboard/DashboardTabs.tsx`

**Intent**: First paint shows saved notes without a client GET after mount (persist-race-result pattern).

**Contract**: Read `profile.coachNotes` next to last-race; pass `coachNotes={...}` into `DashboardTabs` → `SetupForm`. Catch path resets to `null`.

#### 3. First-pass inject

**File**: `src/lib/services/openai-chat.ts`

**Intent**: Dedicated prompt line so notes are not buried only in Profile JSON (S-01.4). Extra follow-up reuses this function.

**Contract**: In `systemPrompt`, after the Profile JSON part: if `request.profile?.coachNotes` is a non-empty string (trim), push `Member coach notes: ${trimmed}`. Omit when null/empty/whitespace. Do not add a second inject in `chat.ts`.

#### 4. chat.ts

**File**: `src/lib/services/chat.ts`

**Intent**: Notes listed this file because `sendMessage` loads profile. Pass-through already exists.

**Contract**: No new fetch or prompt assembly. Freeze `upsertProfile` stays prefs-only `Profile`. Only touch this file if a type/fixture requires it.

#### 5. Tests

**Files**: `src/lib/services/openai-chat.test.ts`, `src/components/setup/SetupForm.test.ts`

**Intent**: Prompt line and UI wiring are CI-assertable without Playwright.

**Contract**:
- `openai-chat.test.ts`: fixture `coachNotes: null` on `ProfileView`. When `coachNotes` is `"Keep Fridays easy"`, the system message contains `Member coach notes: Keep Fridays easy`. When null, the prompt does **not** contain `Member coach notes:`.
- `SetupForm.test.ts`: source contains heading `Coach notes`, `id="coachNotes"`, PUT including `coachNotes:`, and weekly-km PUT still has `method: "PUT"` without requiring `coachNotes` on that body (assert the Coach notes fetch includes `coachNotes` and last-race PATCH remains).

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/services/openai-chat.test.ts src/components/setup/SetupForm.test.ts src/pages/api/profile.test.ts src/lib/services/profile-races.test.ts`
- `npm test`
- Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`)
- `npx astro check`
- `npm run build`

#### Manual Verification:

- On Profile, type a Coach notes sentence, Save, reload `/dashboard?tab=profile`: textarea still shows the text
- Save weekly km after notes exist: notes still in the textarea after reload
- Clear notes, Save; reload; textarea empty

---

## Testing Strategy

### Unit Tests:

- `profileWriteSchema`: omit, empty→null, trim, clamp 2000, extra key strip
- `systemPrompt` via `completeOpenAiPropose` fetch body: inject when set, omit when null

### Integration Tests:

- PUT/GET contracts in `profile.test.ts` (401, owner strip, clamp, empty, omit-to-preserve, last-race still preserved)
- `migration-safety.test.ts` ordered filenames including `20260904120000_profile_coach_notes.sql`

### Manual Testing Steps:

1. Save Coach notes; reload Profile; textarea filled
2. Save weekly km; reload; notes remain
3. Clear notes, Save; reload; textarea empty

## Performance Considerations

One nullable text column on a single-row-per-user table. Prompt adds at most ~2000 characters on completions that already send Profile JSON. No extra HTTP round-trip if SSR passes the prop.

## Migration Notes

Additive nullable column, no backfill, no RLS. Existing rows stay NULL (empty textarea until Save). Hosted apply is DEP-025; Worker rollback does not undo SQL. Local `npx supabase` apply is optional and not an Automated gate.

Rollback: `ALTER TABLE profiles DROP COLUMN coach_notes;` (hosted) or revert the Worker; do not ship a down migration in this change.

Empty weekly km DELETE still drops the notes with the row (FU-134).

## References

- Related research: `context/changes/user-coach-notes/research.md`
- Notes: `context/changes/user-coach-notes/change.md`
- Similar additive column + PUT/ProfileView: `context/changes/persist-race-result/plan.md`
- Similar additive columns: `supabase/migrations/20260904180000_profile_last_race.sql`
- Test-plan §6.1 (unit), §6.4 (API contracts), §6.5 (migration safety)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration, types, schema, and profile service

#### Automated

- [x] 1.1 Migration file exists at `supabase/migrations/20260904120000_profile_coach_notes.sql` and adds `coach_notes text` with no new POLICY and no UPDATE of `profiles` — 72d80c4
- [x] 1.2 `profileWriteSchema` unit tests: omit / empty / clamp / strip as in Changes Required 7 (`src/lib/services/profile-races.test.ts`) — 72d80c4
- [x] 1.3 GET/PUT exact JSON in `src/pages/api/profile.test.ts` includes `coachNotes: null` when unset — 72d80c4
- [x] 1.4 `npm test -- src/lib/test/migration-safety.test.ts src/lib/services/profile-races.test.ts src/pages/api/profile.test.ts` — 72d80c4
- [x] 1.5 `npx astro check` — 72d80c4

### Phase 2: PUT persist contracts

#### Automated

- [x] 2.1 `npm test -- src/pages/api/profile.test.ts src/lib/services/profile-races.test.ts` — c8461c6
- [x] 2.2 `npx astro check` — c8461c6

### Phase 3: Profile Coach notes UI, SSR seed, and first-pass inject

#### Automated

- [x] 3.1 `npm test -- src/lib/services/openai-chat.test.ts src/components/setup/SetupForm.test.ts src/pages/api/profile.test.ts src/lib/services/profile-races.test.ts` — d122d43
- [x] 3.2 `npm test` — d122d43
- [x] 3.3 Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`) — d122d43
- [x] 3.4 `npx astro check` — d122d43
- [x] 3.5 `npm run build` — d122d43

#### Manual

- [ ] 3.6 On Profile, type a Coach notes sentence, Save, reload `/dashboard?tab=profile`: textarea still shows the text
- [ ] 3.7 Save weekly km after notes exist: notes still in the textarea after reload
- [ ] 3.8 Clear notes, Save; reload; textarea empty
