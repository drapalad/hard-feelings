# Persist last race result for Estimated paces — Implementation Plan

## Overview

Persist the member’s last race result (date, distance km, finish time in seconds) on `profiles`, expose it through GET `/api/profile` and a new PATCH `/api/profile`, and seed Estimated paces on Profile so the saved chip and Riegel estimates survive reload and another device.

## Current State Analysis

Estimated paces in `SetupForm` is local `useState`: default reference `"10K"`, empty finish time, `predictTimes` from `@/lib/services/pace-estimate`. No Save, no chip, no date field, no load from profile.

`profiles` has weekly km, weekday prefs, and mix only (`20260813104727_profiles_and_races.sql`, `20260902140000_profile_plan_prefs.sql`). Owner RLS (`profiles_select_own` / `insert_own` / `update_own` / `delete_own`) already covers new columns. `weekly_km` is `NOT NULL`, so a last-race-only insert is impossible.

Profile HTTP is GET / PUT / DELETE (`src/pages/api/profile.ts`). PUT uses `profileWriteSchema` (six pref fields). There is no PATCH. SetupForm saves prefs with PUT.

`races` has date, priority, name, goal — no finish time, no distance. Option (b) is out of scope.

`Profile` / `ProfilePatch` feed generation and chat freeze. Last-race fields must live on `ProfileView` (and the PATCH DTO), not on `Profile`, so chat/generate patches stay unchanged.

GET `/api/profile` and SSR `dashboard.astro` already load `getProfile`. Last-race values must be selected there and passed into `SetupForm` via `DashboardTabs` so first paint is seeded (not a client-only GET after mount).

`upsertProfile` (PUT) writes only pref columns. Memory persist merges on conflict (`{ ...existing, ...row }`), so omitting last-race keys on PUT preserves them. Chat freeze builds a prefs-only `Profile` and calls `upsertProfile` (`chat.ts` accept path) — same omit-to-preserve rule. `DELETE /api/profile` still deletes the whole row (existing empty-weekly-km path). Postgres `numeric` often arrives as a string; `last_race_km` needs the same parse as `weekly_km`.

`src/lib/test/migration-safety.test.ts` hard-codes the migration filename list and the newest-file name. A new SQL file must update that list. Do not `UPDATE` member tables in the migration (harness rejects it). Do not add RLS.

## Desired End State

A member can enter a last-race date, distance, and finish time on Estimated paces, click **Save**, and have that result stored on their `profiles` row. After reload (and on another device after the hosted migration is applied), Estimated paces shows a chip `D MMM YYYY · {distance} · {time}` (e.g. `12 Apr 2026 · 10K · 41:30`) and the Riegel inputs/estimates are filled from the saved result. Clearing weekly km via existing DELETE still removes the profile row (and thus the last race); that contract is unchanged.

### Key Discoveries:

- Notes name PATCH `/api/profile`; HEAD has only PUT of the full pref object. Last-race write is a new PATCH so weekly-km Save does not have to send last-race fields (`src/pages/api/profile.ts`, `SetupForm.tsx` PUT at prefs save).
- `weekly_km NOT NULL` blocks inserting a last-race-only row. PATCH updates an existing profiles row; zero rows → 404 (`notFound()` in `@/lib/api`).
- `ProfilePatch = Partial<Profile>` is consumed by chat freeze (`src/lib/services/chat.ts`). Do not put last-race keys on `Profile`.
- Chip mock uses English `D MMM YYYY` and a standard-distance label (`10K`), not ISO date and not `{km} km` for 10.
- `formatTime` already exists in `pace-estimate.ts`; reuse it for chip time and for seeding the finish-time input.
- Hosted apply is `DEP-*`, not an Automated gate (test-plan §6.5; AGENTS.md deploy backlog).

## What We're NOT Doing

