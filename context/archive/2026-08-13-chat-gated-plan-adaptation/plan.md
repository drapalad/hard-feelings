# Chat-Gated Plan Adaptation Implementation Plan

## Overview

Add member chat on the dashboard so a signed-in runner can ask what a unit is for, report life context, or request a day change; see a calendar diff with F-01 validator output; then accept, reject, or continue. Hard-bound proposals cannot land. This is roadmap S-03 (US-01, FR-006, FR-007, FR-008) — the north-star loop after S-02’s generated week.

## Current State Analysis

S-02 is on disk: `training_units` + RLS, `GET`/`POST /api/plan`, `PATCH /api/plan/units`, dashboard `PlanCalendar` island. Generate persists a 7-day week via `replaceWeek`. Freeze is a flag only.

F-01 is on disk: `validatePlan(plan, { weeklyKm, frozenUnits })` returns `{ hard, soft }`. Bound codes are `WEEKLY_VOLUME_EXCEEDED`, `CONSECUTIVE_LONGS`, `FROZEN_ANCHOR_DROPPED`. F-01’s handoff: S-03 applies a diff, then calls the **same** `validatePlan` — do not invent a second bound surface.

There is no chat table, no chat API, no LLM client, no AI env vars, and no Workers AI binding. `PROTECTED_ROUTES` is still `["/dashboard"]` only. JSON APIs return 401 via `unauthorized()`. DEP-002 (Workers Paid when AI chat ships) is open; DEP-009 (`training_units` hosted) is open.

`replaceWeek` upserts the given dates and does **not** run validators. Nothing currently persists an arbitrary proposed week except generate.

## Desired End State

A signed-in member with a generated week can send a chat message, get an assistant reply, and — when the reply proposes calendar changes — see a per-day type/km diff plus `validation.soft` / `validation.hard`. They can Accept (lands only if `hard.length === 0`, including a server re-check), Reject (discards the pending proposition), or continue chatting. Explanation-only replies have no Accept. Another member cannot read these rows. Unauthenticated chat JSON returns 401; `/api/chat*` is not on `PROTECTED_ROUTES`.

### Key Discoveries:

- `validatePlan` is the only bound implementation (`src/lib/services/validate-plan.ts`). Accept gating is `validation.hard.length === 0`. Soft does not block.
- `replaceWeek` (`src/lib/services/plan.ts`) can persist a proposed week without calling `generatePlan`. Accept must validate first, then `replaceWeek` the merged week (all seven dates so omitted days are not left stale — upsert the **full** merged plan).
- JSON APIs must not join `PROTECTED_ROUTES` (`src/middleware.ts`) — HTML redirect would break `fetch`.
- Calendar dates are `YYYY-MM-DD` with UTC Monday weeks (`src/lib/dates.ts`). Never `new Date("YYYY-MM-DD")`.
- Dashboard is a single column (`max-w-5xl`) with `SetupForm` + `PlanCalendar`, both `client:load`. Chat must share `weekStart` with the calendar or week nav and the thread will drift.
- Roadmap LLM-provider unknown is **non-blocking**. No OpenAI/Workers AI secrets exist. Conservative ship: deterministic `proposeAdaptation` behind a narrow interface so a later fetch-based LLM can replace the stub without changing accept.
- Hosted SQL is a separate DEP. This slice’s migrations need **DEP-010**. Do not close DEP-001–DEP-009. Leave DEP-002 open (stub is not live LLM; Paid is still the follow-up when a fetch LLM ships).

## What We're NOT Doing

- Calling a hosted LLM, adding AI SDK deps, Workers AI bindings, or `astro:env` LLM secrets.
- Closing or implementing DEP-002 (Workers Paid). Note in DEP-010/plan that the stub does not require Paid.
- Replacing `generatePlan` / `validatePlan` with an LLM planner (PRD non-goal).
- Renaming or adding BoundCode values.
- Manual type/km edit, undo, version restore (S-04).
- Workout logging (S-05).
- Admin gap reports / algorithm proposals (S-06). Persisted messages are member-scoped only; no admin UI.
- Adding `/api/*` to `PROTECTED_ROUTES`, service-role Supabase, or client-exposed secrets.
- Playwright / jsdom / CI Supabase.
- `supabase login` / hosted `db push`.
- Streaming tokens, multi-week chat in one thread, or storing validation on `training_units`.

## Implementation Approach

