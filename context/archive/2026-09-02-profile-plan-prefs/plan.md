# Profile schedule prefs and stimulus mix Implementation Plan

## Overview

Persist preferred long-run weekdays, rest weekdays, and an Easy / Threshold / Speed mix on the existing `profiles` row, expose them on GET/PUT `/api/profile`, and show them on the Profile tab under weekly km. Generate and chat do not consume the prefs yet.

## Current State Analysis

`profiles` has `weekly_km` only (`supabase/migrations/20260813104727_profiles_and_races.sql`). RLS is already `profiles_select_own` / `insert_own` / `update_own` / `delete_own` (`auth.uid() = user_id`). New columns on that table inherit those policies — a second table or extra policies would be weaker or redundant.

`Profile` is `{ weeklyKm: number }`. `getProfile` returns `{ weeklyKm: number | null }` and `select("weekly_km")` only. `upsertProfile` writes `weekly_km`. PUT `/api/profile` validates `{ weeklyKm }` via `weeklyKmSchema`. Empty weekly km in `SetupForm` DELETEs the whole row. Dashboard SSR passes `weeklyKm` into `DashboardTabs` → `SetupForm`. Generate (`generateAndPersist`) and chat read `profile.weeklyKm` only.

Memory persist (`createMemorySupabase`) stores whatever keys a seed row has. Existing plan/chat tests seed `{ user_id, weekly_km }` only. After this change, `getProfile` must still succeed on those rows by applying SQL-equivalent defaults for the new fields.

`src/lib/test/migration-safety.test.ts` hardcodes the on-disk migration filename list and the newest file. A new SQL file fails that suite until the list is updated. The harness classifies a leading `ALTER TABLE … ADD COLUMN` and ignores the rest of that statement; a *separate* `ALTER TABLE … ADD CONSTRAINT` is unclassified and throws. Put columns and CHECKs in **one** `ALTER TABLE profiles` statement.

Hosted apply is never done from a code commit (test-plan §6.5). Record `DEP-020`; do not `db push`.

## Desired End State

A signed-in member opens Dashboard → Profile and, under weekly km, sees seven **Preferred long-run days** checkboxes (Saturday on by default; at least one required to save) and seven **Rest weekdays** checkboxes (none checked = every weekday available). Below that, **Stimulus mix** with integer **Easy** / **Threshold** / **Speed** percent fields (captions as locked; live total must equal 100; thin proportion bar OK). Save persists through PUT `/api/profile`. GET and dashboard SSR round-trip the stored values (or SQL defaults when no row exists). Existing weekly km, races, generate, and chat behavior is unchanged aside from the wider profile payload.

### Key Discoveries:

- `getProfile` / `upsertProfile` live in `src/lib/services/profile.ts`; PUT zod lives in `src/pages/api/profile.ts` using `weeklyKmSchema` from `src/lib/services/profile-races.ts`.
- Callers of `getProfile` (`plan.ts`, `chat.ts`, `dashboard.astro`) only read `weeklyKm` — extra fields are backward compatible if `weeklyKm` stays `number | null`.
- `SetupForm` already uses `FormField`, `cn()`, and purple save-button classes; checkbox + number fields should reuse those, not new widgets.
- Colocated SetupForm tests do not exist yet; chrome in this repo uses `readFileSync` source-scan (`PlanChat.test.ts`). Locked Notes ask for that if present — add `src/components/setup/SetupForm.test.ts`.
- Profile GET/PUT have no handler tests today. Follow `src/pages/api/plan-contracts.test.ts` (memory persist, extra `userId` stripped, invalid body 400).
- `migration-safety.test.ts` expected filenames must include `20260902140000_profile_plan_prefs.sql`.

## What We're NOT Doing

