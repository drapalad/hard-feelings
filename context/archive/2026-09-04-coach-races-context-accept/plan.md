# Coach races context + Accept-gated writes — Implementation Plan

## Overview

On every coach first-pass, inject compact `races` JSON (upcoming plus A-priority with goals) and tell the model races live on the `races` table, not Profile. Extend propose JSON with optional `races: { add, remove, patch }`, persist it on `chat_profile_freeze_pending.races_patch`, and land writes only on Accept via existing `insertRace` / `updateRace` / `deleteRace` + `validateRaceList`. Calendar km/type still auto-apply on Send.

## Current State Analysis

First-pass `sendMessage` → `completeSendTurn` passes profile, `currentLoad`, `isoWeeks`, and admin coach notes. It does **not** call `listRaces`. `listRaces` runs only in `fetchCoachExtra` after `dataRequest` (`src/lib/services/chat.ts`). Extra prompt injects `Range races JSON` (`src/lib/services/openai-chat.ts`). Profile JSON has no races (`Profile` / `ProfileView` in `src/types.ts`). Asking to save a distant race produced a “profile has no race/goal field” refusal.

Propose schema has mutations (including `delete`), log, dataRequest, profile, freeze, unfreeze — no `races` (`parsedProposeSchema` / `PROPOSE_JSON_SCHEMA`). `completeSendTurn` round-trips the LLM result through `toRawProposeResult` → `sanitizeProposeResult` in `propose-adaptation.ts`, so any new propose field that is not on `ProposeResult` / `RawProposeResult` is dropped before pending persist.

`listRaces` / `insertRace` / `updateRace` / `deleteRace` already exist (`src/lib/services/races.ts`). `validateRaceList` is one A + unique date (`src/lib/services/profile-races.ts`). `insertRace` / `updateRace` re-validate against the **current** table, so applying a new A while the old A still exists fails — Accept must project the full next list, then execute **remove → patch → add**.

Pending store `chat_profile_freeze_pending` has `profile_patch`, `freeze_dates`, `unfreeze_dates` — no `races_patch` (`supabase/migrations/20260903123000_chat_profile_freeze_pending.sql`). Own-row RLS already covers new columns. `PendingProfileFreeze` and `toPendingProfileFreeze` treat a row with empty profile/freeze/unfreeze as absent — races-only pending would vanish until that guard includes `races_patch`.

Review card is “Accept profile & freeze changes” (`PlanChat.tsx`). `POST /api/chat/accept` → `acceptProposition` still loads leftover `plan_propositions` first; profile/freeze (and this slice’s races) ride the fallback. `chat-drop-pending-propositions` is planned, not shipped — this change does not skip leftovers. Dismiss already drops the pending row. `PlanWorkspace` `applyChatBody` maps `pendingProfileFreeze`; `asPendingProfileFreeze` does not yet parse a `races` field.

Wave-audit `research.md` `git_commit` is older than this HEAD (`c195ce3`; delete units, iso weeks, flag technical, member/admin coach notes already shipped). Treat research as a hint; files above are verified on this worktree.

Repo-wide `npm run lint` is already red at HEAD on untouched training-load / pace-estimate files. Phase gates use scoped tests, touched-file eslint, `npx astro check`, and `npm test` — not repo-wide `npm run lint`.

## Desired End State

A distant-race ask yields an Accept card listing the mutation (e.g. `Add race: Spring HM · 12 Apr 2027 · A`) with **Accept** and **Dismiss**, not a “no field” refusal. First-pass (and extra follow-up, which reuses `systemPrompt`) cites compact upcoming/A races and states that races live on the `races` table. Send does not write `races`. Accept calls existing race writes + `validateRaceList`, then marks pending accepted. Dismiss drops pending without writing `races`. Calendar km/type still auto-apply.

### Key Discoveries:

- Notes list `openai-chat.ts` / `chat.ts` but not `propose-adaptation.ts`. `completeSendTurn` sanitizes through that module; races must be on `ProposeResult` / `RawProposeResult` or they never reach `upsertPendingProfileFreeze`.
- `insertRace` validates against the live table, not a projected list. Accept execution order is remove → patch → add after a single `validateRaceList` on the projected next list.
- `toPendingProfileFreeze` returning null on empty profile/freeze would hide races-only pending. Same for `sanitizePendingProfileFreeze` on Send.
- Leftover `plan_propositions` still steal Accept (`chat-drop-pending-propositions`, FU-125 done/promoted). Out of scope here.
- Newest migration on disk is `20260904180000_profile_last_race.sql`. Notes’ example `20260904140000_chat_race_pending.sql` is unused and names a table we are not creating. This plan uses `20260904210000_chat_profile_freeze_pending_races_patch.sql` (sorts after last-race).
- Hosted apply is DEP-028 (test-plan §6.5). Existing own-row policies; do not add RLS.

