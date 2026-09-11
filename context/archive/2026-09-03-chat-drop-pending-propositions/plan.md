# Drop leftover plan_propositions calendar Accept Implementation Plan

## Overview

Stop the leftover `plan_propositions` calendar-pending layer from intercepting Accept. Keep auto-apply for km/type chat edits and keep the `Accept profile & freeze changes` card on `chat_profile_freeze_pending`. Promoted from FU-125; this run implements.

## Current State Analysis

After `chat-auto-apply`, Send writes calendar mutations immediately. The UI no longer shows Accept/Reject for the week. `plan_propositions` still exists (`supabase/migrations/20260813160000_chat_gated_adaptation.sql`). `listChat` still returns `proposition`. `acceptProposition` (`src/lib/services/chat.ts`) does:

1. `loadPending` from `plan_propositions`
2. If a pending row exists, persist those `proposed_units` (old calendar Accept)
3. Else `acceptPendingProfileFreeze`

That is FU-125 F1 from `chat-mutations-range-accept-admin`: a leftover pending proposition **wins** over profile/freeze.

`rejectPending` is still called from `sendMessage`, `src/pages/api/plan/units.ts`, `undo.ts`, and `restore.ts` to mark leftover calendar rows rejected so GET/Accept cannot revive them. `POST /api/chat/reject` is unused by `PlanChat`.

`PlanWorkspace` still keeps `proposition` in state and reads it from GET/send bodies. `PlanChat` does not render it. `DashboardTabs` still threads the SSR `proposition` prop.

Memory persist and migration-safety still seed `plan_propositions`.

## Desired End State

- `POST /api/chat/accept` applies `chat_profile_freeze_pending` only (profile service + frozen flags), then clears that pending row.
- A leftover `plan_propositions` row, if the table still exists for a moment, is ignored.
- GET `/api/chat` and send responses do not include `proposition`.
- `POST /api/chat/reject` is gone.
- `rejectPending` / `insertPending` / calendar `loadPending` are gone from product paths.
- Tests no longer expect calendar Accept. Profile/freeze Accept tests stay.
- Optional but planned: DROP `plan_propositions` + DEP for hosted apply.

### Key Discoveries:

- Accept route is shared; deleting `src/pages/api/chat/accept.ts` would break profile/freeze.
- `accept-proposition.test.ts` covers both the old persist-skip calendar path and the new profile/freeze fallback — rewrite, do not delete the file blindly.
- `src/pages/api/chat/threads.test.ts` asserts GET latest/older thread still returns `proposition` for the week — those assertions must flip to `not.toHaveProperty("proposition")` or equivalent.
- Product-gates / quality-gates may list `accept-proposition.test.ts` and `reject.ts` — update the lists.
- `insertPending` is already gone (`chat-auto-apply`); do not restore it. `rejectPending` still runs on Send / units / undo / restore.
- `migrateOverFixture` seeds distinctive rows for every `OWNER_READABLE_TABLES` entry that exists after the baseline, then fails if those rows or owner SELECT policies disappear. `DROP TABLE plan_propositions` therefore fails `src/lib/test/migration-safety.test.ts` unless `plan_propositions` is retired from `OWNER_READABLE_TABLES` / `DISTINCTIVE_SEEDS` in the same change as the DROP. The harness already classifies `DROP TABLE` (it is not an unclassified statement); the failure is payload/policy survival, not “distinctive-key rewrite”.
- `NO_PENDING_PROPOSITION` is unused by UI; empty Accept should return `NO_PENDING_PROFILE_FREEZE`.

## What We're NOT Doing

- Requiring Accept for ordinary km/type chat edits.
- Changing the profile/freeze card copy, Dismiss route, or `chat_profile_freeze_pending` schema.
- Coach prompt, range `dataRequest`, threads, Flag for admin.
- Running hosted `db push` in this change (DEP only).
- Playwright.

## Implementation Approach

Invert Accept so profile/freeze is the only pending apply path, then delete the calendar pending I/O, then drop the table so the landmine cannot return.

## Phase 1: Accept ignores calendar propositions

### Overview

`acceptProposition` becomes a thin wrapper that only runs `acceptPendingProfileFreeze`. Calendar `loadPending` is not consulted.

### Changes Required:

**File**: `src/lib/services/chat.ts`

**Intent**: Accept never persists `proposed_units` from `plan_propositions`.

