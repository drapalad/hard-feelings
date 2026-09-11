# Coach and day panel can delete a calendar workout — Implementation Plan

## Overview

Chat and the day panel cannot remove a `training_units` row today: `UnitMutation` has no delete flag, `applyMutations` only upserts, and `incomingForWeek` re-seeds omitted dates outside the 14-day create horizon. This change adds option (a) `delete: true`, drops that date from the plan map (skip frozen on chat), persists a real `training_units` DELETE via `replaceWeek` leftover (and the same path from the day panel), and shows an empty Rest cell — never a 0 km recovery.

## Current State Analysis

- `UnitMutation` is `{ date, type?, distanceKm?, structure?, stages? }` (`src/types.ts`). Propose zod/JSON require `date, type, distanceKm, structure` with type/km/structure nullable; null means keep-existing (`src/lib/services/openai-chat.ts`).
- `sanitizeProposeResult` copies only non-null type/km/structure (`src/lib/services/propose-adaptation.ts`). `toRawProposeResult` round-trips mutations through that shape — a `delete` flag that is not copied here is stripped before `sendMessage` applies it.
- `applyMutations` uses `byDate.set` only; frozen dates are skipped when `skipFrozen !== false` (`src/lib/services/plan-adaptation.ts`). Non-delete mutations already preserve `stages` when omitted.
- Chat persist is week-shaped: `persistProposedUnits` → `incomingForWeek` → `replaceWeek`. `replaceWeek` already DELETEs ISO-week dates missing from the incoming list (`src/lib/services/plan.ts`) under `training_units_delete_own`. `mondaysToPersist` only unions Mondays of remaining proposed units that sit in the create horizon (`utcToday()`…+13), plus the request Monday.
- `incomingForWeek`: request week with no horizon overlap returns proposed-in-week only (omission persists). Horizon-overlap weeks seed existing **out-of-horizon** rows then overlay proposed dates — omitting an out-of-horizon date does **not** persist a removal.
- Day panel has Edit / Save / Cancel / Log / Freeze; no Delete (`src/components/plan/PlanCalendar.tsx`). `PUT /api/plan/units` is in-place UPDATE (`editUnit`); there is no unit DELETE route. `DELETE /api/plan/logs?date=` is the sibling pattern. `mergeWeekSlice` already drops week dates absent from the incoming list.
- Prompt: “Never emit a full replacement week.” (`systemPrompt` in `openai-chat.ts`). Calendar Save uses `skipFrozen: false` (FU-119); chat uses the default skip.

## Desired End State

A coach mutation `{ date, delete: true }` (and a day-panel **Delete workout** on a planned unit, not Rest) removes that user+date row. The in-month cell is empty (Rest / no type/km). Frozen chat mutations still no-op. Null type/km still mean keep-existing. Logs, freeze/generate, and `stages` on non-delete edits are unchanged. No `rest` workout type. No new table.

### Key Discoveries:

- `toRawProposeResult` (`propose-adaptation.ts:175`) is on the live `sendMessage` path (`chat.ts` `completeSendTurn`). Delete must survive that round-trip or LLM and test `complete()` payloads never land.
- Inferring deletes as “any date in `listWeek` missing from proposed” would leftover-DELETE every out-of-horizon keep-merge day. Persist must take an **explicit** deleted-date list from `mutation.delete === true`.
- `mondaysToPersist` must union Mondays of those deleted dates, or an out-of-horizon (or other-week) delete never reaches `replaceWeek`.
- Calendar `editUnit` UPDATEs one row and does not snapshot; `deleteUnit` should `applyMutations` + `replaceWeek` leftover (same DELETE as chat), return the remaining week for `mergeWeekSlice`, and keep the panel open (FU-093).
- `PlanCalendar.test.ts` source-scan of panel controls will fail unless **Delete workout** is locked; `product-gates.test.ts` must list a new JSON DELETE; `size="icon"` count stays 2 (month chevrons).