- Teaching `generatePlan` / chat / validators to honor long-run days, rest days, or mix.
- Pace fields (T/MP/VO2), gym/strength, race CRUD, or an 8-week load chart.
- A `long_weekday` single-select.
- A second prefs table or additional RLS policies.
- Hosted `db push` (DEP-020 only).
- Playwright / jsdom / `page.waitForTimeout`.
- Changing DELETE-clears-profile semantics (empty weekly km still deletes the row, prefs included).
- Stamping roadmap done, writing `lessons.md`, or archiving this change.

## Implementation Approach

One expand-only `ALTER TABLE profiles`. Map snake_case columns to camelCase on the existing profile service. PUT body is weekly km plus the five new fields, validated with zod (weekdays unique and in `mon`–`sun`; mix integers 0–100 that sum to 100; at least one long weekday). Dashboard SSR passes the full view into `SetupForm`. UI lives under weekly km in the same save form. Tests lock the API contract and the locked copy/controls via source-scan.

## Critical Implementation Details

**Missing-column defaults.** Memory fixtures and a pre-migration hosted window can return a profiles row with only `weekly_km`. `getProfile` must treat missing `long_weekdays` / `rest_weekdays` / mix columns as `['sat']`, `[]`, `70`, `20`, `10` so generate/chat tests keep passing. No row still means `weeklyKm: null` plus those same prefs defaults (SSR hydration).

**One `ALTER TABLE`.** Columns, per-column CHECKs, and the mix-sum CHECK must be a single statement so `migration-safety` does not see an unclassified `ADD CONSTRAINT`. Do not `DROP` / `DELETE` / rewrite `weekly_km`.

**Do not thread prefs into generate or chat.** `profile.weeklyKm` remains the only field those paths read.

---

## Phase 1: Migration and hosted-apply record

### Overview

Add the locked columns to `profiles` with defaults and CHECKs. Record hosted apply as DEP-020. Keep the migrate-over-fixture harness green.

### Changes Required:

#### 1. Product migration

**File**: `supabase/migrations/20260902140000_profile_plan_prefs.sql`

**Intent**: Persist schedule and mix on the member profile row without a second table.

**Contract**: One `ALTER TABLE profiles` that adds:

- `long_weekdays text[] NOT NULL DEFAULT '{sat}'` with CHECK every element in `mon,tue,wed,thu,fri,sat,sun` and `cardinality(long_weekdays) >= 1`.
- `rest_weekdays text[] NOT NULL DEFAULT '{}'` with CHECK every element in the same weekday set (empty array allowed).
- `mix_easy smallint NOT NULL DEFAULT 70`, `mix_threshold smallint NOT NULL DEFAULT 20`, `mix_speed smallint NOT NULL DEFAULT 10`, each CHECK 0–100 inclusive, plus `CHECK (mix_easy + mix_threshold + mix_speed = 100)`.
- No new table, no new policies, no `DROP` / `DELETE`. Comment that existing `profiles_*_own` cover the new columns and that Worker rollback does not undo this SQL.

#### 2. Migrate-over-fixture expected list

**File**: `src/lib/test/migration-safety.test.ts`

**Intent**: The Phase 3 harness walks every on-disk file; a new name must be expected.

**Contract**: Append `20260902140000_profile_plan_prefs.sql` to the filename list. The “newest on-disk file” assertion must name that file. Distinctive `profiles.weekly_km = 42` must still survive. Do not change seed keys in `migration-safety.ts` (snapshot stays `user_id` + `weekly_km`).

#### 3. Deploy backlog

**File**: `context/deployment/deferred.md`

**Intent**: Hosted apply is operator work, not this commit.

**Contract**: Open **DEP-020** — apply `20260902140000_profile_plan_prefs.sql` to hosted `hard-feelings` via `supabase db push`. Source: `profile-plan-prefs`. Worker rollback does not undo SQL. Do not run hosted push here. Leave DEP-001–DEP-016 statuses unchanged.

### Success Criteria:

#### Automated Verification:

- `supabase/migrations/20260902140000_profile_plan_prefs.sql` exists with the locked columns, defaults, weekday/mix CHECKs, no new table, and no new policies
- `src/lib/test/migration-safety.test.ts` expects that filename as newest; distinctive profile `weekly_km` 42 still matches after it
- `context/deployment/deferred.md` has open DEP-020 for this migration; earlier DEP statuses unchanged
- `npm test` passes