**Contract**: If no profile/freeze pending row, return `NO_PENDING_PROFILE_FREEZE` (UI does not depend on `NO_PENDING_PROPOSITION`). Hard-bounds path for calendar Accept is deleted. Send still auto-applies km/type via `acceptDecision` as today. Do not call `loadPending`.

**File**: `src/lib/services/accept-proposition.test.ts`

**Contract**: Remove tests that land or hard-bound a pending calendar proposition (`persist-skip`, `14-day keep-merge`). Keep profile/freeze and races-patch tests. Add a leftover-row test: seed both `plan_propositions` pending and `chat_profile_freeze_pending`; Accept must apply profile/freeze, not calendar units. That leftover test is Phase-1-only and is deleted in Phase 3 when the memory table goes away.

### Success Criteria:

#### Automated:

- 1.1 `acceptProposition` with only `chat_profile_freeze_pending` still applies profile/freeze
- 1.2 `acceptProposition` with a leftover `plan_propositions` pending row plus profile/freeze pending applies **profile/freeze**, not the calendar units
- 1.3 Unit tests pass: `npm test -- src/lib/services/accept-proposition.test.ts src/lib/services/chat.test.ts`
- 1.4 Full suite passes: `npm test`

#### Manual:

- 1.5 On `/dashboard`, a plan-only chat edit still lands without the Accept card
- 1.6 A profile/freeze propose still shows the Accept card and Accept applies it

## Phase 2: Remove calendar pending I/O

### Overview

Stop returning, rejecting, and storing calendar propositions on the HTTP/UI path.

### Changes Required:

**File**: `src/lib/services/chat.ts`

**Intent**: `listChat` / send result omit `proposition`. Delete `rejectPending`, `rejectProposition`, calendar `loadPending` / `toProposition` / `asPropositionRow` / `setPropositionStatus` if unused. `insertPending` is already absent — do not add it back. Drop `ChatList.proposition`.

**File**: `src/pages/api/chat/reject.ts`

**Intent**: Delete the route.

**Files**: `src/pages/api/plan/units.ts`, `src/pages/api/plan/undo.ts`, `src/pages/api/plan/restore.ts`

**Intent**: Stop calling `rejectPending`.

**Files**: `src/components/plan/PlanWorkspace.tsx`, `src/components/dashboard/DashboardTabs.tsx`, `src/pages/dashboard.astro`

**Intent**: Drop `proposition` prop/state (`setProposition`, `asProposition`). Do not restore calendar Accept UI. Keep profile/freeze Accept/Dismiss.

**File**: `src/types.ts`

**Intent**: Remove `PlanProposition` / `PropositionStatus` if nothing else imports them.

**Files**: tests that assert `proposition` (`src/lib/services/chat.test.ts`, `src/pages/api/chat/threads.test.ts`, `src/components/plan/PlanWorkspace.test.ts`, `src/pages/api/product-gates.test.ts`)

**Contract**: Chat JSON has no `proposition` key (`not.toHaveProperty("proposition")`). Drop the 401 gate import of `/api/chat/reject`. Send tests that currently assert leftover `plan_propositions` status via `rejectPending` should stop querying that table (Phase 3 removes it). Keep `pendingProfileFreeze` assertions.

### Success Criteria:

#### Automated:

- 2.1 GET `/api/chat` body has no `proposition` key
- 2.2 `POST /api/chat/reject` is absent (404 or file deleted)
- 2.3 Full suite passes: `npm test`
- 2.4 Lint passes on touched files: `npm run lint`

#### Manual:

- 2.5 Dismiss still clears the profile/freeze card without changing profile/frozen state

## Phase 3: Drop `plan_propositions` + hosted DEP

### Overview

Remove the table so leftover rows cannot exist. Record hosted apply.

### Changes Required:

**File**: `supabase/migrations/YYYYMMDDHHMMSS_drop_plan_propositions.sql`

**Intent**: `DROP TABLE IF EXISTS plan_propositions CASCADE` with a comment that Worker rollback does not undo SQL. Confirm no remaining product INSERT/SELECT on that table.

**Files**: `src/lib/test/migration-safety.ts`, `src/lib/test/migration-safety.test.ts`

**Intent**: Retire `plan_propositions` from `OWNER_READABLE_TABLES` and `DISTINCTIVE_SEEDS` so `migrateOverFixture` does not seed it and then fail payloadDiff / missingSelectOwn after the DROP. Append the new filename to the ordered list; update the newest-file assertion. Do not weaken the existing `DROP TABLE training_units` failure case.