- Option (b): `finish_time_sec` / distance on `races`, “latest past race with a time.”
- `last_race_name` column or name input (chip has no name; Notes marked it optional).
- Changing Riegel / `predictTimes`.
- Strava import.
- Applying the migration to hosted/production Supabase in this run.
- New RLS policies.
- Putting last-race fields on `Profile` / `ProfilePatch` / chat freeze.
- Keeping the result in `useState` only.
- Playwright / e2e (test-plan §6.3).
- Changing DELETE `/api/profile` so empty weekly km keeps the row.

## Implementation Approach

Three phases: (1) additive migration + types + PATCH schema + profile service (select/parse/update, PUT still prefs-only), (2) HTTP PATCH + GET/PUT contract tests including 401 and owner strip, (3) Estimated paces UI (date field, Save, chip, seed) wired from SSR props. Formatter lives in a small service so chip copy is unit-tested without a React renderer.

## Critical Implementation Details

**State sequencing.** Seed `refDistanceLabel` / `refCustomKm` / `refTime` / the new date field from SSR props on first render (`useState` initializers), not in an effect after empty defaults — otherwise estimates flash empty then fill.

**PUT vs PATCH.** `upsertProfile` must not include `last_race_*` in the upsert payload. PATCH uses `.update().eq("user_id", userId)` and returns 404 when no row matches.

**All-or-nothing SQL.** A CHECK that the three last-race columns are all NULL or all non-NULL prevents half-saved results without a backfill UPDATE.

## Phase 1: Migration, types, and profile service

### Overview

