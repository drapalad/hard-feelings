# Workout Logging Implementation Plan

## Overview

Let a signed-in member record that they completed a planned workout — from the calendar or from chat — without changing the prescribed plan. This is roadmap S-05 (FR-009). Generate, freeze, manual edit/undo, and chat accept/reject stay as they are. External tracker sync (FR-010) stays parked.

## Current State Analysis

S-02 is on disk: `training_units` (one row per member per date), `GET`/`POST /api/plan`, freeze `PATCH`, dashboard `PlanCalendar` via `PlanWorkspace`. S-03 is on disk: deterministic `proposeAdaptation` (explain / life / set-km / change-type) → pending proposition → Accept `replaceWeek`. S-04 is on disk: `PUT` edit, `plan_revisions` undo stack, Undo control. `applyMutations` patches existing dates only. `replaceWeek` / generate / Accept overwrite `training_units` with no completion history.

There is no completed/actual/log column, no `workout_logs` table, and no chat “I completed Tuesday” intent (that phrase is unrecognized help). `PROTECTED_ROUTES` is still `["/dashboard"]` only. JSON APIs return 401 via `unauthorized()`. shadcn inventory is `Button` only. DEP-012 (`plan_revisions` hosted) is the latest SQL DEP. Next free deploy id is **DEP-013**.

## Desired End State

A signed-in member with a generated week can mark a filled day completed. The calendar shows a Logged badge with the recorded km; reload still shows it. They can Unlog. Chat phrases like “I completed Tuesday” or “logged Wednesday 8 km” persist a log immediately (no Accept, no `training_units` write). Empty days have no Log control. Logs survive generate, chat Accept, and Undo. Another member cannot read logs. Unauthenticated JSON returns 401; `/api/plan*` and `/api/chat*` stay off `PROTECTED_ROUTES`.

### Key Discoveries:

- `replaceWeek` (generate, Accept, Undo) rewrites `training_units`. A `completed` column on that table would be wiped. Logs must live in a **separate** table.
- Chat Accept exists to gate **plan mutations** (FR-006/008). FR-009 is a completion record. “I completed Tuesday” must not open a proposition and must not call `replaceWeek`.
- `proposeAdaptation` is first-match. A log intent must run **after** explain and **before** life/set-km/change-type so “what is Tuesday for” stays explain and “completed Tuesday” does not fall through to help.
- `applyMutations` skips unknown dates — same rule for logging: no unit on that date → `NOT_FOUND` / chat “I don't see a workout on that day.”
- `plan.ts` must not import `chat.ts` (S-04 cycle). A new `workout-log.ts` is imported by plan **routes** and by `chat.ts`, never the other way.
- JSON APIs must not join `PROTECTED_ROUTES`. Cookie SSR `createClient` only. RLS isolation.
- UTC `YYYY-MM-DD` via `utcMondayOf` / `weekDates`. Never `new Date("YYYY-MM-DD")`.
- Hosted SQL is a separate DEP: this slice needs **DEP-013**. Do not close DEP-001–DEP-012.

## What We're NOT Doing

- Logging empty / off-plan days (no unit on that date). Creating units from a log.
- Mutating `training_units` (type/km/frozen/structure) when logging. That remains edit / freeze / generate / Accept.
- Routing completion through `plan_propositions` or Accept/Reject. `validatePlan` / hard bounds on a log write.
- Clearing logs on generate, Accept, or Undo. Feeding logs into `generatePlan` (algorithm still S-02 stub; S-06 later).
- Notes / RPE / duration fields. Multiple logs per date. External workout-tracking sync (FR-010).
- LLM chat (S-07), Admin (S-06), BoundCode changes, algorithm rewrite, version picker (FU-001).
- Adding `/api/*` to `PROTECTED_ROUTES`, service-role Supabase, or client-exposed secrets.
- New shadcn Dialog/Input/Select — existing `Button` / `ServerError` / `cn()`.
- Playwright / jsdom / CI Supabase / hosted `db push`.
- Closing DEP-001–DEP-012.

## Implementation Approach

Add `workout_logs` (one row per member per date, RLS). Pure `resolveWorkoutLog` copies planned type and km (optional km override). Calendar POST upserts / DELETE removes. Chat: new `proposeAdaptation` log intent returns `{ log, mutations: [] }`; `sendMessage` upserts and skips pending. `GET /api/plan` returns `logs` for the week. Dashboard: Log / Unlog on filled cells.