**Files**: `src/lib/test/memory-supabase.ts`, `src/lib/test/memory-supabase.test.ts`, `src/lib/test/migration-pg.test.ts`

**Intent**: Remove `plan_propositions` from `MEMORY_TABLES` / fluent-terminal seeds. In `migration-pg.test.ts`, drop it from `OWNER_TABLES` and from `seedMemberA` (otherwise `FORCE ROW LEVEL SECURITY` after DROP throws when `HF_MIGRATION_PG=1`).

**Files**: leftover calendar seeds in `src/lib/services/accept-proposition.test.ts` (Phase 1 leftover-row test), `src/lib/services/chat.test.ts`, `src/pages/api/chat/threads.test.ts`

**Intent**: Delete leftover-row / `plan_propositions` seeds so the suite compiles after `MemorySeed` no longer includes that table.

**File**: `context/deployment/deferred.md`

**Intent**: New **DEP-030** — apply this migration to hosted `hard-feelings` via `supabase db push`. Source: Unattended / `chat-drop-pending-propositions`. Do not reuse DEP-003/004/029. Do not run hosted push in this change.

### Success Criteria:

#### Automated:

- 3.1 `npm test -- src/lib/test/migration-safety.test.ts` — DROP is classified; distinctive payloads on remaining owner tables survive (table retired from `OWNER_READABLE_TABLES`)
- 3.2 Memory persist has no `plan_propositions` table
- 3.3 Full suite passes: `npm test`
- 3.4 `context/deployment/deferred.md` has open **DEP-030** for hosted `db push` of this DROP (not applied in this change)

## Testing Strategy

Cheapest layer with signal: service + API tests already covering Accept and GET chat. Update source-scan UI tests. No Playwright.

## Performance Considerations

None. Fewer tables and one fewer Accept branch.

## Migration Notes

Dropping `plan_propositions` is irreversible on hosted without a restore. Any forgotten pending calendar row is discarded (desired). Apply after the Worker that no longer reads the table is deployed, or in the same release window: code that ignores the table can ship first, then DROP.

## Rollout Plan

1. Ship Phases 1–2 (ignore leftover rows).
2. Ship Phase 3 SQL locally (`npx supabase migration up --local`).
3. Hosted `db push` as **DEP-030**.

## References

- FU-125 (done, promoted here)
- `context/changes/chat-mutations-range-accept-admin/reviews/impl-review.md` F1
- `src/lib/services/chat.ts` `acceptProposition`
- `src/pages/api/chat/accept.ts`
- `src/pages/api/chat/dismiss.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Accept ignores calendar propositions

#### Automated

- [x] 1.1 `acceptProposition` with only `chat_profile_freeze_pending` still applies profile/freeze — b11d8ad
- [x] 1.2 `acceptProposition` with a leftover `plan_propositions` pending row plus profile/freeze pending applies **profile/freeze**, not the calendar units — b11d8ad
- [x] 1.3 Unit tests pass: `npm test -- src/lib/services/accept-proposition.test.ts src/lib/services/chat.test.ts` — b11d8ad
- [x] 1.4 Full suite passes: `npm test` — b11d8ad

#### Manual

- [x] 1.5 On `/dashboard`, a plan-only chat edit still lands without the Accept card
- [x] 1.6 A profile/freeze propose still shows the Accept card and Accept applies it

### Phase 2: Remove calendar pending I/O

#### Automated

- [x] 2.1 GET `/api/chat` body has no `proposition` key — f75d431
- [x] 2.2 `POST /api/chat/reject` is absent (404 or file deleted) — f75d431
- [x] 2.3 Full suite passes: `npm test` — f75d431
- [x] 2.4 Lint passes on touched files: `npm run lint` — f75d431

#### Manual

- [x] 2.5 Dismiss still clears the profile/freeze card without changing profile/frozen state

### Phase 3: Drop `plan_propositions` + hosted DEP

#### Automated

- [x] 3.1 `npm test -- src/lib/test/migration-safety.test.ts` — DROP is classified; distinctive payloads on remaining owner tables survive (table retired from `OWNER_READABLE_TABLES`) — 9dbc29b
- [x] 3.2 Memory persist has no `plan_propositions` table — 9dbc29b
- [x] 3.3 Full suite passes: `npm test` — 9dbc29b
- [x] 3.4 `context/deployment/deferred.md` has open **DEP-030** for hosted `db push` of this DROP (not applied in this change) — 9dbc29b