Add nullable last-race columns on `profiles`, extend `ProfileView`, add a PATCH write schema, and teach `getProfile` / a new `updateLastRace` to round-trip them. PUT continues to write only pref columns.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260904180000_profile_last_race.sql`

**Intent**: Store last race result on the existing member profile row. Existing owner RLS covers the new columns; do not add policies.

**Contract**: `ALTER TABLE profiles` add `last_race_date date`, `last_race_km numeric`, `last_race_time_sec integer`, all nullable. CHECK: `last_race_km` IS NULL or `> 0`; `last_race_time_sec` IS NULL or integer `> 0` and `<= 172800` (48h). Composite CHECK: all three NULL or all three NOT NULL. No `last_race_name`. No `UPDATE`, no `CREATE POLICY`, no `DROP`. Comment that Worker rollback does not undo this SQL.

#### 2. Types

**File**: `src/types.ts`

**Intent**: Expose last race on the profile view used by GET/SSR/UI without polluting generate/chat `Profile`.

**Contract**: `ProfileView` gains `lastRaceDate: string | null`, `lastRaceKm: number | null`, `lastRaceTimeSec: number | null`. `Profile` and `ProfilePatch` unchanged.

#### 3. PATCH write schema

**File**: `src/lib/services/profile-races.ts`

**Intent**: Zod-validate the PATCH body. Extra keys (including `userId` / `user_id`) strip.

**Contract**: `lastRaceWriteSchema` object with `lastRaceDate` (`YYYY-MM-DD`), `lastRaceKm` (finite number `> 0` and `<= 300`), `lastRaceTimeSec` (int `> 0` and `<= 172800`). All three required. No `lastRaceName`.

#### 4. Profile service

**File**: `src/lib/services/profile.ts`

**Intent**: Select and parse the new columns on GET; UPDATE them on Save; keep PUT prefs-only so last race survives weekly-km Save.

**Contract**:
- `SELECT_COLUMNS` includes `last_race_date, last_race_km, last_race_time_sec`.
- `emptyProfileView` / `toProfileView` always set the three fields (null when missing/unparseable). Parse `last_race_km` like `weekly_km` (number or numeric string). Parse `last_race_time_sec` as a finite integer. Parse `last_race_date` as `YYYY-MM-DD` or null.
- `updateLastRace(client, userId, { lastRaceDate, lastRaceKm, lastRaceTimeSec })` updates those columns, `.eq("user_id", userId)`, `.select(SELECT_COLUMNS).maybeSingle()`. Return the `ProfileView` or a not-found result when no row.
- `upsertProfile` payload stays the six pref columns plus `user_id` (chat freeze already builds a prefs-only `Profile` and calls this — omitted last-race keys must keep existing values). Change its return type to `ProfileView` so PUT JSON includes last-race nulls or preserved values.

#### 5. GET/PUT fixtures (before PATCH exists)

**File**: `src/pages/api/profile.test.ts`

**Intent**: `toProfileView` will add three keys on every GET/PUT. Existing `toEqual(VALID_BODY)` / no-row GET assertions fail unless they include last-race nulls in this phase.

**Contract**: Extend the no-row GET, sparse-row GET, and PUT round-trip expected JSON with `lastRaceDate: null`, `lastRaceKm: null`, `lastRaceTimeSec: null`. Do not add PATCH tests yet (Phase 2).

#### 6. Migration-safety filename lock

**File**: `src/lib/test/migration-safety.test.ts`

**Intent**: The harness walks on-disk files; the expected name list and `newest.name` must include the new migration.

**Contract**: Append `"20260904180000_profile_last_race.sql"` to the ordered list; `newest.name` equals that file.

### Success Criteria:

#### Automated Verification:

- Migration file exists at `supabase/migrations/20260904180000_profile_last_race.sql` and adds the three columns with no new POLICY and no UPDATE of `profiles`
- `lastRaceWriteSchema` unit tests: valid 10K/41:30 body accepts; extra `userId` stripped; missing field / bad date / non-positive time rejected (`src/lib/services/profile-races.test.ts`)
- GET/PUT exact JSON in `src/pages/api/profile.test.ts` includes `lastRaceDate`, `lastRaceKm`, `lastRaceTimeSec` as null when unset (no PATCH cases yet)
- `npm test -- src/lib/test/migration-safety.test.ts src/lib/services/profile-races.test.ts src/pages/api/profile.test.ts`
- `npx astro check`

---

## Phase 2: PATCH `/api/profile` and GET/PUT contracts

### Overview

Add `PATCH` on the existing profile route. GET returns last-race fields (null when unset). PUT still saves prefs and must not clear last race. Logged-out PATCH is 401 JSON.

### Changes Required:

#### 1. Profile route

**File**: `src/pages/api/profile.ts`

**Intent**: Last-race Save writes through PATCH with zod validation and session ownership. Keep `prerender = false`.

**Contract**: Export `PATCH` mirroring PUT’s auth / 503 / 400 `VALIDATION_ERROR` / 500 `DB_ERROR` pattern. Parse `lastRaceWriteSchema`. Call `updateLastRace`. Zero-row → `notFound()` (404 `NOT_FOUND`). Success → `jsonOk` full `ProfileView`. Do not add last-race fields to PUT’s `profileWriteSchema`.

#### 2. API contract tests

**File**: `src/pages/api/profile.test.ts`

**Intent**: Prove persist, authz, and that PUT does not wipe last race (Risk #1 / #5 / #6). Literal JSON bodies; do not `safeParse` in the test.

**Contract**:
- Logged-out PATCH → 401 `{ error: { code: "UNAUTHORIZED", message: "Sign in required" } }`, no `Location`.
- GET with no row includes `lastRaceDate/Km/TimeSec: null` alongside existing pref defaults.
- PATCH with no profiles row → 404; store unchanged.
- PATCH valid body round-trips on GET and in the store (`last_race_date` / `last_race_km` / `last_race_time_sec`); extra `userId` / `user_id` persist as session user; victim row unchanged.
- Invalid PATCH (bad date, `lastRaceTimeSec: 0`) → 400 `VALIDATION_ERROR`; store unchanged.
- After PATCH, PUT of prefs leaves last-race columns intact; GET still returns them.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/pages/api/profile.test.ts src/lib/services/profile-races.test.ts`
- `npx astro check`

---