## What We're NOT Doing

- Option (b) / S-09.5 skip of Accept-gated writes
- Table `chat_race_pending` or new RLS
- Auto-apply race writes on Send
- Putting races onto `Profile` / `ProfileView` / Profile JSON
- Changing SetupForm race editor
- Persisting finish times
- Requiring Accept for km/type mutations (including `delete: true`)
- Dropping leftover `plan_propositions` (`chat-drop-pending-propositions`)
- Changing Flag technical sentinel, isoWeeks, coach-notes inject, or day-panel Delete
- Hosted `db push` (DEP-028)
- Playwright / e2e (test-plan §6.3)
- Fixing HEAD lint in untouched training-load / pace-estimate files

## Implementation Approach

Three phases: (1) additive `races_patch jsonb` + types + pending row parse so races-only rows survive; (2) first-pass compact inject, prompt copy, propose schema, persist-on-Send without applying; (3) Accept writes + review card.

## Critical Implementation Details

**Sanitize round-trip.** `completeSendTurn` always does `sanitizeProposeResult(toRawProposeResult(raw), …)`. `completeOpenAiPropose` must put compact races onto `RawProposeResult.races`; `propose-adaptation.ts` must copy them onto `ProposeResult.races` (including the log-only early return). Otherwise Send never stores `races_patch`.

**Accept order.** Project `listRaces` minus `remove` ids, with `patch` merged by id, plus `add`. Unknown remove/patch ids return `NOT_FOUND` before any writes. Then `validateRaceList` on that projection. On failure, return 400 (`SECOND_A_RACE` / `DUPLICATE_RACE_DATE`) and leave status `pending`. On success: existing profile/freeze writes, then `deleteRace` / `updateRace` / `insertRace` in that order, then status `accepted`. Patch payloads merge onto the current race so `updateRace` still receives a full `RaceWrite` (`date` + `priority` required).

## Phase 1: `races_patch` column and pending types

### Overview