## What We're NOT Doing

- Option (b) type recovery / 0 km, or treating null type+km as delete
- A `rest` workout type
- Automatically deleting `workout_logs`
- Changing freeze or generate
- A new table or RLS policy (reuse `training_units` DELETE + `training_units_delete_own`)
- Playwright / e2e (test-plan §6.3)
- Concatenating Tailwind class strings (use `cn()` from `@/lib/utils`)
- Widening into Flag, coach notes, Make AI, load-chart tabs, ISO-week bleed, or stages-on-edit behavior except that a delete removes the whole unit

## Implementation Approach

Option (a) only: add `delete?: true` on `UnitMutation` and a required boolean `delete` on the OpenAI JSON schema (null type/km unchanged). `applyMutations` `Map.delete`s the date when `delete` is set (skip frozen unless `skipFrozen: false`). Chat persist threads explicit deleted dates through `mondaysToPersist` / `incomingForWeek` so leftover DELETE can fire, including out-of-horizon dates. Day panel **Delete workout** calls `DELETE /api/plan/units?date=` (logs pattern), which runs the same `applyMutations` + `replaceWeek` persist — not a client filter.

## Critical Implementation Details

**Timing & lifecycle** — `sendMessage` sanitizes via `toRawProposeResult` then `sanitizeProposeResult`. Both must copy `delete: true`. `persistProposedUnits` must see deleted dates even when those dates are absent from `plan.units`.

**User experience spec** — **Delete workout** only when `unit` is defined (not Rest). Keep the day panel open after success; the cell and panel read as Rest. Do not confirm. Do not POST a mock. Frozen days: calendar still deletes (`skipFrozen: false`, FU-144); chat still skips.

## Phase 1: Delete mutation contract

### Overview

Teach propose JSON, `UnitMutation`, sanitize/round-trip, the system prompt, and `applyMutations` about `delete: true`. Tests lock skip-frozen, no 0 km upsert, and stages preserved on non-delete edits.

### Changes Required:

#### 1. UnitMutation

**File**: `src/types.ts`

**Intent**: Callers can mark a date for removal without overloading null type/km.

**Contract**: `UnitMutation` gains optional `delete?: true` (or `boolean` that is only acted on when true). Do not change `TrainingUnit`. Null type/km remain keep-existing.

#### 2. Propose JSON + prompt

**File**: `src/lib/services/openai-chat.ts`

**Intent**: The model can emit one-date deletes; null type/km stay keep-existing; full-week replacement stays forbidden.

**Contract**: `parsedProposeSchema` mutation object adds `delete: z.boolean()` (optional on zod if the model omits it in tests; required boolean in `PROPOSE_JSON_SCHEMA` because `additionalProperties: false` / strict schema — add `delete` to `required` and `properties`). `systemPrompt`: allow a delete mutation for one date; keep “Never emit a full replacement week.” When `delete` is true, type/km may be null. Do not document null type+km as delete.

#### 3. Sanitize + round-trip

**File**: `src/lib/services/propose-adaptation.ts`

**Intent**: Delete flags from LLM JSON and from `complete()` test doubles survive `toRawProposeResult` → `sanitizeProposeResult`.

**Contract**: `RawProposeMutation` includes `delete?: boolean | null`. `sanitizeProposeResult` copies `delete: true` onto `UnitMutation` and still drops unknown dates / log XOR mutations. `toRawProposeResult` writes `delete: true` back onto the raw mutation (otherwise `completeSendTurn` strips it). Do not treat type and km both null as delete.

#### 4. applyMutations

**File**: `src/lib/services/plan-adaptation.ts`

**Intent**: A delete mutation removes the date from the plan map instead of upserting recovery/0 km.