---

## Phase 2: Types, persist, PUT/GET contract

### Overview

Extend `Profile`, `getProfile` / `upsertProfile`, zod, and `/api/profile` so GET returns the prefs and PUT persists them. Handler tests lock validation and extra-key stripping.

### Changes Required:

#### 1. Shared types

**File**: `src/types.ts`

**Intent**: One camelCase shape for the profile DTO.

**Contract**: Export `Weekday` as `'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'` (and a `WEEKDAYS` const array if useful). Extend `Profile` with `longWeekdays: Weekday[]`, `restWeekdays: Weekday[]`, `mixEasy`, `mixThreshold`, `mixSpeed` (numbers). Keep `weeklyKm: number` on `Profile`. `getProfile` may return `weeklyKm: number | null` plus the five fields always populated.

#### 2. Zod

**File**: `src/lib/services/profile-races.ts` (and extend `src/lib/services/profile-races.test.ts`)

**Intent**: PUT validation lives with the existing weekly-km schema, not inline in the route.

**Contract**: Export weekday enum, `longWeekdaysSchema` (min length 1, unique, every value a `Weekday`), `restWeekdaysSchema` (unique, may be empty), mix fields as integers 0–100, and a `profileWriteSchema` object: `weeklyKm` + the five fields with a refine that `mixEasy + mixThreshold + mixSpeed === 100`. Duplicates and unknown weekday strings fail. Extra keys are stripped by zod object parsing (same as other APIs). Unit-test the new schemas next to `weeklyKmSchema`.

#### 3. Profile service

**File**: `src/lib/services/profile.ts`

**Intent**: Read/write the new columns; tolerate sparse memory rows.

**Contract**:

- `select` includes `weekly_km, long_weekdays, rest_weekdays, mix_easy, mix_threshold, mix_speed`.
- Map arrays/numbers; on missing or unparsable prefs fields, use defaults `['sat']`, `[]`, `70`, `20`, `10`.
- `upsertProfile(client, userId, profile: Profile)` upserts all columns on `user_id` and returns the saved `Profile`.
- Persist weekdays unique and in Mon–Sun order.
- `deleteProfile` unchanged.

#### 4. Profile API

**File**: `src/pages/api/profile.ts`

**Intent**: GET/PUT speak the same DTO as the UI.

**Contract**: `prerender = false` stays. GET returns `{ weeklyKm, longWeekdays, restWeekdays, mixEasy, mixThreshold, mixSpeed }` (defaults when no row / sparse row). PUT parses `profileWriteSchema`; 400 `VALIDATION_ERROR` on failure; `upsertProfile` with the parsed object; ignore extra `userId` / `user_id`. DELETE unchanged. Do not add `/api/profile` to `PROTECTED_ROUTES`.

#### 5. GET/PUT tests

**File**: `src/pages/api/profile.test.ts` (new)

**Intent**: Contract tests for the locked persist path (test-plan §6.4).

**Contract**: `vi.mock("astro:env/server")` and `vi.mock("@/lib/supabase")` with `createMemorySupabase`. Logged-out GET/PUT → 401 `{ error: { code: "UNAUTHORIZED", message: "Sign in required" } }`, no `Location`. Signed-in GET with no row → `weeklyKm: null` and prefs defaults. Signed-in PUT of a valid body round-trips on GET and in the store (`long_weekdays` etc.). Empty `longWeekdays`, mix that does not sum to 100, unknown weekday, or non-integer mix → 400, store unchanged. Extra `userId` on a valid body → 200; persisted `user_id` is the session id; another member's profile row unchanged. Send literal JSON — do not `safeParse` the schema in the test.

### Success Criteria:

#### Automated Verification:

