# Profile Weekly Km and Race Calendar Implementation Plan

## Overview

Replace the signed-in dashboard stub with a setup page where a member persists weekly km and a race list (optional name, optional goal, A–D, at most one A). This is roadmap S-01: the first product tables and RLS, so S-02 can load `GenerateInput` without inventing profile/race storage.

## Current State Analysis

Auth (FR-001) is done: cookie sessions via `createClient`, `locals.user`, `PROTECTED_ROUTES = ["/dashboard"]`. Sign-in still redirects to `/`. The dashboard only shows email and sign-out.

There are no product tables, no `supabase/migrations/` files, and no `.from()` data access. README still says Auth’s `auth.users` is enough.

F-01 already locked the in-memory contract S-02 will call: `GenerateInput.weeklyKm`, `races: RaceInput[]` with `{ date, priority, goal? }`, and `NO_A_RACE` when no A exists. A display name is not on `RaceInput`. `generatePlan` is not called in this slice.

Existing APIs are auth-only `formData` + redirects, without `prerender = false` or zod. AGENTS.md requires both for new API routes. `zod` is transitive (Astro) but not a direct dependency.

## Desired End State

A signed-in member can open `/dashboard`, save a weekly km (positive, one decimal, ≤ 300), and add / edit / remove races. Each race has a date, A–D priority, optional name, and optional free-text goal. At most one race may be A. Two races cannot share a date. Missing km or races is allowed (empty states). Another member cannot read or write these rows. `toRaceInput` (or equivalent) maps persisted races onto F-01’s `RaceInput` by dropping `id` and `name`. Unauthenticated HTML routes still redirect to sign-in; unauthenticated JSON APIs return 401.

### Key Discoveries:

- `PROTECTED_ROUTES` uses `pathname.startsWith` and redirects to `/auth/signin` (`src/middleware.ts:4–21`). Putting `/api/profile` or `/api/races` on that list would return HTML to a `fetch` caller.
- `RaceInput` is `{ date, priority, goal? }` (`src/types.ts:13–17`). Persist `name` and `id` on a separate `Race` entity; do not add them to `RaceInput`.
- `generatePlan` requires finite `weeklyKm > 0` and ≥1 A (`src/lib/services/generate-plan.ts:8–16`). This slice enforces km bounds and at most one A; it does not require an A race to exist.
- Worker rollback does not undo Supabase schema (`context/foundation/infrastructure.md`, `context/deployment/deferred.md` ops cheat sheet).
- Auth forms reuse `FormField` + shadcn `Button`; the only hydration today is `client:load` on sign-in/up.

## What We're NOT Doing

- FR-012 extra profile prefs (workout-type prefs, etc.).
- Calling `generatePlan` / `validatePlan`, plan tables, freeze anchors, or a training-plan calendar (S-02).
- Chat, manual workout edit, logging, Admin (S-03–S-06).
- Rebuilding auth, converting auth routes to JSON/zod, or adding `prerender = false` to existing auth handlers.
- Playwright / jsdom / a CI Supabase.
- Forbidding past race dates, requiring a goal or name, or allowing multiple A races.
- A client-side Supabase key or RLS bypass via service role.
- Closing DEP-001–DEP-007; only append the hosted-migration follow-up this slice creates.

## Implementation Approach

Two tables (`profiles`, `races`) owned by `auth.uid()`, first migration with RLS and per-operation policies. Unique `(user_id, date)` plus a partial unique index so a user can have only one `priority = 'A'`. JSON APIs (zod, `prerender = false`) call services that use the existing cookie SSR client. One React island on `/dashboard` for km + race list. Sign-in success redirects to `/dashboard`. Vitest covers schemas and `Race` → `RaceInput` mapping; the page is a human check.

## Critical Implementation Details

**JSON APIs are not `PROTECTED_ROUTES`.** Middleware redirects unauthenticated HTML. Profile/race handlers must return `401` JSON when `locals.user` is missing. Keep `/dashboard` on the list; do not add `/api/*`.

**Anon + user JWT, not service role.** Reuse `createClient` from `src/lib/supabase.ts`. RLS (`auth.uid() = user_id`) is the isolation mechanism. A service-role client would bypass it.

**One A is a partial unique index**, not a unique column on `priority`. Postgres: `CREATE UNIQUE INDEX … ON races (user_id) WHERE priority = 'A'`. Translate `23505` into a typed API error on create/update.

**Calendar dates are `YYYY-MM-DD` strings.** Do not parse with `new Date("YYYY-MM-DD")` (local timezone shift). Split Y-M-D and use `Date.UTC`, same as F-01. Sorting “upcoming first” uses UTC today; past dates remain visible below.