**Contract**: When `mutation.delete` is true: if `skipFrozen && existing?.frozen`, continue; else `byDate.delete(mutation.date)` and skip create/upsert. Missing date is a no-op. Non-delete path unchanged (including `stages` preserve when omitted). `diffUnits` already emits `after: null` when a date disappears — no API change required.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/services/plan-adaptation.test.ts src/lib/services/propose-adaptation.test.ts src/lib/services/openai-chat.test.ts` passes
- `npm test` passes
- Touched-file lint: `npx eslint src/types.ts src/lib/services/openai-chat.ts src/lib/services/propose-adaptation.ts src/lib/services/plan-adaptation.ts src/lib/services/plan-adaptation.test.ts src/lib/services/propose-adaptation.test.ts src/lib/services/openai-chat.test.ts` passes (repo-wide `npm run lint` is red at HEAD on untouched training-load / pace-estimate files; do not edit those files)
- `npx astro check` passes

---

## Phase 2: Chat persist DELETE

### Overview

When applied mutations include `delete: true`, persist must DELETE that user+date row. `incomingForWeek` must not re-insert it from existing rows, including dates outside the create horizon. `replaceWeek` leftover DELETE is the write.

### Changes Required:

#### 1. persistProposedUnits / incomingForWeek / mondaysToPersist

**File**: `src/lib/services/chat.ts`

**Intent**: Chat apply can remove a date that `applyMutations` already dropped, including out-of-horizon dates the keep-merge would otherwise copy back.

**Contract**: Collect deleted dates from `proposed.mutations` where `delete === true` at the `sendMessage` apply site. Pass them into `persistProposedUnits` as an optional argument defaulting to `[]` so `acceptProposition` (pending units only, no mutation list) stays a no-op for deletes. `mondaysToPersist` unions `utcMondayOf` each deleted date (not only remaining in-horizon units). `incomingForWeek` must not `byDate.set` an existing row whose date is in that deleted set. Do not infer deletes by diffing the full week against proposed (that would leftover-DELETE keep-merge days). `replaceWeek` leftover DELETE stays the SQL write. Do not auto-delete logs. Do not change freeze/generate. `PlanWorkspace` already `mergeReturnedUnits`s Send `units` — no extra chat UI merge in this phase.

#### 2. Chat persist tests

**File**: `src/lib/services/chat.test.ts`

**Intent**: Memory-store oracle that a delete mutation removes the row and does not resurrect out-of-horizon dates.

**Contract**: Cookbook §6.2 (`createMemorySupabase`, do not mock persist services). Extend `complete()` to return `{ date, delete: true }`. Assert: in-horizon delete → no `training_units` row for that user+date, not a 0 km recovery; out-of-horizon delete on the request week (or another persisted week) → row gone; frozen delete via chat → row remains; other members’ rows unchanged. Cookbook §6.1 for `applyMutations` cases already in Phase 1.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/services/chat.test.ts` passes
- `npm test` passes
- Touched-file lint: `npx eslint src/lib/services/chat.ts src/lib/services/chat.test.ts` passes
- `npx astro check` passes

---

## Phase 3: Day-panel Delete workout

### Overview

A planned-unit day panel gains **Delete workout**, which DELETEs `/api/plan/units?date=` and merges the remaining week so the cell is Rest. Same persist as chat (apply delete + `replaceWeek` leftover). No mock.

### Changes Required:

#### 1. deleteUnit + replaceWeek leftover

**File**: `src/lib/services/plan.ts`

**Intent**: Calendar delete is a real persist of the same leftover DELETE, not an UPDATE-to-recovery.

**Contract**: Add `deleteUnit(client, userId, date)`: `listWeek` for `utcMondayOf(date)`; `NOT_FOUND` if that date has no unit; `applyMutations([{ date, delete: true }], { skipFrozen: false })` (calendar may delete frozen — FU-144 / FU-119); `replaceWeek` with the remaining units; return `{ ok, units, validation, undoAvailable, changed }` (no `unit` row — it is gone). `rejectPending` for that Monday matches PUT. Do not snapshot unless `editUnit` already does (it does not). Do not delete logs. Cover `deleteUnit` / leftover absence of the date in `src/lib/services/plan.test.ts` (same file as `unitEditSchema`).