Add the column, extend `PendingProfileFreeze`, and teach load/upsert/parse to keep races-only pending rows. No LLM or Accept writes yet.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260904210000_chat_profile_freeze_pending_races_patch.sql`

**Intent**: Additive jsonb on the existing pending table. Own-row RLS already covers the column.

**Contract**: `ALTER TABLE chat_profile_freeze_pending ADD COLUMN races_patch jsonb;` plus a one-line comment that Worker rollback does not undo this SQL. No `CREATE TABLE`, no `ENABLE ROW LEVEL SECURITY`, no new policies. Append the filename to the ordered list in `src/lib/test/migration-safety.test.ts`.

#### 2. Shared types

**File**: `src/types.ts`

**Intent**: Pending JSON matches propose `races: { add, remove, patch }`.

**Contract**: Add a `PendingRacesPatch` (or equivalent) with `add: { date, priority, name?, goal? }[]`, `remove: { id: string }[]`, `patch: { id, date?, priority?, name?, goal? }[]`. Add optional `races?: PendingRacesPatch` on `PendingProfileFreeze`. Do not put races on `Profile`.

#### 3. Pending row load / upsert

**File**: `src/lib/services/chat.ts`

**Intent**: A pending row with only `races_patch` is visible to GET/Send the same way profile/freeze is.

**Contract**:
- `PendingProfileFreezeRow` includes `races_patch`. Select/insert that column.
- `asPendingProfileFreezeRow` must **not** require `"races_patch" in data`. Missing key or SQL `null` parses as no races patch so existing memory fixtures and pre-migration-shaped rows still load profile/freeze.
- `toPendingProfileFreeze` returns the row when `races` is a non-empty patch even if profile/freeze/unfreeze are empty.
- Empty `{ add: [], remove: [], patch: [] }` counts as no races patch (same as null).
- `upsertPendingProfileFreeze` writes `races_patch: pending.races ?? null`.
- `races.ts` is not modified in this phase (writes reused in Phase 3).
- `chat.test.ts` or `accept-proposition.test.ts`: seed a pending row **without** `races_patch` (today’s fixture shape) still loads profile/freeze; seed a races-only `races_patch` with empty freeze arrays loads as non-null pending with `races`.

#### 4. Client parser

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Chat JSON `pendingProfileFreeze.races` survives `asPendingProfileFreeze` so Phase 3 UI can read it.

**Contract**: If `races` is a non-null object, copy `add` / `remove` / `patch` arrays with the typed fields; ignore malformed items. Do not add a second React state key.

### Success Criteria:

#### Automated Verification:

- Migration file exists and contains `ALTER TABLE chat_profile_freeze_pending ADD COLUMN races_patch jsonb` and does not contain `CREATE TABLE` or `CREATE POLICY`
- `npm test -- src/lib/test/migration-safety.test.ts src/lib/services/chat.test.ts src/lib/services/accept-proposition.test.ts`
- `npx astro check`

---

## Phase 2: First-pass context and propose `races` (persist, do not apply)

### Overview

Load compact races on every first-pass, instruct the model that races are not on Profile, accept `races` in propose JSON, and store them on the pending row without writing `races`.

### Changes Required:

#### 1. Compact JSON + prompt + schema

**File**: `src/lib/services/openai-chat.ts`

**Intent**: S-09.1 and S-09.2 on every `systemPrompt` (first-pass and extra). S-09.3 schema.

**Contract**:
- Export `compactCoachRaces(races, today)`: include a race if `date >= today` **or** (`priority === "A"` and `goal` is a non-empty string). Output objects with only `id`, `date`, `priority`, and `name`/`goal` when present. Preserve `listRaces` order. Do not slice to `weekStart` or `dataRequest`.
- `LlmProposeRequest` gains optional `races?:` compact array. `systemPrompt` injects `Races JSON: ${JSON.stringify(request.races)}` when defined (including `[]`).
- Prompt states races live on the `races` table, not on Profile, and the model must never reply that the profile has no race or goal field. Instruct it to propose `races.add` / `races.remove` / `races.patch` when the member asks to add, remove, or change a race, and not to claim it cannot persist them.
- `parsedProposeSchema` + `PROPOSE_JSON_SCHEMA`: optional/nullable `races` with `add`, `remove`, `patch`. Strict schema: `races` in top-level `required` (like `profile`); object requires `add`/`remove`/`patch`; add items require `date`, `priority`, `name`, `goal` (`name`/`goal` string or null); remove items require `id`; patch items require `id` plus `date`/`priority`/`name`/`goal` (nulls for unused). Compact nulls the same way as `compactProfilePatch`.
- Pass compacted `races` from parsed JSON onto `RawProposeResult`. Do not call `insertRace` here.

#### 2. Sanitize round-trip

**File**: `src/lib/services/propose-adaptation.ts`

**Intent**: Notes did not list this file; `completeSendTurn` still drops unknown propose fields. Companion to `openai-chat.ts`.

**Contract**: `ProposeResult` / `RawProposeResult` gain optional `races` with the same `{ add, remove, patch }` shape. `sanitizeProposeResult` and `toRawProposeResult` copy it through (including the log-only return). Do not turn race writes into `UnitMutation`s.

#### 3. Send path

**File**: `src/lib/services/chat.ts`

**Intent**: Every first-pass completion loads races. Race propose stays pending.

**Contract**:
- `CompleteSendInput` and `ProposeCompleteFn` gain optional `races?:` compact array (same fields as the prompt JSON) so tests can assert `calls[0]?.races` without a cast. Extra follow-up still spreads `firstRequest`.
- In `sendMessage`, `listRaces` then `compactCoachRaces(…, utcToday())` into `completeSendTurn`’s first request (and therefore the extra follow-up that spreads `firstRequest`).
- `sanitizePendingProfileFreeze` includes a sanitized races patch (valid ISO dates, priorities A–D, non-empty ids). Persist when races is non-empty even if profile/freeze are empty. Do **not** call `insertRace` / `updateRace` / `deleteRace` on Send.
- Km/type/`delete: true` auto-apply unchanged. `fetchCoachExtra` still passes full `listRaces` as `extra.races` (Range races JSON).

#### 4. Tests

**Files**: `src/lib/services/openai-chat.test.ts`, `src/lib/services/chat.test.ts`, `src/lib/services/propose-adaptation.test.ts` as needed

**Intent**: Compact set, prompt copy, schema, and persist-without-apply are CI-assertable (test-plan §6.1 / §6.2).

**Contract**:
- `compactCoachRaces`: upcoming B included; past A with goal included; past B excluded; past A without goal excluded.
- First-pass system prompt contains `Races JSON:`, the table-not-profile sentence, and does not claim Profile holds races. First `complete` call receives compact races without a `dataRequest`.
- Propose with `races.add` and empty mutations: `chat_profile_freeze_pending.races_patch` stored; `races` table unchanged.
- Km mutation still writes `training_units` on Send when races is also present.
- Existing extra-follow-up test still sees `extra.races`.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/services/openai-chat.test.ts src/lib/services/chat.test.ts src/lib/services/propose-adaptation.test.ts`
- `npx astro check`