Deterministic proposer turns a member message + current week into a reply and optional per-date mutations. Mutations merge onto the current week → `Plan` → `validatePlan` → derived diff. Persist the thread and at most one **pending** proposition per member per week. Accept reloads weekly km + current frozen flags, runs `validatePlan` on the stored proposed-week snapshot, refuses on hard, otherwise `replaceWeek`. Dashboard: one `PlanWorkspace` island owns week state and composes calendar + chat.

## Critical Implementation Details

**One bound surface.** After applying mutations, call `validatePlan` from `src/lib/services/validate-plan.ts`. Do not copy volume/long/freeze rules into chat. Accept must call it again on the server even if the client hides the button.

**Accept never trusts the client.** `POST /api/chat/accept` loads the pending row’s stored `proposed_units` snapshot (already a full-week `TrainingUnit[]` in camelCase DTO JSON — not DB snake_case). It does **not** re-apply mutations onto a newer generate. It reloads `getProfile().weeklyKm` and current-week frozen units, runs `gateAccept` / `validatePlan`, and only then `replaceWeek` that snapshot. If `hard.length > 0` → 409 `{ error: { code: "HARD_BOUNDS", message }, validation }` (validation is a sibling of `error` so the island can render bounds); calendar unchanged.

**Full-week persist.** On send, `proposed_units` is `applyMutations(currentWeek, mutations).units` (seven days). `replaceWeek` that array so omitted dates cannot linger. Unknown dates outside the week window are ignored by existing `replaceWeek`.

**Stub, not LLM.** `proposeAdaptation({ message, weekStart, units })` is a pure function with pinned phrases (Phase 2). No `fetch` to a model. Interface stays swappable.

**JSON APIs are not `PROTECTED_ROUTES`.** 401 via `unauthorized()`. try/catch DB → `DB_ERROR`. Missing Supabase → 503 `UNAVAILABLE`.

**UTC weekdays.** Week Monday = `weekDates(weekStart)[0]`. Map English weekday names onto that array. Do not use local `Date#getDay()`.

---

## Phase 1: Chat schema and RLS

### Overview