#### 2. DELETE /api/plan/units

**File**: `src/pages/api/plan/units.ts`

**Intent**: Day panel has an authenticated JSON delete matching logs (`?date=`).

**Contract**: `export const prerender = false` already. `DELETE`: 401 via `unauthorized()` when `locals.user` is null; zod-parse `date` from `url.searchParams` (`weekStartSchema`); 400 `VALIDATION_ERROR` on bad date; `createClient` + `deleteUnit`; 404 `NOT_FOUND` / 500 `DB_ERROR`; 200 `{ units, validation, undoAvailable, changed, revisions }`. Extra `userId` query/body ignored; persisted owner is `locals.user.id`. Cookbook §6.4.

#### 3. Day panel + workspace merge

**Files**: `src/components/plan/PlanCalendar.tsx`, `src/components/plan/PlanWorkspace.tsx`

**Intent**: **Delete workout** on a unit (not Rest) writes through the API; the in-month cell becomes Rest.

**Contract**: Day panel: when `unit` is defined, a **Delete workout** control (read-only row, not Rest) calls `onDeleteUnit(date)` — not fetch from a mock, not POST. Merge classes with `cn()`. Do not add a third `size="icon"`. Keep Edit, Make AI, log `<details>`, Freeze. After success keep the panel open (FU-093). `PlanWorkspace`: `fetch('/api/plan/units?date=${date}', { method: 'DELETE', credentials: 'same-origin' })`; on 200 `mergeWeekSlice` the returned `units` for that Monday (drops the date). Do not clear logs.

#### 4. Gates, contracts, chrome locks

**Files**: `src/pages/api/product-gates.test.ts`, `src/pages/api/plan-contracts.test.ts`, `src/components/plan/PlanCalendar.test.ts`, `src/components/plan/PlanWorkspace.test.ts`, `src/lib/services/plan.test.ts`

**Intent**: 401, forged owner, persist oracle, and chrome are CI-locked without Playwright.