---

## Phase 3: Accept / Dismiss and review card

### Overview

Accept applies race writes through existing services; Dismiss already drops the row. The review card lists race lines with the same Accept/Dismiss buttons.

### Changes Required:

#### 1. Accept writes

**Files**: `src/lib/services/chat.ts`, `src/lib/services/races.ts` (call sites only — do not fork write logic), `src/pages/api/chat/accept.ts`

**Intent**: S-09.4. Routes stay thin; `prerender = false` unchanged.

**Contract**:
- In `acceptPendingProfileFreeze`, if `pending.races` is present: `listRaces` → project next list. Unknown `remove`/`patch` ids return `NOT_FOUND` **before** any profile, freeze, or race writes. Then `validateRaceList` on the projection. On invariant failure, return `{ ok: false, error: { code, message } }` with `SECOND_A_RACE` or `DUPLICATE_RACE_DATE` and do not change status or write. Then existing profile/freeze writes. Then `deleteRace` for each remove id, `updateRace` for each patch (merge onto current row), `insertRace` for each add. Then mark `accepted`.
- Expand `AcceptPropositionResult` error codes with `SECOND_A_RACE`, `DUPLICATE_RACE_DATE`, `NOT_FOUND`. `accept.ts` already maps non-`HARD_BOUNDS` codes through `jsonError` (400 except `DB_ERROR`).
- Do not auto-apply races anywhere else. Do not skip leftover `plan_propositions`.

#### 2. Dismiss

**File**: `src/pages/api/chat/dismiss.ts`

**Intent**: Same Dismiss as profile/freeze.

**Contract**: Keep calling `dismissPendingProfileFreeze` (already sets status `dismissed` on the row, including `races_patch`). No new route. Confirm `prerender = false`.

#### 3. Review card

**Files**: `src/components/plan/PlanChat.tsx`, `src/components/plan/PlanWorkspace.tsx`

**Intent**: Visible Accept card for a distant-race add.

**Contract**:
- Keep heading `Accept profile & freeze changes`. After existing profile/freeze lines, render one line per add/remove/patch, e.g. `Add race: Spring HM · 12 Apr 2027 · A` (name or `Unnamed`; date via the same day-month-year style as `formatLoadedDate` with year; priority). Remove: `Remove race: {id}`. Patch: `Patch race:` plus id and any provided fields.
- Card still shows when pending is races-only (`pendingProfileFreeze !== null`). Same Accept/Dismiss buttons and `onAcceptPending` / `onDismissPending`.
- `asPendingProfileFreeze` (Phase 1) is enough for `applyChatBody`; after successful accept/dismiss the workspace already clears pending.

#### 4. Tests

**Files**: `src/lib/services/accept-proposition.test.ts`, `src/lib/services/chat.test.ts`, `src/components/plan/PlanChat.test.ts`, `src/components/plan/PlanWorkspace.test.ts`

**Intent**: Accept persist, Dismiss no-write, card copy (test-plan §6.2). No Playwright.

**Contract**:
- Seed pending `races_patch` add → `acceptProposition` inserts the race, status `accepted`.
- Second A or duplicate date → not ok; `races` table unchanged; status still `pending`.
- Dismiss → no race row; status `dismissed`.
- `PlanChat.test.ts`: source contains `Add race:`, `Accept`, `Dismiss`, and still `Accept profile & freeze changes`.
- `PlanWorkspace.test.ts`: `asPendingProfileFreeze` / pending state still wired to `/api/chat/accept` and `/api/chat/dismiss`.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/services/accept-proposition.test.ts src/lib/services/chat.test.ts src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts src/lib/services/openai-chat.test.ts`
- `npm test`
- Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`)
- `npx astro check`