**`name` never enters `RaceInput`.** Mapping copies `date`, `priority`, and `goal` only. S-02 must be able to `generatePlan({ weeklyKm, races: rows.map(toRaceInput), … })` without unknown fields.

---

## Phase 1: Schema and RLS

### Overview

Introduce the first product schema: member profile volume and races, with RLS and the uniqueness rules this slice locked.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_profiles_and_races.sql` (new; timestamp at implement time)

**Intent**: Persist weekly km and races per `auth.users` row so later slices do not invent a second schema.

**Contract**:

- `profiles`: `user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`; `weekly_km numeric(4,1) NOT NULL` with `CHECK (weekly_km > 0 AND weekly_km <= 300)`. No row means “km not set yet.”
- `races`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`; `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`; `date date NOT NULL`; `priority text NOT NULL CHECK (priority IN ('A','B','C','D'))`; `goal text`; `name text`; `UNIQUE (user_id, date)`; `CREATE UNIQUE INDEX races_one_a_per_user ON races (user_id) WHERE priority = 'A'`.
- Both tables: `ENABLE ROW LEVEL SECURITY` and four policies each (SELECT, INSERT, UPDATE, DELETE) using `auth.uid() = user_id`. No combined ALL policy.

#### 2. Docs and deploy backlog

**File**: `README.md` (Supabase Configuration), `context/deployment/deferred.md`

**Intent**: Stop claiming the app is auth-tables-only, and record that Worker rollback cannot apply this schema on hosted Supabase.

**Contract**: Replace the “No database tables or migrations are required” sentence with how to apply `supabase/migrations/` locally (`npx supabase db reset` or equivalent after `npx supabase start`). Append **DEP-008** (next free id if 008 is taken): apply product migrations to the hosted Supabase the Worker uses; Source = this plan; note that Worker rollback does not undo SQL. Add one line to DEP-003 Notes that S-01 now persists member profile/races so preview Access is in play.

### Success Criteria:

#### Automated Verification:

- `supabase/migrations/` contains a `*_profiles_and_races.sql` file with `profiles` and `races` as specified (numeric km check, date unique per user, partial unique one A, FK to `auth.users`)
- Both tables enable RLS with separate SELECT, INSERT, UPDATE, and DELETE policies on `auth.uid() = user_id`
- `README.md` no longer states that no database tables or migrations are required, and documents applying local migrations
- `context/deployment/deferred.md` has an open DEP task for applying product migrations to hosted Supabase, and DEP-003 notes member profile/race data

---

## Phase 2: Validation and mapping

### Overview

Lock the request/entity shapes and the pure rules (km bounds, one A, unique dates, `Race` → `RaceInput`) in Vitest before any HTTP.

### Changes Required:

#### 1. Persisted types

**File**: `src/types.ts`

**Intent**: Distinguish stored races from F-01’s generate DTO so a display name cannot leak into `generatePlan`.

**Contract**: Export `Profile` as `{ weeklyKm: number }` and `Race` as `{ id: string; date: string; priority: RacePriority; goal?: string; name?: string }`. Do not add `name` or `id` to `RaceInput`. Export `toRaceInput(race: Race): RaceInput` that copies `date`, `priority`, and `goal` only. Keep existing F-01 exports unchanged.

#### 2. Zod schemas and list invariants

**File**: `src/lib/services/profile-races.ts` (or a sibling under `src/lib/services/`; new), `package.json`

**Intent**: One validation module APIs will call, so km/one-A/unique-date rules are not reimplemented in handlers.

**Contract**: Add `zod` as a **direct** dependency (v4, matching the lockfile). Schemas:

- Weekly km: finite number, `> 0`, `<= 300`, at most one decimal place.
- Race write: `date` as `YYYY-MM-DD`; `priority` `A|B|C|D`; `goal` and `name` optional strings, trim, empty → omitted.
- List invariant helper used when the caller has the member’s full race set (create/update): reject duplicate dates; reject two or more `priority === "A"`.

Do not require an A race to exist.

#### 3. Unit tests

**File**: colocated `*.test.ts` next to the validation module

**Intent**: Pin the locked product rules without a database.

**Contract**: Vitest coverage for the Automated Verification cases below. Mapping tests include a race with `name` set and assert `toRaceInput` output has only `date`, `priority`, and optional `goal`.

### Success Criteria:

#### Automated Verification:

- `src/types.ts` exports `Profile`, `Race`, and `toRaceInput`; `toRaceInput` omits `id` and `name`
- Tests cover: weekly km `47.5` accepted; `0`, `-1`, `300.1`, `47.55`, and non-finite rejected; duplicate dates in a list rejected; two A races rejected; one A plus B/C/D accepted; empty race list accepted; `toRaceInput` drops `name`/`id`
- `package.json` lists `zod` in `dependencies`
- `npm test` exits 0
- `npm run lint` exits 0