## Critical Implementation Details

**Logs are not plan rows.** Never add `completed` to `training_units`. Never call `replaceWeek` or `rejectPending` from the log write path.

**Log intent is not a mutation.** If `ProposeResult.log` is set, `mutations` must be empty, `sendMessage` must not `insertPending`, and `gateAccept` is unused for that turn.

**Upsert, don’t append.** `UNIQUE (user_id, date)`. Re-logging a day overwrites type/km from the **current** planned unit (plus optional km). Unlog deletes the row.

**`GET /api/plan` grows additively:** `{ weekStart, units, undoAvailable, logs }`. Generate POST need not return `logs` — the client keeps existing week logs (they survive replace). Chat POST `/api/chat/messages` success body adds `logs` so a chat log updates the calendar without a second fetch.

**Chat still requires a week + weeklyKm.** Do not split `sendMessage` preconditions for log phrases; `PLAN_EMPTY` / missing km still apply. Logging via the calendar button does not need weeklyKm.

---

## Phase 1: Schema and RLS

### Overview

Store completion records so generate/Accept/Undo cannot erase them with `training_units`.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_workout_logs.sql` (new; timestamp at implement time)

**Intent**: Durable per-day completion log, isolated by RLS, independent of Worker rollback.

**Contract**:

- `workout_logs`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`; `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`; `date date NOT NULL`; `type text NOT NULL` with the same six-type CHECK as `training_units`; `distance_km numeric NOT NULL` with `>= 0` CHECK; `created_at timestamptz NOT NULL DEFAULT now()`; `UNIQUE (user_id, date)`.
- `ENABLE ROW LEVEL SECURITY` and granular SELECT, INSERT, UPDATE, DELETE policies (`auth.uid() = user_id`). No combined ALL policy.
- Comment that Worker rollback does not undo this SQL.

#### 2. Deploy backlog

**File**: `context/deployment/deferred.md`

**Intent**: Hosted Supabase must receive this SQL separately from Worker deploys.

**Contract**: Append **DEP-013** (next free id): apply `*_workout_logs.sql` to the hosted project behind `SUPABASE_URL`; Source = this plan; note Worker rollback does not undo SQL. Leave DEP-001–DEP-012 unchanged.

### Success Criteria:

#### Automated Verification:

- `supabase/migrations/` contains a `*_workout_logs.sql` file with `workout_logs` as specified (`type` CHECK, `distance_km >= 0`, `UNIQUE (user_id, date)`, FK to `auth.users`)
- The table enables RLS with separate SELECT, INSERT, UPDATE, and DELETE policies on `auth.uid() = user_id`
- `context/deployment/deferred.md` has an open DEP-013 for applying this migration to hosted Supabase; DEP-001–DEP-012 statuses are unchanged

---

## Phase 2: Pure log helper, types, and chat intent

### Overview

Lock “existing day only / copy plan / optional km / log phrases are not mutations” in Vitest before HTTP or SQL writes.

### Changes Required:

#### 1. `WorkoutLog` type

**File**: `src/types.ts`

**Intent**: Shared DTO for calendar, GET plan, and chat — not a `TrainingUnit` and not a `frozen` flag.

**Contract**: `export interface WorkoutLog { date: string; type: WorkoutType; distanceKm: number }`. Do not add `frozen`, `structure`, or `loggedAt` to the DTO.

#### 2. `resolveWorkoutLog` + write schema

**File**: `src/lib/services/workout-log.ts` (new) and `src/lib/services/workout-log.test.ts` (new)

**Intent**: One pure function the POST path, chat persist, and tests share.

**Contract**:

- Export `workoutLogWriteSchema`: `{ date: YYYY-MM-DD, distanceKm?: number }` (`distanceKm` finite `≥ 0` when present). Reuse `weekStartSchema` from `plan.ts` for the date (same ISO regex). Export `workoutLogDateSchema`: `{ date: YYYY-MM-DD }` for parsing the DELETE query param.
- Export `resolveWorkoutLog(units, date, distanceKm?: number): { ok: false; code: "NOT_FOUND" } | { ok: true; log: WorkoutLog }`. Missing unit → `NOT_FOUND`. `distanceKm` omitted → copy `unit.distanceKm`. `type` always from the planned unit. Do not write to the database in this phase.

#### 3. Log intent on the stub