## Phase 3: Estimated paces Save, chip, and seed

### Overview

Add a date field and **Save** on Estimated paces. Show the saved chip when a result exists. Seed reference distance and finish time from SSR props so estimates appear without retyping. Pass last-race props from `dashboard.astro` through `DashboardTabs`.

### Changes Required:

#### 1. Chip / seed helpers

**File**: `src/lib/services/last-race.ts` (new), `src/lib/services/last-race.test.ts` (new)

**Intent**: Deterministic chip copy matching the mock, and mapping stored km back onto the distance select.

**Contract**:
- `formatLastRaceChip(date: string, km: number, timeSec: number): string` → `D MMM YYYY · {distance} · {time}` using UTC calendar parts and English short months (`Apr`). Distance: `STANDARD_DISTANCES` label when `|km - d.km| < 1e-4`, else `{km} km` (trim useless trailing zeros). Time: reuse `formatTime`.
- Fixture: `formatLastRaceChip("2026-04-12", 10, 2490) === "12 Apr 2026 · 10K · 41:30"`.
- `seedRefDistance(km: number): { label: string; customKm: string }` — matching standard label or `{ label: "Custom", customKm: string }`.

#### 2. SetupForm Estimated paces

**File**: `src/components/setup/SetupForm.tsx`

**Intent**: Persist via PATCH; show chip; seed inputs from saved result; do not change Riegel.

**Contract**:
- Props: `lastRaceDate`, `lastRaceKm`, `lastRaceTimeSec` (`string | null` / `number | null`), same as `ProfileView`.
- Initial state: if all three saved values are non-null, seed date, `seedRefDistance`, and `formatTime(lastRaceTimeSec)` into the existing ref inputs; else keep today’s empty time / `"10K"` defaults plus empty date.
- Date field: `FormField` `type="date"` in Estimated paces (alongside existing distance + time).
- Chip: when saved result is non-null (from props or last successful PATCH), render the `formatLastRaceChip` string (visible text, not a POST). Hide chip when no saved result.
- **Save** control (label `Save`) PATCHes `/api/profile` with `{ lastRaceDate, lastRaceKm, lastRaceTimeSec }` from the current date field, resolved km, and `parseTimeInput(refTime)`. Disabled while busy. Show API error with existing `ServerError` / field error pattern. Do not PUT prefs on this control.
- After 200, keep chip + inputs from the response (or the payload) so the chip shows without a full reload.
- Tailwind via `cn()`. No `"use client"`.

#### 3. SSR / tabs wiring

**Files**: `src/pages/dashboard.astro`, `src/components/dashboard/DashboardTabs.tsx`

**Intent**: First paint after reload already has the saved result (S-08.4).

**Contract**: `getProfile` last-race fields pass DashboardTabs → SetupForm. Catch-path defaults are `null`.

#### 4. Source lock

**File**: `src/components/setup/SetupForm.test.ts`

**Intent**: Lock Save-on-PATCH and chip wiring without Playwright.