---

## Phase 3: Services and APIs

### Overview

Expose authenticated JSON CRUD that writes through RLS and returns typed errors for unique-date and second-A conflicts.

### Changes Required:

#### 1. Data services

**File**: `src/lib/services/` (profile + races modules; may extend the Phase 2 file)

**Intent**: Keep PostgREST calls out of route files so handlers stay parse → authorize → service → respond.

**Contract**: Functions take a Supabase client plus `user.id`. Profile: get (missing row → `weeklyKm: null`), upsert km. Races: list, insert, update, delete. Map Postgres `23505` to typed errors (`DUPLICATE_RACE_DATE`, `SECOND_A_RACE` — distinguish via constraint/index name). List ordered upcoming-first (UTC today), then past, both by date ascending. Do not call `generatePlan`.

#### 2. HTTP routes

**File**: `src/pages/api/profile.ts`, `src/pages/api/races.ts`, `src/pages/api/races/[id].ts` (new)

**Intent**: First zod-backed JSON APIs for the dashboard island; session from cookies, not a body token.

**Contract**: Each file exports `const prerender = false`. If `locals.user` is null → `401` JSON `{ error: { code: "UNAUTHORIZED", message } }` (no redirect). Bodies via zod from Phase 2.

- `GET /api/profile` → `{ weeklyKm: number | null }`
- `PUT /api/profile` body `{ weeklyKm: number }` → saved profile
- `GET /api/races` → `{ races: Race[] }`
- `POST /api/races` → created `Race`
- `PATCH /api/races/[id]` → updated `Race` (date, priority, goal, name)
- `DELETE /api/races/[id]` → 204 or `{ ok: true }`

`404` when the id is not this user’s row. `400` with the typed code on zod failure, duplicate date, or second A. Auth routes stay formData/redirect.

### Success Criteria:

#### Automated Verification:

- Profile and race API files export `prerender = false`
- Handlers return 401 JSON (not a redirect) when `locals.user` is missing
- `PROTECTED_ROUTES` still does not include `/api/profile` or `/api/races`
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

---

## Phase 4: Setup UI

### Overview

Turn `/dashboard` into the first-session setup surface: weekly km and race list with empty states, using a React island over the new APIs.

### Changes Required:

#### 1. Dashboard page and island

**File**: `src/pages/dashboard.astro`, new island under `src/components/` (e.g. `setup/` — not `auth/`)

**Intent**: Interactivity (add/edit/remove races, save km) requires an island; load initial rows on the server so the first paint is not an empty flash.

**Contract**: `dashboard.astro` stays protected via existing `PROTECTED_ROUTES`. Server-load profile + races with `createClient` and pass them as props. Island: km field, save; race list sorted upcoming-first then past; add/edit/remove; optional name and goal; A–D select. Empty copy when km is unset and when there are no races. Client `fetch` to Phase 3 APIs with cookies (`credentials: "same-origin"`). Surface duplicate-date and second-A errors next to the form. Reuse `FormField` / `Button` and `cn()`. No `"use client"`.

#### 2. Post-login landing

**File**: `src/pages/api/auth/signin.ts`

**Intent**: First session should open the setup page, not the marketing home.

**Contract**: Successful sign-in redirects to `/dashboard` instead of `/`. Signup → confirm-email unchanged. Topbar may keep the “Dashboard” label.

### Success Criteria:

#### Automated Verification:

- `src/pages/dashboard.astro` hydrates a React island and does not remain the email-only welcome stub
- `src/pages/api/auth/signin.ts` redirects to `/dashboard` on success
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Sign in and land on `/dashboard`; sign out cannot open it
- Save weekly km `47.5`, reload, value remains
- Add an A race with a name and a B race with no name; upcoming dates appear above past dates
- A second A is rejected; a second race on the same date is rejected
- Edit a race (goal/priority/name) and delete a race; empty states show when km is cleared/unset and when the list is empty

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before treating the change as done.

**Addendum (impl-review):** `DELETE /api/profile` removes the `profiles` row so weekly km can be unset (`weekly_km` is NOT NULL). The island maps an empty km save to this DELETE.

---

## Testing Strategy

### Unit Tests:

- Weekly km: `47.5` ok; `0`, negative, `300.1`, two decimal places, non-finite rejected.
- Race list: unique dates; at most one A; empty list ok; mixed B/C/D with one A ok.
- `toRaceInput` strips `id` and `name`; keeps `goal` when present.