**File**: `src/lib/services/propose-adaptation.ts` (and colocated `src/lib/services/propose-adaptation.test.ts`)

**Intent**: Chat can express completion without opening a calendar proposition.

**Contract**:

- Extend `ProposeResult` with optional `log?: { date: string; distanceKm?: number }`. When `log` is set, `mutations` is `[]`.
- Detect log **after** explain and **before** life/set-km/change-type. Trigger: word boundary `completed`, `logged`, `log`, or `done`, plus a resolvable in-week weekday or ISO date. Optional `(\d+(?:\.\d+)?)\s*km` becomes `log.distanceKm`.
- Keyword without a date → reply asking which day; no `log`. Date with no unit → `"I don't see a workout on that day."`; no `log`. Success reply names date, type, and km (planned or override).
- Unrecognized help text also mentions logging (e.g. “I completed Tuesday”).
- Do not treat bare `did` as a log trigger.

### Success Criteria:

#### Automated Verification:

- `resolveWorkoutLog` on an unknown date returns `NOT_FOUND`; on a known date copies type and planned km; an explicit km overrides distance only
- `workoutLogWriteSchema` rejects negative km and bad dates
- `proposeAdaptation("I completed Tuesday")` sets `log.date` to that week’s Tuesday, `mutations: []`, and no `log.distanceKm`
- `proposeAdaptation("logged Wednesday 8 km")` sets `log` with `distanceKm: 8` and `mutations: []`
- `proposeAdaptation("what is Tuesday for")` still explains with no `log` and no mutations
- `npm test` exits 0
- `npm run lint` exits 0

---

## Phase 3: Persist, HTTP, and chat write path

### Overview

Upsert/delete logs via PostgREST + RLS, expose POST/DELETE, extend GET plan, and let `sendMessage` persist a log without a pending proposition.

### Changes Required:

#### 1. Log I/O

**File**: `src/lib/services/workout-log.ts`

**Intent**: List a week, upsert one day, delete one day. Isolation is RLS; pass `user_id` explicitly like siblings.

**Contract**:

- `listLogs(client, userId, weekStart): Promise<WorkoutLog[]>` — `weekDates` then `.in("date", dates)` for the user. Map `distance_km` → `distanceKm`. Skip unparsable rows (same spirit as `toTrainingUnit`).
- `upsertLog(client, userId, units, patch: { date; distanceKm?: number })` — `resolveWorkoutLog`; `NOT_FOUND` if missing; upsert on `(user_id, date)` with camelCase avoided in SQL (`type`, `distance_km`). Return `{ log, logs }` for that week.
- `deleteLog(client, userId, date)` — delete that user’s row; `NOT_FOUND` if zero rows; return `{ logs }` for `utcMondayOf(date)`.
- Do not import `chat.ts`. Do not call `rejectPending`, `replaceWeek`, or `validatePlan`.

#### 2. Chat `sendMessage` branch

**File**: `src/lib/services/chat.ts`

**Intent**: A completion phrase writes history and a confirmation, not a diff.

**Contract**: After `proposeAdaptation`, if `proposed.log` is set: `upsertLog` with that date/km against the loaded `units`; insert the assistant reply; **do not** `applyMutations` / `insertPending` / `rejectPending` for this turn. Success payload is existing `ChatList` plus `logs` from `listLogs` (widen `SendMessageResult` only — **do not** add `logs` to `ChatList`, `listChat`, or GET `/api/chat`). If `proposed.log` is absent, keep today’s mutation/pending behavior and still attach `logs` on success so the client can refresh cheaply. Import `upsertLog` / `listLogs` from `workout-log.ts`.

#### 3. HTTP

**Files**: `src/pages/api/plan/logs.ts` (new), `src/pages/api/plan.ts` (`GET` adds `logs`), `src/pages/api/chat/messages.ts` (success body already spreads send result — must include `logs`)

**Intent**: JSON APIs matching S-02/S-03 (zod, `prerender = false`, 401 JSON, try/catch `DB_ERROR`).

**Contract**:

- `POST /api/plan/logs`: body `workoutLogWriteSchema`. 400 validation; 404 `NOT_FOUND`; 503/500 as siblings. Success `jsonOk({ log, logs })`.
- `DELETE /api/plan/logs?date=YYYY-MM-DD`: parse `date` with `workoutLogDateSchema` / `weekStartSchema` (query string, **no JSON body** — matches `DELETE /api/profile` and `DELETE /api/races/[id]`). 400 bad date; 404 `NOT_FOUND`. Success `jsonOk({ logs })`.
- `GET /api/plan`: add `logs: WorkoutLog[]` (empty array if none). Load logs in a **separate** try/catch from `listWeek` so a missing table/DEP does not blank the calendar — on log-load failure return `logs: []`.
- Do not add `/api/plan` or `/api/plan/logs` to `PROTECTED_ROUTES`.
- `generateAndPersist` / `acceptProposition` / `undoWeek` / `editUnit` stay unchanged with respect to `workout_logs` (no delete).

### Success Criteria:

#### Automated Verification:

- `src/pages/api/plan/logs.ts` exports `prerender = false`
- Handlers return 401 JSON (not a redirect) when `locals.user` is missing
- `PROTECTED_ROUTES` still does not include `/api/plan`
- `GET /api/plan` success payload includes `logs`
- `sendMessage` source: when `proposed.log` is set it calls `upsertLog` and does not call `insertPending`
- `generateAndPersist`, `acceptProposition`, `undoWeek`, and `editUnit` do not delete from `workout_logs` (source inspection)
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

---

## Phase 4: Calendar and chat UX

### Overview

The member logs a filled day in place and can log via chat; first paint and week nav show existing logs.

### Changes Required:

#### 1. Island + SSR

**Files**: `src/components/plan/PlanCalendar.tsx`, `src/components/plan/PlanWorkspace.tsx`, `src/components/plan/PlanChat.tsx`, `src/pages/dashboard.astro`

**Intent**: Fetch/state stays in `PlanWorkspace`; calendar stays presentational; chat copy mentions logging.

**Contract**:

- `dashboard.astro` loads `listLogs` in its **own** try/catch (not the `listWeek` catch). Failure → `logs = []`; do not clear `units`. Pass `logs` into `PlanWorkspace`.
- Calendar: filled day has Log when no log for that date; when a log exists, show “Logged {km} km” and Unlog. Empty days have neither. Frozen days can still log. Reuse `Button` / `cn()`. No `"use client"`. One-click Log (no extra km field) — POST `{ date }` so the server copies planned km. Optional km is a chat-only override in this slice.
- Log → `POST /api/plan/logs`. Unlog → `DELETE /api/plan/logs?date=${date}` (no body). `credentials: "same-origin"`. On success replace `logs` from the response. Do not clear `proposition`. Do not change `units`.
- Week nav `GET /api/plan` must read `logs`. After chat send, if the body has `logs`, replace local `logs`.
- `PlanChat` helper copy mentions completing a day (e.g. “I completed Tuesday”) in addition to explain / life / day change. Accept/Reject stay as they are (hidden when there is no pending).
- Surface API `code: message` on `calendarError` / `chatError` as today.

### Success Criteria:

#### Automated Verification:

- `PlanCalendar` exposes Log on a filled unlogged day and has no Log control on empty days
- `PlanWorkspace` calls `POST /api/plan/logs` and `DELETE /api/plan/logs`
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Sign in with a generated week; Log a filled day; reload keeps the Logged badge and planned type/km unchanged
- Unlog removes the badge; logging a frozen day works; empty days stay without Log
- Chat “I completed Tuesday” confirms and badges the cell without showing Accept; “logged Wednesday 8 km” stores 8 km
- Generate (or Undo / Accept) after a log leaves the Logged badge in place

---

## Testing Strategy

### Unit Tests:

- `resolveWorkoutLog` NOT_FOUND / copy planned / km override.
- `workoutLogWriteSchema` rejects bad date and negative km.
- `proposeAdaptation` log vs explain vs mutation phrases as in Phase 2.
- Existing `unauthorized()` 401 JSON test remains.

### Integration Tests:

- None in CI (no Supabase in GHA). Local `npx supabase db reset` proves the migration applies; not a Progress Manual row.

### Manual Testing Steps:

1. `npx supabase start` and apply migrations; sign in; generate a week.
2. Log a day from the calendar; reload; Unlog.
3. Log via chat (copy planned, then km override); confirm no Accept panel.
4. Generate after a log; confirm the badge remains.

## Performance Considerations

One week, ≤7 logs. List by date `IN` the week window. Do not treat this slice as a reason to close DEP-002.

## Migration Notes