**Contract**: Source contains `fetch("/api/profile"` used with `method: "PATCH"` for last-race Save (do **not** assert a bare `method: "PATCH"` — race edit already PATCHes `/api/races/:id`). Source contains `formatLastRaceChip` and does not contain `finish_time_sec`. The Estimated paces control’s visible label is exactly `Save` (not only the existing “Save weekly km” / “Save race” strings).

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/services/last-race.test.ts src/components/setup/SetupForm.test.ts src/pages/api/profile.test.ts`
- `npm test`
- `npm run lint`
- `npx astro check`
- `npm run build`

#### Manual Verification:

- On Profile → Estimated paces, enter `2026-04-12`, 10K, `41:30`, click Save; chip shows `12 Apr 2026 · 10K · 41:30` and Riegel rows appear
- Reload `/dashboard?tab=profile`: chip and estimates still present, inputs not empty
- Change weekly km and Save weekly km: last-race chip remains
- With no weekly km saved, Estimated paces Save shows not-found (404) and does not invent a profile row

---

## Testing Strategy

### Unit Tests:

- `lastRaceWriteSchema` accept/reject/strip extra keys
- `formatLastRaceChip` mock fixture; Half/Marathon labels; custom km
- `seedRefDistance` 10 → `10K`, 15 → Custom

### Integration Tests:

- PATCH/GET/PUT contracts in `profile.test.ts` (401, 404, owner strip, PUT preserve, validation leaves store unchanged)
- `migration-safety.test.ts` ordered filenames including the new file (expand-only SQL)

### Manual Testing Steps:

1. Save a 10K 41:30 on 12 Apr 2026; confirm chip + estimates
2. Reload; confirm seed
3. Save weekly km; confirm last race still there

## Performance Considerations

Three nullable columns on a single-row-per-user table. No extra round-trip if SSR passes props; Save is one PATCH.

## Migration Notes

Additive nullable columns, no backfill, no RLS. Existing profile rows keep NULL last-race (no chip until Save). Hosted apply is DEP-024; Worker rollback does not undo SQL. Local `npx supabase` apply is optional and not an Automated gate.

Rollback: drop the three columns (hosted) or revert the Worker; do not ship a down migration in this change.

## References

- Related research: `context/changes/persist-race-result/research.md`
- Notes: `context/changes/persist-race-result/change.md`
- Similar additive columns: `supabase/migrations/20260903140000_log_pace_hr.sql`
- Prefs PUT pattern: `src/pages/api/profile.ts`, `src/lib/services/profile.ts`
- Test-plan §6.4 (API contracts), §6.5 (migration safety)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration, types, and profile service

#### Automated

- [x] 1.1 Migration file exists at `supabase/migrations/20260904180000_profile_last_race.sql` and adds the three columns with no new POLICY and no UPDATE of `profiles` — 8c5c556
- [x] 1.2 `lastRaceWriteSchema` unit tests: valid 10K/41:30 body accepts; extra `userId` stripped; missing field / bad date / non-positive time rejected (`src/lib/services/profile-races.test.ts`) — 8c5c556
- [x] 1.3 GET/PUT exact JSON in `src/pages/api/profile.test.ts` includes `lastRaceDate`, `lastRaceKm`, `lastRaceTimeSec` as null when unset (no PATCH cases yet) — 8c5c556
- [x] 1.4 `npm test -- src/lib/test/migration-safety.test.ts src/lib/services/profile-races.test.ts src/pages/api/profile.test.ts` — 8c5c556
- [x] 1.5 `npx astro check` — 8c5c556

### Phase 2: PATCH `/api/profile` and GET/PUT contracts

#### Automated

- [x] 2.1 `npm test -- src/pages/api/profile.test.ts src/lib/services/profile-races.test.ts` — fc546b7
- [x] 2.2 `npx astro check` — fc546b7

### Phase 3: Estimated paces Save, chip, and seed

#### Automated

- [x] 3.1 `npm test -- src/lib/services/last-race.test.ts src/components/setup/SetupForm.test.ts src/pages/api/profile.test.ts` — 1f3ad99
- [x] 3.2 `npm test` — 1f3ad99
- [x] 3.3 `npm run lint` — 1f3ad99
- [x] 3.4 `npx astro check` — 1f3ad99
- [x] 3.5 `npm run build` — 1f3ad99

#### Manual

- [ ] 3.6 On Profile → Estimated paces, enter `2026-04-12`, 10K, `41:30`, click Save; chip shows `12 Apr 2026 · 10K · 41:30` and Riegel rows appear
- [ ] 3.7 Reload `/dashboard?tab=profile`: chip and estimates still present, inputs not empty
- [ ] 3.8 Change weekly km and Save weekly km: last-race chip remains
- [ ] 3.9 With no weekly km saved, Estimated paces Save shows not-found (404) and does not invent a profile row