- `Profile` in `src/types.ts` includes `longWeekdays`, `restWeekdays`, `mixEasy`, `mixThreshold`, `mixSpeed`
- `getProfile` / `upsertProfile` / PUT zod accept and return those fields; GET no-row uses SQL defaults for prefs
- `src/pages/api/profile.test.ts` covers 401, GET defaults, PUT round-trip, invalid mix/long days 400, extra owner key stripped
- `npm test` passes

---

## Phase 3: Profile tab UI

### Overview

Pass SSR profile prefs into `SetupForm`. Render schedule checkboxes and stimulus mix under weekly km. One Save hits PUT with km + prefs. Source-scan locks copy and control names.

### Changes Required:

#### 1. Dashboard SSR wiring

**Files**: `src/pages/dashboard.astro`, `src/components/dashboard/DashboardTabs.tsx`

**Intent**: Hydrate the island from the server profile, not empty React state.

**Contract**: `getProfile` result (not only `weeklyKm`) is passed through `DashboardTabs` into `SetupForm` as `longWeekdays`, `restWeekdays`, `mixEasy`, `mixThreshold`, `mixSpeed` (plus existing `weeklyKm` / `races`). Catch block may still null `weeklyKm` and should pass prefs defaults in that failure path so the form is usable.

#### 2. SetupForm schedule + mix

**File**: `src/components/setup/SetupForm.tsx`

**Intent**: Persist-and-show the locked controls under weekly km.

**Contract**:

- Under the weekly km field, before the save button: heading **Preferred long-run days** — seven checkboxes Mon–Sun, values `mon`–`sun`; default Saturday checked when no stored value; save requires ≥1.
- Heading **Rest weekdays** — seven checkboxes; helper copy that none checked means every day is available.
- Heading **Stimulus mix** — three named numeric `%` fields **Easy** / **Threshold** / **Speed** via `FormField` (or the same input chrome), captions: Easy = base + recovery + long; Threshold = tempo + threshold; Speed = anaerobic, hills, strides — not gym. Live total must equal 100 before save. Thin proportion bar OK (`cn()` for widths/classes).
- One Save (existing weekly-km form): PUT `{ weeklyKm, longWeekdays, restWeekdays, mixEasy, mixThreshold, mixSpeed }` when km is non-empty; empty km still DELETE. Block PUT (inline error, no request) when zero long days or mix total ≠ 100. Merge classes with `cn()`. No `long_weekday` `<select>`. No load chart. Race calendar section unchanged.

#### 3. SetupForm source-scan

**File**: `src/components/setup/SetupForm.test.ts` (new)

**Intent**: Lock copy and control values without Playwright (test-plan §6.3).

**Contract**: `readFileSync` the tsx. Assert strings: `Preferred long-run days`, `Rest weekdays`, `Stimulus mix`, `Easy`, `Threshold`, `Speed`, the three captions, rest helper about none checked / every day available. Assert checkbox values `mon` through `sun` appear. Assert `long_weekday` (singular select) does not. Assert PUT body keys `longWeekdays`, `restWeekdays`, `mixEasy`, `mixThreshold`, `mixSpeed`. Assert no load-chart / Recharts / `training-load` markup.

### Success Criteria:

#### Automated Verification:

- `DashboardTabs` / `dashboard.astro` pass profile prefs into `SetupForm`
- `SetupForm.tsx` has the locked headings, seven+seven checkboxes (`mon`–`sun`), mix fields, and a PUT that includes the new keys; no `long_weekday` select
- `src/components/setup/SetupForm.test.ts` source-scan assertions pass
- `npm test` passes
- `npm run lint` passes

#### Manual Verification:

- On `/dashboard?tab=profile`, Saturday is checked by default on a profile with no stored prefs; unchecking all long-run days blocks save; checking Sun+Sat saves and reloads with both checked
- Rest weekdays: none checked shows the helper; checking Mon persists; mix 70/20/10 saves; 70/20/11 shows a total ≠ 100 and does not save; proportion bar tracks the three percents
- Generate / chat still only care about weekly km (prefs do not change the week)