Additive table. Local: `npx supabase db reset` (or `migration up`) after start. Hosted: apply the new file via DEP-013 **before** expecting production logs to persist. Rolling back the Worker does not drop `workout_logs`. No backfill. Missing table ⇒ log writes fail until DEP-013; GET plan still returns units (`logs: []` on load failure).

## References

- Roadmap S-05: `context/foundation/roadmap.md`
- PRD FR-009 (manual / chat log); FR-010 parked: `context/foundation/prd.md`
- S-02: `src/lib/services/plan.ts`, `src/pages/api/plan.ts`, `PlanCalendar.tsx`
- S-03: `src/lib/services/propose-adaptation.ts`, `src/lib/services/chat.ts`, `PlanChat.tsx`
- S-04: `PUT /api/plan/units` (do not overload for logging)
- AGENTS: zod APIs, `prerender = false`, RLS migrations, `PROTECTED_ROUTES`, `cn()`
- Deploy backlog: `context/deployment/deferred.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and RLS

#### Automated

- [x] 1.1 `supabase/migrations/` contains a `*_workout_logs.sql` file with `workout_logs` as specified (`type` CHECK, `distance_km >= 0`, `UNIQUE (user_id, date)`, FK to `auth.users`) — 0803a69
- [x] 1.2 The table enables RLS with separate SELECT, INSERT, UPDATE, and DELETE policies on `auth.uid() = user_id` — 0803a69
- [x] 1.3 `context/deployment/deferred.md` has an open DEP-013 for applying this migration to hosted Supabase; DEP-001–DEP-012 statuses are unchanged — 0803a69

### Phase 2: Pure log helper, types, and chat intent

#### Automated

- [x] 2.1 `resolveWorkoutLog` on an unknown date returns `NOT_FOUND`; on a known date copies type and planned km; an explicit km overrides distance only — 750fceb
- [x] 2.2 `workoutLogWriteSchema` rejects negative km and bad dates — 750fceb
- [x] 2.3 `proposeAdaptation("I completed Tuesday")` sets `log.date` to that week’s Tuesday, `mutations: []`, and no `log.distanceKm` — 750fceb
- [x] 2.4 `proposeAdaptation("logged Wednesday 8 km")` sets `log` with `distanceKm: 8` and `mutations: []` — 750fceb
- [x] 2.5 `proposeAdaptation("what is Tuesday for")` still explains with no `log` and no mutations — 750fceb
- [x] 2.6 `npm test` exits 0 — 750fceb
- [x] 2.7 `npm run lint` exits 0 — 750fceb

### Phase 3: Persist, HTTP, and chat write path

#### Automated

- [x] 3.1 `src/pages/api/plan/logs.ts` exports `prerender = false` — e1b13f4
- [x] 3.2 Handlers return 401 JSON (not a redirect) when `locals.user` is missing — e1b13f4
- [x] 3.3 `PROTECTED_ROUTES` still does not include `/api/plan` — e1b13f4
- [x] 3.4 `GET /api/plan` success payload includes `logs` — e1b13f4
- [x] 3.5 `sendMessage` source: when `proposed.log` is set it calls `upsertLog` and does not call `insertPending` — e1b13f4
- [x] 3.6 `generateAndPersist`, `acceptProposition`, `undoWeek`, and `editUnit` do not delete from `workout_logs` (source inspection) — e1b13f4
- [x] 3.7 `npm test` exits 0 — e1b13f4
- [x] 3.8 `npm run lint` exits 0 — e1b13f4
- [x] 3.9 `npm run build` exits 0 — e1b13f4

### Phase 4: Calendar and chat UX

#### Automated

- [x] 4.1 `PlanCalendar` exposes Log on a filled unlogged day and has no Log control on empty days — 6f97bd1
- [x] 4.2 `PlanWorkspace` calls `POST /api/plan/logs` and `DELETE /api/plan/logs` — 6f97bd1
- [x] 4.3 `npm run lint` exits 0 — 6f97bd1
- [x] 4.4 `npm run build` exits 0 — 6f97bd1

#### Manual

- [x] 4.5 Sign in with a generated week; Log a filled day; reload keeps the Logged badge and planned type/km unchanged
- [x] 4.6 Unlog removes the badge; logging a frozen day works; empty days stay without Log
- [x] 4.7 Chat “I completed Tuesday” confirms and badges the cell without showing Accept; “logged Wednesday 8 km” stores 8 km
- [x] 4.8 Generate (or Undo / Accept) after a log leaves the Logged badge in place