### Integration Tests:

- None in CI (no Supabase in GHA). Local `npx supabase db reset` is how a human proves the migration applies; not a Progress Manual row.

### Manual Testing Steps:

1. `npx supabase start` and apply migrations; sign in; confirm `/dashboard` (not `/`).
2. Save km, add/edit/delete races, hit one-A and duplicate-date errors.
3. Confirm empty states and that `/dashboard` redirects to sign-in when signed out.

## Performance Considerations

Profile is one row; race lists are small (a season). No pagination. Island `client:load` is enough. Do not treat this slice as a reason to close DEP-002.

## Migration Notes

First product SQL. Local: `npx supabase start` then `npx supabase db reset` (or `migration up`) so `auth.users` + new tables exist. Hosted: apply the same file to the project behind `SUPABASE_URL` (DEP-008) **before** expecting production `/dashboard` saves to work. Rolling back the Worker does not drop these tables. Additive only; no backfill (no existing profile rows). Empty `profiles` row = km unset; deleting the A race is allowed.

## References

- Roadmap S-01: `context/foundation/roadmap.md`
- PRD: FR-001 (done), FR-002, FR-003, US-01 — `context/foundation/prd.md`
- F-01 types/services: `src/types.ts`, `src/lib/services/generate-plan.ts`
- Auth/middleware: `src/middleware.ts`, `src/lib/supabase.ts`, `src/pages/dashboard.astro`
- AGENTS: zod APIs, `prerender = false`, RLS migrations, `PROTECTED_ROUTES`
- Deploy backlog: `context/deployment/deferred.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and RLS

#### Automated

- [x] 1.1 `supabase/migrations/` contains a `*_profiles_and_races.sql` file with `profiles` and `races` as specified (numeric km check, date unique per user, partial unique one A, FK to `auth.users`) — 9516fb8
- [x] 1.2 Both tables enable RLS with separate SELECT, INSERT, UPDATE, and DELETE policies on `auth.uid() = user_id` — 9516fb8
- [x] 1.3 `README.md` no longer states that no database tables or migrations are required, and documents applying local migrations — 9516fb8
- [x] 1.4 `context/deployment/deferred.md` has an open DEP task for applying product migrations to hosted Supabase, and DEP-003 notes member profile/race data — 9516fb8

### Phase 2: Validation and mapping

#### Automated

- [x] 2.1 `src/types.ts` exports `Profile`, `Race`, and `toRaceInput`; `toRaceInput` omits `id` and `name` — 1fe9431
- [x] 2.2 Tests cover: weekly km `47.5` accepted; `0`, `-1`, `300.1`, `47.55`, and non-finite rejected; duplicate dates in a list rejected; two A races rejected; one A plus B/C/D accepted; empty race list accepted; `toRaceInput` drops `name`/`id` — 1fe9431
- [x] 2.3 `package.json` lists `zod` in `dependencies` — 1fe9431
- [x] 2.4 `npm test` exits 0 — 1fe9431
- [x] 2.5 `npm run lint` exits 0 — 1fe9431

### Phase 3: Services and APIs

#### Automated

- [x] 3.1 Profile and race API files export `prerender = false` — a4ccb46
- [x] 3.2 Handlers return 401 JSON (not a redirect) when `locals.user` is missing — a4ccb46
- [x] 3.3 `PROTECTED_ROUTES` still does not include `/api/profile` or `/api/races` — a4ccb46
- [x] 3.4 `npm test` exits 0 — a4ccb46
- [x] 3.5 `npm run lint` exits 0 — a4ccb46
- [x] 3.6 `npm run build` exits 0 — a4ccb46

### Phase 4: Setup UI

#### Automated

- [x] 4.1 `src/pages/dashboard.astro` hydrates a React island and does not remain the email-only welcome stub — 3dce2d9
- [x] 4.2 `src/pages/api/auth/signin.ts` redirects to `/dashboard` on success — 3dce2d9
- [x] 4.3 `npm run lint` exits 0 — 3dce2d9
- [x] 4.4 `npm run build` exits 0 — 3dce2d9

#### Manual

- [x] 4.5 Sign in and land on `/dashboard`; sign out cannot open it — 3dce2d9
- [x] 4.6 Save weekly km `47.5`, reload, value remains — 3dce2d9
- [x] 4.7 Add an A race with a name and a B race with no name; upcoming dates appear above past dates — 3dce2d9
- [x] 4.8 A second A is rejected; a second race on the same date is rejected — 3dce2d9
- [x] 4.9 Edit a race (goal/priority/name) and delete a race; empty states show when km is cleared/unset and when the list is empty — 3dce2d9