---

## Testing Strategy

### Unit Tests:

- Weekday / mix / `profileWriteSchema` in `profile-races.test.ts`.
- Profile GET/PUT handler contracts in `profile.test.ts`.
- SetupForm source-scan in `SetupForm.test.ts`.
- Existing `migration-safety.test.ts` after the filename-list update.

### Integration Tests:

- Memory persist PUT then GET; extra `userId` does not retarget another member's row (Risk #5).
- Migrate-over-fixture on the new SQL (Risk #4) — already in Phase 1.

### Manual Testing Steps:

1. Sign in, open Profile, confirm defaults (Sat, empty rest, 70/20/10).
2. Change long-run to Sat+Sun, rest Mon, mix 60/30/10, Save, reload.
3. Confirm generate still runs from weekly km only.

## Performance Considerations

Profile is one row per member. Seven checkboxes and three numbers are negligible. No new round-trips beyond the existing PUT.

## Migration Notes

Expand-only `ALTER TABLE` with defaults: existing hosted rows get `'{sat}'`, `'{}'`, 70/20/10 when DEP-020 is applied. Worker rollback does not undo SQL. Until DEP-020, GET/PUT against hosted may 500 on missing columns — same class of window as prior product migrations.

## References

- Change notes: `context/changes/profile-plan-prefs/change.md`
- Prior profile slice: `context/archive/2026-08-13-profile-and-race-calendar/`
- Test cookbook: `context/foundation/test-plan.md` §6.4 / §6.5
- RLS original: `supabase/migrations/20260813104727_profiles_and_races.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration and hosted-apply record

#### Automated

- [x] 1.1 `supabase/migrations/20260902140000_profile_plan_prefs.sql` exists with the locked columns, defaults, weekday/mix CHECKs, no new table, and no new policies — 93cc5c3
- [x] 1.2 `src/lib/test/migration-safety.test.ts` expects that filename as newest; distinctive profile `weekly_km` 42 still matches after it — 93cc5c3
- [x] 1.3 `context/deployment/deferred.md` has open DEP-020 for this migration; earlier DEP statuses unchanged — 93cc5c3
- [x] 1.4 `npm test` passes — 93cc5c3

### Phase 2: Types, persist, PUT/GET contract

#### Automated

- [x] 2.1 `Profile` in `src/types.ts` includes `longWeekdays`, `restWeekdays`, `mixEasy`, `mixThreshold`, `mixSpeed` — 0415d8e
- [x] 2.2 `getProfile` / `upsertProfile` / PUT zod accept and return those fields; GET no-row uses SQL defaults for prefs — 0415d8e
- [x] 2.3 `src/pages/api/profile.test.ts` covers 401, GET defaults, PUT round-trip, invalid mix/long days 400, extra owner key stripped — 0415d8e
- [x] 2.4 `npm test` passes — 0415d8e

### Phase 3: Profile tab UI

#### Automated

- [x] 3.1 `DashboardTabs` / `dashboard.astro` pass profile prefs into `SetupForm` — 322e559
- [x] 3.2 `SetupForm.tsx` has the locked headings, seven+seven checkboxes (`mon`–`sun`), mix fields, and a PUT that includes the new keys; no `long_weekday` select — 322e559
- [x] 3.3 `src/components/setup/SetupForm.test.ts` source-scan assertions pass — 322e559
- [x] 3.4 `npm test` passes — 322e559
- [x] 3.5 `npm run lint` passes — 322e559

#### Manual

- [x] 3.6 On `/dashboard?tab=profile`, Saturday is checked by default on a profile with no stored prefs; unchecking all long-run days blocks save; checking Sun+Sat saves and reloads with both checked
- [x] 3.7 Rest weekdays: none checked shows the helper; checking Mon persists; mix 70/20/10 saves; 70/20/11 shows a total ≠ 100 and does not save; proportion bar tracks the three percents
- [x] 3.8 Generate / chat still only care about weekly km (prefs do not change the week)