#### Manual Verification:

- Ask the coach to add a distant named A/B race: Accept card lists the add line; Send does not create a `races` row; Accept does; Dismiss on a second ask does not
- First-pass reply cites an existing upcoming or A race and does not say the profile has no race or goal field
- Change a day’s km via chat: it still lands on Send without Accept

---

## Testing Strategy

### Unit Tests:

- `compactCoachRaces` membership and field omit
- `systemPrompt` via `completeOpenAiPropose` fetch body: Races JSON, table-not-profile sentence, schema `races` required keys
- `sanitizeProposeResult` preserves `races` and does not emit calendar mutations from it

### Integration Tests:

- Send persist-without-apply (`chat.test.ts`, memory store — test-plan §6.2)
- Accept / Dismiss (`accept-proposition.test.ts`)
- `migration-safety.test.ts` ordered filenames including `20260904210000_chat_profile_freeze_pending_races_patch.sql` (test-plan §6.5)
- Source-read PlanChat / PlanWorkspace chrome

### Manual Testing Steps:

1. Distant-race ask → Accept card, not a “no field” refusal; Accept writes; Dismiss does not
2. Coach cites upcoming/A races on first-pass
3. Km/type chat still auto-applies on Send

## Performance Considerations

One extra `listRaces` on every Send (same query extra already does after `dataRequest`). Compact JSON is a handful of `{ id, date, priority, name, goal }` objects. Accept is a short sequential write list, not a new round-trip from the client.

## Migration Notes

Additive nullable `races_patch jsonb`, no backfill, no RLS. Existing pending rows stay NULL (no race card until a new propose). Hosted apply is DEP-028; Worker rollback does not undo SQL. Local `npx supabase` apply is optional and not an Automated gate.

Rollback: `ALTER TABLE chat_profile_freeze_pending DROP COLUMN races_patch;` (hosted) or revert the Worker; do not ship a down migration in this change.

Until DEP-028, production Send that stores `races_patch` will 500; km/type auto-apply without a races propose stays safe.

## References

- Related research: `context/changes/coach-races-context-accept/research.md`
- Notes: `context/changes/coach-races-context-accept/change.md`
- Pending table: `supabase/migrations/20260903123000_chat_profile_freeze_pending.sql`
- Race writes: `src/lib/services/races.ts`, `validateRaceList` in `src/lib/services/profile-races.ts`
- Leftover Accept steal: `context/changes/chat-drop-pending-propositions/change.md` (out of scope)
- Test-plan §6.1, §6.2, §6.3 (no Playwright), §6.5

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: `races_patch` column and pending types

#### Automated

- [x] 1.1 Migration file exists and contains `ALTER TABLE chat_profile_freeze_pending ADD COLUMN races_patch jsonb` and does not contain `CREATE TABLE` or `CREATE POLICY` — a9107ee
- [x] 1.2 `npm test -- src/lib/test/migration-safety.test.ts src/lib/services/chat.test.ts src/lib/services/accept-proposition.test.ts` — a9107ee
- [x] 1.3 `npx astro check` — a9107ee

### Phase 2: First-pass context and propose `races` (persist, do not apply)

#### Automated

- [x] 2.1 `npm test -- src/lib/services/openai-chat.test.ts src/lib/services/chat.test.ts src/lib/services/propose-adaptation.test.ts` — 3d3a7e8
- [x] 2.2 `npx astro check` — 3d3a7e8

### Phase 3: Accept / Dismiss and review card

#### Automated

- [x] 3.1 `npm test -- src/lib/services/accept-proposition.test.ts src/lib/services/chat.test.ts src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts src/lib/services/openai-chat.test.ts` — cae1e74
- [x] 3.2 `npm test` — cae1e74
- [x] 3.3 Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`) — cae1e74
- [x] 3.4 `npx astro check` — cae1e74

#### Manual

- [ ] 3.5 Ask the coach to add a distant named A/B race: Accept card lists the add line; Send does not create a `races` row; Accept does; Dismiss on a second ask does not
- [ ] 3.6 First-pass reply cites an existing upcoming or A race and does not say the profile has no race or goal field
- [ ] 3.7 Change a day’s km via chat: it still lands on Send without Accept