Persist member chat and one pending proposition per week so Accept survives reload and S-06 can later read history without a new table shape.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_chat_gated_adaptation.sql` (new; timestamp at implement time)

**Intent**: Store the thread and the pending calendar proposition with RLS so only the owner can read/write.

**Contract**:

- `chat_messages`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`; `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`; `week_start date NOT NULL`; `role text NOT NULL` with `CHECK (role IN ('user','assistant'))`; `content text NOT NULL`; `created_at timestamptz NOT NULL DEFAULT now()`.
- `plan_propositions`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`; `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`; `week_start date NOT NULL`; `proposed_units jsonb NOT NULL`; `validation jsonb NOT NULL`; `status text NOT NULL` with `CHECK (status IN ('pending','accepted','rejected'))`; `created_at timestamptz NOT NULL DEFAULT now()`. Partial unique index: one `pending` row per `(user_id, week_start)`.
- `ENABLE ROW LEVEL SECURITY` on both tables; four policies each (SELECT, INSERT, UPDATE, DELETE) using `auth.uid() = user_id`. No combined ALL policy.

#### 2. Deploy backlog

**File**: `context/deployment/deferred.md`

**Intent**: Hosted SQL is not undone by Worker rollback.

**Contract**: Append **DEP-010** (next free id): apply this migration to the hosted project behind `SUPABASE_URL`; Source = this plan. Leave DEP-001–DEP-009 unchanged (002 stays open; 009 stays open).

### Success Criteria:

#### Automated Verification:

- `supabase/migrations/` contains a `*_chat_gated_adaptation.sql` file with `chat_messages` and `plan_propositions` as specified (role/status checks, pending unique, FK to `auth.users`)
- Both tables enable RLS with separate SELECT, INSERT, UPDATE, and DELETE policies on `auth.uid() = user_id`
- `context/deployment/deferred.md` has an open DEP-010 for this migration; DEP-001–DEP-009 statuses are unchanged

---

## Phase 2: Diff, proposer stub, and accept gate

### Overview

Lock merge/diff/`validatePlan` gating and the deterministic intents in Vitest before HTTP.

### Changes Required:

#### 1. Shared DTOs

**File**: `src/types.ts`

**Intent**: Chat DTOs live with other entity types so APIs and the island share one shape.

**Contract**: Add `ChatRole`, `ChatMessage` (`id`, `role`, `content`, `createdAt`, `weekStart`), `UnitMutation` (`date` plus optional `type` / `distanceKm` / `structure`), `PlanDiffEntry` (`date`, `before: TrainingUnit | null`, `after: TrainingUnit | null`), `PlanProposition` (`id`, `weekStart`, `proposedUnits: TrainingUnit[]`, `validation: ValidateResult`, `diff: PlanDiffEntry[]`, `status`). Do not add BoundCode values.

#### 2. Merge, diff, accept decision

**File**: `src/lib/services/plan-adaptation.ts` (new), colocated `src/lib/services/plan-adaptation.test.ts`

**Intent**: Pure functions so accept and the proposer share one merge/validate path.

**Contract**:

- `applyMutations(units: TrainingUnit[], mutations: UnitMutation[]): Plan` — for each mutation, replace the unit on that date (keep unspecified fields; set `frozen` from the existing unit). Unknown dates are ignored. Sort units by date.
- `diffUnits(current: TrainingUnit[], proposed: TrainingUnit[]): PlanDiffEntry[]` — entries only where type, distanceKm, structure, or frozen differ (or a date exists on one side only).
- `gateAccept(plan: Plan, weeklyKm: number, frozenUnits: TrainingUnit[]): { ok: true; validation } | { ok: false; validation }` — calls `validatePlan`; `ok` iff `hard.length === 0`. Soft may be non-empty on `ok: true`.

#### 3. Deterministic proposer

**File**: `src/lib/services/propose-adaptation.ts` (new), colocated test

**Intent**: Cover FR-006/007 without an LLM. Pin phrases so the implementer and tests agree.

**Contract**: `proposeAdaptation({ message, weekStart, units }): { reply: string; mutations: UnitMutation[] }`. Case-insensitive. Resolve weekdays against `weekDates(weekStart)`: monday…sunday → indices 0…6. Also accept a `YYYY-MM-DD` in the message if it falls in that week.

Intent order (first match wins):

1. **Explain** — message matches `what` + (`for` or `unit`) or contains `explain`. Mutations `[]`. Reply names that day’s type and km and a canned purpose by type (`base` aerobic foundation; `recovery` easy absorption; `tempo` comfortably hard; `threshold` lactate-threshold work; `anaerobic` short hard repeats; `long` endurance for the A race). Date: weekday/ISO if present, else the first unit in the week.
2. **Life context** — message matches `sleep`, `tired`, `exhausted`, `sick`, `ill`, `busy`, or `stressed`. Mutate the highest-load **unfrozen** day (type rank: `long` > `anaerobic` > `threshold` > `tempo` > `base` > `recovery`; tie-break larger `distanceKm`, then earlier date) to `type: "recovery"` and `distanceKm` at 50% of that day’s current km (keep frozen flag). If every day is frozen, mutations `[]` and reply says frozen anchors cannot be changed this way.
3. **Set km** — `make <weekday-or-date> <number> km` (number is finite ≥ 0). Mutation `{ date, distanceKm }`. This is the volume-bound fixture (e.g. 200 km → hard `WEEKLY_VOLUME_EXCEEDED`).
4. **Change type** — `make|change|set|turn` plus a weekday/date plus a `WorkoutType`. Mutation `{ date, type }`. If that day is frozen, still emit the mutation so accept hits `FROZEN_ANCHOR_DROPPED`.
5. **Unrecognized** — help text listing the three jobs (explain / life context / change a day). Mutations `[]`.

Do not call `generatePlan`. Do not call `validatePlan` inside the proposer (the send service does that after merge).

### Success Criteria:

#### Automated Verification:

- `applyMutations` copies unspecified days; changing one day’s type leaves others intact; frozen flag is preserved from the existing unit
- `gateAccept` returns `ok: true` with soft `WEEKLY_VOLUME_EXCEEDED` when over weekly km but ≤ 120%; `ok: false` when over 120%, when two adjacent UTC days are `long`, or when a frozen unit’s type/km/`frozen` is mutated
- `proposeAdaptation` on week `2026-08-10` with a Tuesday `tempo` 10 km: `"what is Tuesday for"` → no mutations, reply includes `tempo` and `10`
- `"poor sleep"` on a week with an unfrozen `long` → that date becomes `recovery` at half km
- `"make Wednesday a long"` when Tuesday is already `long` → mutation only; `gateAccept` after apply is `ok: false` with `CONSECUTIVE_LONGS`
- `"make Friday 200 km"` → `gateAccept` `ok: false` with `WEEKLY_VOLUME_EXCEEDED`
- `npm test` exits 0
- `npm run lint` exits 0

---

## Phase 3: Chat services and APIs

### Overview

Authenticated JSON: list thread + pending proposition, send a message, accept, reject.

### Changes Required:

#### 1. Data services

**File**: `src/lib/services/chat.ts` (new)

**Intent**: Handlers stay parse → authorize → service → respond. Cookie SSR client only.

**Contract**: Functions take a Supabase client plus `user.id`. `weekStart` is Monday-normalized via existing `resolveWeekStart` / `utcMondayOf`.

- `listChat(client, userId, weekStart)` → `{ messages: ChatMessage[]; proposition: PlanProposition | null }`. Pending proposition only (`status = pending`). Build `diff` via `diffUnits(listWeek(...), proposedUnits)`.
- `sendMessage(client, userId, weekStart, content)`:
  - Trim content; empty → typed `VALIDATION_ERROR`.
  - `listWeek`; if no units → typed `PLAN_EMPTY`.
  - `getProfile`; if `weeklyKm` is `null` → typed `MISSING_WEEKLY_KM`; if `weeklyKm <= 0` → typed `INVALID_WEEKLY_KM` (F-01 codes; do not invent `KM_NOT_SET`).
  - Insert user `chat_messages` row.
  - `proposeAdaptation` → `applyMutations` → `validatePlan` with current frozen units.
  - Insert assistant row with `reply`.
  - If `mutations.length > 0`: set any existing `pending` row for that week to `rejected` (do not delete — keep history), then insert pending `{ proposed_units: merged full-week TrainingUnit[], validation, status: pending }`.
  - If no mutations: leave an existing pending proposition in place (continue chat).
  - Return `{ messages` (at least the new pair), `proposition }`.
- `acceptProposition(client, userId, weekStart)`:
  - Load pending; none → `NO_PENDING_PROPOSITION`.
  - Reload profile; `weeklyKm` null → `MISSING_WEEKLY_KM`; `weeklyKm <= 0` → `INVALID_WEEKLY_KM`. Frozen anchors = current `listWeek` rows with `frozen === true` (a freeze after the proposition can still hard-block accept).
  - Proposed plan = stored camelCase `proposed_units` as `TrainingUnit[]` (ignore dates outside the week window). Do not re-merge onto a regenerated week.
  - `gateAccept`; if not ok → do **not** write `training_units`; return `{ ok: false, code: "HARD_BOUNDS", validation }`.
  - Else `replaceWeek` with proposed units, set proposition `accepted`, return `{ ok: true, weekStart, units, validation }`.
- `rejectProposition(client, userId, weekStart)`: pending → `rejected`; none → `NO_PENDING_PROPOSITION`.

Do not use a service-role client.

#### 2. HTTP routes

**File**: `src/pages/api/chat.ts`, `src/pages/api/chat/messages.ts`, `src/pages/api/chat/accept.ts`, `src/pages/api/chat/reject.ts` (new)

**Intent**: Cookie JSON for the chat island; 401 must be JSON.

**Contract**: Each file exports `const prerender = false`. No user → `unauthorized()`. Bodies via zod (`weekStart` optional `YYYY-MM-DD`; messages also `content: z.string().min(1)`). Invalid date → 400 `VALIDATION_ERROR`. try/catch → 500 `DB_ERROR`. No client → 503 `UNAVAILABLE`.

- `GET /api/chat?weekStart=` → `{ weekStart, messages, proposition }`. Omitted `weekStart` → `utcMondayOf(utcToday())`.
- `POST /api/chat/messages` body `{ weekStart?, content }` → same omit/normalize; 400 `PLAN_EMPTY` / `MISSING_WEEKLY_KM` / `INVALID_WEEKLY_KM` / `VALIDATION_ERROR`; success `{ weekStart, messages, proposition }`.
- `POST /api/chat/accept` body `{ weekStart? }` → 400 `NO_PENDING_PROPOSITION` / `MISSING_WEEKLY_KM` / `INVALID_WEEKLY_KM`; 409 `{ error: { code: "HARD_BOUNDS", message }, validation }` when hard; success `{ weekStart, units, validation }`.
- `POST /api/chat/reject` body `{ weekStart? }` → 400 `NO_PENDING_PROPOSITION`; success `{ weekStart, proposition: null }`.

Do not add these paths to `PROTECTED_ROUTES`.

### Success Criteria:

#### Automated Verification:

- Chat API files export `prerender = false`
- Handlers return 401 JSON (not a redirect) when `locals.user` is missing
- `PROTECTED_ROUTES` still does not include `/api/chat`
- `acceptProposition` (or a helper it calls with no I/O) returns `{ ok: false, code: "HARD_BOUNDS", validation }` when `gateAccept` fails and does not invoke `replaceWeek`; soft-only `gateAccept` is `{ ok: true }` (Phase 2 already pins the bound cases — this row is the persist-skip invariant)
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

---

## Phase 4: Chat UI on the dashboard

### Overview

Member-visible loop: message → reply + optional diff/warnings → Accept / Reject / continue. Calendar and chat share one week.

### Changes Required:

#### 1. Workspace island

**File**: `src/pages/dashboard.astro`, new `src/components/plan/PlanWorkspace.tsx`, `src/components/plan/PlanChat.tsx`; `PlanCalendar.tsx` becomes a presentational child (or keeps fetch if workspace lifts state — prefer lifting so one `weekStart` drives both).

**Intent**: Interactivity needs an island; first paint should show server-loaded week **and** existing messages/pending proposition.

**Contract**:

- `dashboard.astro` stays on `PROTECTED_ROUTES`. Server-load current UTC week via `listWeek` + `listChat`. Replace the `PlanCalendar` hydrate with `PlanWorkspace client:load` passing `{ weekStart, units, messages, proposition }`. Keep `SetupForm`. Widen the content column (e.g. `max-w-6xl` / `max-w-7xl`) so calendar | chat fit on large screens (`lg:grid-cols-2`); stack on small screens.
- `PlanWorkspace` owns `weekStart` / `units` / chat state. Prev/next week loads `GET /api/plan` **and** `GET /api/chat`. Generate still `POST /api/plan`. After successful accept, units update from the accept response (calendar reflects the new week without a full page reload).
- `PlanChat`: message list (user/assistant); textarea + send `POST /api/chat/messages`; when `proposition` is pending, show `diff` (date, before type/km → after type/km) and validator lists (soft amber, hard red). **Accept** enabled only when `validation.hard.length === 0`; still handle 409 `HARD_BOUNDS` if the server refuses. **Reject** always enabled when pending. Continue = send another message. Empty week: copy that they must generate a plan first (do not invent a generate button inside chat).
- `fetch` with `credentials: "same-origin"`. Surface `{ code, message }` via `ServerError`. Reuse `Button` and `cn()`. No `"use client"`. No type/km editors.

### Success Criteria:

#### Automated Verification:

- `src/pages/dashboard.astro` hydrates `PlanWorkspace` (calendar + chat) in addition to `SetupForm`
- Chat UI has send, and Accept is not rendered as enabled when the pending proposition has `validation.hard.length > 0`
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Sign in; generate a week; ask what a weekday is for — reply with no Accept (or Accept hidden); calendar unchanged
- Report poor sleep — see a recovery diff; Accept updates the calendar; reload keeps the change
- Reject a proposition — calendar unchanged; pending diff gone
- Produce a hard-bound proposition (consecutive longs or 200 km day) — Accept disabled or 409; calendar unchanged after attempting accept
- Continue chat after a pending diff (explanation message) — pending diff remains until Accept or Reject

---

## Testing Strategy

### Unit Tests:

- `applyMutations` / `diffUnits` / `gateAccept` (soft vs hard vs frozen).
- `proposeAdaptation` phrases pinned in Phase 2.
- Accept path refuses hard without persisting (mock or pure gate; do not require Supabase in CI).
- Existing `unauthorized()` 401 JSON test remains; chat handlers: source inspection for `prerender = false` + early `unauthorized()`, same as S-02.

### Integration Tests:

- None in CI. Local `npx supabase db reset` proves the new migration applies; not a Progress Manual row.

### Manual Testing Steps:

1. Local Supabase + migrations; sign in; km + A race; Generate.
2. Explain / poor sleep accept / reject / hard-bound non-accept / continue with pending diff.
3. Confirm calendar has no type/km editors (still S-04).

## Performance Considerations

One week of messages and one pending proposition. No streaming. Stub proposer is CPU-cheap. Do not close DEP-002 for this slice.

## Migration Notes

Additive tables. Local: `npx supabase db reset` (or `migration up`) after start. Hosted: apply via DEP-010 **before** expecting production chat persist. Rolling back the Worker does not drop chat tables. No backfill.

## References

- Roadmap S-03: `context/foundation/roadmap.md`
- PRD: US-01, FR-006, FR-007, FR-008, NFR hard bounds — `context/foundation/prd.md`
- F-01: `src/lib/services/validate-plan.ts`, `src/types.ts`
- S-02: `src/lib/services/plan.ts`, `src/pages/api/plan.ts`, `src/components/plan/PlanCalendar.tsx`
- AGENTS: zod APIs, `prerender = false`, RLS migrations, `PROTECTED_ROUTES`, `cn()`
- Deploy backlog: `context/deployment/deferred.md` (DEP-002 leave open; append DEP-010)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Chat schema and RLS

#### Automated

- [x] 1.1 `supabase/migrations/` contains a `*_chat_gated_adaptation.sql` file with `chat_messages` and `plan_propositions` as specified (role/status checks, pending unique, FK to `auth.users`) — 1344b88
- [x] 1.2 Both tables enable RLS with separate SELECT, INSERT, UPDATE, and DELETE policies on `auth.uid() = user_id` — 1344b88
- [x] 1.3 `context/deployment/deferred.md` has an open DEP-010 for this migration; DEP-001–DEP-009 statuses are unchanged — 1344b88

### Phase 2: Diff, proposer stub, and accept gate

#### Automated

- [x] 2.1 `applyMutations` copies unspecified days; changing one day’s type leaves others intact; frozen flag is preserved from the existing unit — 2eb9f8b
- [x] 2.2 `gateAccept` returns `ok: true` with soft `WEEKLY_VOLUME_EXCEEDED` when over weekly km but ≤ 120%; `ok: false` when over 120%, when two adjacent UTC days are `long`, or when a frozen unit’s type/km/`frozen` is mutated — 2eb9f8b
- [x] 2.3 `proposeAdaptation` on week `2026-08-10` with a Tuesday `tempo` 10 km: `"what is Tuesday for"` → no mutations, reply includes `tempo` and `10` — 2eb9f8b
- [x] 2.4 `"poor sleep"` on a week with an unfrozen `long` → that date becomes `recovery` at half km — 2eb9f8b
- [x] 2.5 `"make Wednesday a long"` when Tuesday is already `long` → mutation only; `gateAccept` after apply is `ok: false` with `CONSECUTIVE_LONGS` — 2eb9f8b
- [x] 2.6 `"make Friday 200 km"` → `gateAccept` `ok: false` with `WEEKLY_VOLUME_EXCEEDED` — 2eb9f8b
- [x] 2.7 `npm test` exits 0 — 2eb9f8b
- [x] 2.8 `npm run lint` exits 0 — 2eb9f8b

### Phase 3: Chat services and APIs

#### Automated

- [x] 3.1 Chat API files export `prerender = false` — 8ea8c5f
- [x] 3.2 Handlers return 401 JSON (not a redirect) when `locals.user` is missing — 8ea8c5f
- [x] 3.3 `PROTECTED_ROUTES` still does not include `/api/chat` — 8ea8c5f
- [x] 3.4 `acceptProposition` (or a helper it calls with no I/O) returns `{ ok: false, code: "HARD_BOUNDS", validation }` when `gateAccept` fails and does not invoke `replaceWeek`; soft-only `gateAccept` is `{ ok: true }` (Phase 2 already pins the bound cases — this row is the persist-skip invariant) — 8ea8c5f
- [x] 3.5 `npm test` exits 0 — 8ea8c5f
- [x] 3.6 `npm run lint` exits 0 — 8ea8c5f
- [x] 3.7 `npm run build` exits 0 — 8ea8c5f

### Phase 4: Chat UI on the dashboard

#### Automated

- [x] 4.1 `src/pages/dashboard.astro` hydrates `PlanWorkspace` (calendar + chat) in addition to `SetupForm` — b865885
- [x] 4.2 Chat UI has send, and Accept is not rendered as enabled when the pending proposition has `validation.hard.length > 0` — b865885
- [x] 4.3 `npm run lint` exits 0 — b865885
- [x] 4.4 `npm run build` exits 0 — b865885

#### Manual

- [ ] 4.5 Sign in; generate a week; ask what a weekday is for — reply with no Accept (or Accept hidden); calendar unchanged
- [ ] 4.6 Report poor sleep — see a recovery diff; Accept updates the calendar; reload keeps the change
- [ ] 4.7 Reject a proposition — calendar unchanged; pending diff gone
- [ ] 4.8 Produce a hard-bound proposition (consecutive longs or 200 km day) — Accept disabled or 409; calendar unchanged after attempting accept
- [ ] 4.9 Continue chat after a pending diff (explanation message) — pending diff remains until Accept or Reject