**Contract**: Add `DELETE /api/plan/units` to `GATES` (401 JSON, no Location, no units). Cookbook §6.4: missing/invalid date → 400 store unchanged; extra `userId` → 200 and session owner; other member’s row unchanged; success DELETEs the session row (not 0 km). Source-scan: `Delete workout`, `method: "DELETE"` on `/api/plan/units?date=`, keep Edit / Make AI / Freeze / `size="icon"` === 2. Cookbook §6.1.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/pages/api/product-gates.test.ts src/pages/api/plan-contracts.test.ts src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts src/lib/services/plan.test.ts` passes
- `npm test` passes
- Touched-file lint: `npx eslint src/lib/services/plan.ts src/pages/api/plan/units.ts src/components/plan/PlanCalendar.tsx src/components/plan/PlanWorkspace.tsx src/pages/api/product-gates.test.ts src/pages/api/plan-contracts.test.ts src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts src/lib/services/plan.test.ts` passes
- `npx astro check` passes

#### Manual Verification:

- Open an in-month day that has a workout; **Delete workout**; the cell is Rest (no type/km, not 0 km recovery); the panel stays open on that empty day; a Rest day has no **Delete workout**; chat “remove Friday” (when the model emits `delete: true`) removes that row the same way

---

## Testing Strategy

### Unit Tests:

- `applyMutations`: delete drops the date; frozen+default skip keeps it; `skipFrozen: false` drops frozen; create/upsert paths unchanged; stages still preserved when a non-delete mutation omits them
- `sanitizeProposeResult` / `toRawProposeResult`: `delete: true` round-trips; null type+km without delete still keep-existing; unknown dates dropped
- `PROPOSE_JSON_SCHEMA` / prompt: `delete` on mutation items; prompt still forbids a full replacement week and allows one-date delete
- Cookbook: test-plan §6.1

### Integration Tests:

- `sendMessage` + memory store: delete persist in-horizon and out-of-horizon; frozen chat skip; two-user isolation (test-plan §6.2)
- `DELETE /api/plan/units`: 401 (test-plan §6.4), invalid date, extra owner fields, victim row unchanged, session row removed
- Calendar/workspace source-scan for **Delete workout** and DELETE fetch

### Manual Testing Steps:

1. Dashboard calendar: delete a planned in-month workout; cell is Rest
2. Confirm Rest days have no **Delete workout**; log on that date (if any) remains
3. Optional: coach chat asking to remove a day, if the keyed model emits `delete: true`

## Performance Considerations

One extra `.delete()` per leftover date already exists in `replaceWeek`. Calendar delete rewrites at most one ISO week. No extra LLM round-trip.

## Migration Notes

No new migration. Hosted DELETE already ships with `training_units_delete_own` (DEP-009). Worker rollback does not need SQL.

## References

- Locked spec: `context/changes/chat-delete-units/change.md`
- Research: `context/changes/chat-delete-units/research.md`
- RLS: `supabase/migrations/20260813130000_training_units.sql`
- Test cookbook: `context/foundation/test-plan.md` §6
- FU-119 (chat skip frozen / calendar Save does not), FU-093 (keep panel open), FU-144 (calendar Delete on frozen)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Delete mutation contract

#### Automated

- [x] 1.1 `npm test -- src/lib/services/plan-adaptation.test.ts src/lib/services/propose-adaptation.test.ts src/lib/services/openai-chat.test.ts` passes — 23a6098
- [x] 1.2 `npm test` passes — 23a6098
- [x] 1.3 Touched-file lint: `npx eslint src/types.ts src/lib/services/openai-chat.ts src/lib/services/propose-adaptation.ts src/lib/services/plan-adaptation.ts src/lib/services/plan-adaptation.test.ts src/lib/services/propose-adaptation.test.ts src/lib/services/openai-chat.test.ts` passes (repo-wide `npm run lint` is red at HEAD on untouched training-load / pace-estimate files; do not edit those files) — 23a6098
- [x] 1.4 `npx astro check` passes — 23a6098

### Phase 2: Chat persist DELETE

#### Automated

- [x] 2.1 `npm test -- src/lib/services/chat.test.ts` passes — 7db0daa
- [x] 2.2 `npm test` passes — 7db0daa
- [x] 2.3 Touched-file lint: `npx eslint src/lib/services/chat.ts src/lib/services/chat.test.ts` passes — 7db0daa
- [x] 2.4 `npx astro check` passes — 7db0daa

### Phase 3: Day-panel Delete workout

#### Automated

- [x] 3.1 `npm test -- src/pages/api/product-gates.test.ts src/pages/api/plan-contracts.test.ts src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts src/lib/services/plan.test.ts` passes — 0192def
- [x] 3.2 `npm test` passes — 0192def
- [x] 3.3 Touched-file lint: `npx eslint src/lib/services/plan.ts src/pages/api/plan/units.ts src/components/plan/PlanCalendar.tsx src/components/plan/PlanWorkspace.tsx src/pages/api/product-gates.test.ts src/pages/api/plan-contracts.test.ts src/components/plan/PlanCalendar.test.ts src/components/plan/PlanWorkspace.test.ts src/lib/services/plan.test.ts` passes — 0192def
- [x] 3.4 `npx astro check` passes — 0192def

#### Manual

- [ ] 3.5 Open an in-month day that has a workout; **Delete workout**; the cell is Rest (no type/km, not 0 km recovery); the panel stays open on that empty day; a Rest day has no **Delete workout**; chat “remove Friday” (when the model emits `delete: true`) removes that row the same way
