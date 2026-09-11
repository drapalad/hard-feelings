# Keep last race and notes when weekly km is cleared — Implementation Plan

## Overview

Stop deleting the `profiles` row when Weekly km is cleared. Empty Weekly km Save sends in-page `PUT /api/profile` with `weeklyKm: null` plus current long/rest/mix. `weekly_km` becomes nullable. Last race, coach notes, and prefs stay on the row. Remove SetupForm `DELETE` and the API `DELETE` handler.

## Current State Analysis

`profiles.weekly_km` is `NOT NULL` with `CHECK (weekly_km > 0 AND weekly_km <= 300)` (`20260813104727_profiles_and_races.sql`). Clearing km in SetupForm `saveKm` `fetch`es `DELETE /api/profile`, which calls `deleteProfile` and drops the whole row — last race, coach notes, and prefs go with it (FU-134).

`ProfileView.weeklyKm` is already `number | null` (no-row GET returns null). `Profile.weeklyKm` stays a number for generate/chat. `profileWriteSchema.weeklyKm` uses `weeklyKmSchema` (gt 0, lte 300, one decimal) — JSON `null` is 400 today.

`getProfile` → `asProfileRow` rejects `weekly_km: null` (`typeof` not number/string), so a nullable SQL value would look like no row and return `emptyProfileView()` (wiping prefs/last race/notes in the JSON even if the row existed). `upsertProfile` throws `"Failed to save weekly km"` when `savedKm === null`.

PATCH `updateLastRace` 404s only when `asProfileRow` fails (no row). Chat freeze already refuses `resolvedWeeklyKm === null` (`MISSING_WEEKLY_KM`). Generate already no-ops when `profile.weeklyKm === null` (`src/lib/services/plan.ts`).

SetupForm empty-km branch does not send long/rest/mix. After DELETE it only `setWeeklyKm(null)` — last-race React state happens to survive because DELETE never updated it, but reload GET is empty. Coach notes Save still requires a parseable weekly km (`saveCoachNotes`).

`deleteProfile` / `DELETE` are only used by this form and `profile.test.ts`. RLS `profiles_delete_own` stays (not dropped).

The migrate-over-fixture harness ignores `ALTER TABLE … ALTER COLUMN` and `ADD CONSTRAINT`, but **throws on unclassified `DROP CONSTRAINT`**. A split `DROP CONSTRAINT` statement will fail `migration-safety.test.ts` unless the harness classifies it or the SQL is one `ALTER TABLE` whose first action is `ALTER COLUMN` (the existing ignore regex).

Repo-wide `npm run lint` is red at HEAD on untouched files. Phase gates use scoped eslint on the touched set, `npm test`, and `npx astro check` — not repo-wide lint. `npm run build` needs `SUPABASE_*`; do not use it as a gate.

## Desired End State

A member who clears Weekly km and clicks **Save weekly km** keeps their `profiles` row. The request is in-page `PUT` with `weeklyKm: null` and the current long/rest/mix (not DELETE, not a document load). After Save without reload: km input empty, **No weekly km set yet** visible, last race / notes / long / rest / mix unchanged. GET/reload: `weeklyKm` null; last race, notes, prefs unchanged. PATCH last race still 200 when km is null. Zod accepts `null`; 0 and negatives stay invalid. No second Save. Hosted SQL is DEP-029 only.

### Key Discoveries:

- `asProfileRow` + `upsertProfile`’s `savedKm === null` throw are load-bearing. Nullable SQL without those two changes makes GET look like no row and PUT 500.
- Km Save must **omit** `coachNotes` (existing omit-to-preserve). Empty Save must still send long/rest/mix (S-134.1).
- `weeklyKmSchema` stays number-only (chat freeze / generate). Null is only on `profileWriteSchema.weeklyKm`.
- Harness: prefer a single `ALTER TABLE` starting with `ALTER COLUMN weekly_km DROP NOT NULL`, then `DROP CONSTRAINT` / `ADD CONSTRAINT` in the same statement so `applyStatement` classifies it. Also classify `DROP CONSTRAINT` as a no-op so a split statement cannot fail CI.
- Newest migration today: `20260904210000_chat_profile_freeze_pending_races_patch.sql`. New file sorts after it. Update the ordered list and `newest.name` in `migration-safety.test.ts`.

## What We're NOT Doing

- Sentinel `weekly_km = 0`.
- Restyling the Profile tab or renaming **Save weekly km**.
- A second Save / extra chrome.
- Changing Coach notes Save (still requires parseable weekly km — FU-146).
- Dropping `profiles_delete_own` RLS.
- Changing generate/chat freeze null-km gates.
- Putting `weeklyKm: number | null` on `Profile` / `ProfilePatch`.
- Hosted `db push` (DEP-029).
- Playwright / e2e.
- Fixing HEAD lint outside the touched set.
- `npm run build` as a gate (no `.env` / `.dev.vars` in this worktree).

## Implementation Approach

Three phases: (1) nullable column + zod + service + harness; (2) API DELETE removal + contract tests; (3) SetupForm PUT-null path + source-read tests. DEP-029 and FU-146 are written at plan time; include them in the Phase 1 commit.

## Critical Implementation Details

**GET must see a null-km row as a row.** `asProfileRow` must accept `weekly_km: null`. Otherwise S-134.3 fails: reload looks like never-saved prefs.

**PUT omit coachNotes.** Empty-km Save sends `weeklyKm: null` + long/rest/mix only. Do not send `coachNotes`. Do not send last-race fields.

**Form empty branch uses the same PUT as numeric Save.** Parse prefs with `profileWriteSchema` and `weeklyKm: null`. Invalid mix/long still 400 / client error. After 200, `setWeeklyKm(null)` and keep `kmInput` `""`; do not clear last-race or notes state; do not `location.reload()`.

**First empty Save with no row.** PUT upserts a prefs row with `weekly_km` null (existing upsert). PATCH last race can then succeed (S-134.4).

## Phase 1: Nullable weekly_km, write schema, and profile service

### Overview

Make `weekly_km` nullable with the locked CHECK, accept `null` on PUT zod, and round-trip a null-km row in `getProfile` / `upsertProfile` without treating it as missing.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260905120000_profile_weekly_km_nullable.sql`

**Intent**: Allow SQL NULL weekly km so clearing km does not require deleting the row. Existing owner RLS stays.

**Contract**: One `ALTER TABLE profiles` that (in order) `ALTER COLUMN weekly_km DROP NOT NULL`, `DROP CONSTRAINT profiles_weekly_km_bounds`, `ADD CONSTRAINT profiles_weekly_km_bounds CHECK (weekly_km IS NULL OR (weekly_km > 0 AND weekly_km <= 300))`. Comment that Worker rollback does not undo this SQL. No `UPDATE`, no `DROP POLICY`, no `CREATE POLICY`. Filename sorts after `20260904210000_chat_profile_freeze_pending_races_patch.sql`.

#### 2. Migration harness

**File**: `src/lib/test/migration-safety.ts`

**Intent**: `DROP CONSTRAINT` must not fail the migrate-over-fixture classifier.

**Contract**: Classify `ALTER TABLE … DROP CONSTRAINT` as a no-op (same as `ADD CONSTRAINT`). Seed rows unchanged.

**File**: `src/lib/test/migration-safety.test.ts`

**Intent**: Ordered corpus includes the new file as newest.

**Contract**: Append `20260905120000_profile_weekly_km_nullable.sql` to the filename list. `newest.name` is that file.

#### 3. PUT write schema

**File**: `src/lib/services/profile-races.ts`

**Intent**: PUT accepts `weeklyKm: null`. 0, negatives, >300, extra decimals stay invalid.

**Contract**: `profileWriteSchema.weeklyKm` is `weeklyKmSchema.nullable()` (or equivalent union with `z.null()`). Do not change `weeklyKmSchema` itself. Mix/long/rest/coachNotes rules unchanged. Extra keys still strip.

**File**: `src/lib/services/profile-races.test.ts`

**Intent**: Lock null vs 0 at the schema.

**Contract**: `profileWriteSchema.safeParse({ …VALID_PROFILE, weeklyKm: null })` succeeds with `weeklyKm: null`. `weeklyKm: 0` and `-1` still fail. Existing `weeklyKmSchema` tests unchanged.

#### 4. Profile service

**File**: `src/lib/services/profile.ts`

**Intent**: Null km is a persisted value, not “no profile”.

**Contract**:
- `ProfileRow.weekly_km` allows `null`.
- `asProfileRow`: object with `weekly_km` that is `null | number | string` is a row; missing `weekly_km` key is still not a row.
- `upsertProfile(client, userId, profile: Omit<Profile, "weeklyKm"> & { weeklyKm: number | null; coachNotes?: string | null })` writes `weekly_km: profile.weeklyKm` (including `null`). Do **not** write `Profile & { weeklyKm: number | null }` — `Profile.weeklyKm` is `number`, so that intersection stays `number` and rejects `null`. Throw only if the returned row is missing, **not** when `parseWeeklyKm` is null. Chat freeze still passes a `Profile` (always a number).
- `getProfile` / `updateLastRace` keep using `toProfileView(row, parseWeeklyKm(row.weekly_km))` so GET/PATCH return `weeklyKm: null` when the column is null.
- Keep `deleteProfile` until Phase 2 so the API still compiles.

#### 5. Plan-time records (commit with this phase)

**File**: `context/deployment/deferred.md`

**Contract**: Open `DEP-029` — apply this migration to hosted Supabase. Do not apply hosted SQL in this change.

**File**: `context/backlog.md`

**Contract**: Open `FU-146` — Coach notes Save still requires weekly km after km is cleared.

### Success Criteria:

#### Automated Verification:

- `src/lib/test/migration-safety.test.ts` lists `20260905120000_profile_weekly_km_nullable.sql` as newest and migrate-over-fixture stays green
- `npm test -- src/lib/services/profile-races.test.ts src/lib/test/migration-safety.test.ts`
- Touched-file eslint: `npx eslint src/lib/test/migration-safety.ts src/lib/test/migration-safety.test.ts src/lib/services/profile-races.ts src/lib/services/profile-races.test.ts src/lib/services/profile.ts`
- `npx astro check`

---

## Phase 2: Remove DELETE; PUT/GET/PATCH contracts for null km

### Overview

Drop HTTP `DELETE /api/profile` and `deleteProfile`. Prove PUT null keeps the row and last race / notes / prefs; GET returns null km; PATCH last race still 200.

### Changes Required:

#### 1. API route

**File**: `src/pages/api/profile.ts`

**Intent**: Clearing km is PUT, not DELETE. Nothing else called DELETE.

**Contract**: Remove `DELETE` export and `deleteProfile` import. GET/PUT/PATCH unchanged aside from PUT now accepting `weeklyKm: null` via the Phase 1 schema. `prerender = false` stays.

**File**: `src/lib/services/profile.ts`

**Intent**: Dead delete helper gone.

**Contract**: Remove `deleteProfile`.

#### 2. API contract tests

**File**: `src/pages/api/profile.test.ts`

**Intent**: S-134.1 / S-134.3 / S-134.4 at the HTTP boundary. Risk #5: 0 is not a clear-km sentinel.

**Contract**:
- Remove the `profile DELETE` describe (or replace with 405/no export — prefer delete the tests and the handler).
- PUT `{ ...VALID_BODY, weeklyKm: null }` on a row that already has last race, coach notes, and prefs: 200, JSON `weeklyKm: null`, last-race fields and `coachNotes` unchanged, store still has the session row with `weekly_km: null`.
- PUT `weeklyKm: 0` and `weeklyKm: -1` stay 400 `VALIDATION_ERROR` and do not write.
- GET after that PUT: `weeklyKm: null`; last race / notes / long/rest/mix match pre-clear.
- PATCH last race on a row with `weekly_km: null` returns 200 and persists last race; still 404 when there is **no** row.
- PUT null still omits-to-preserve notes when `coachNotes` is absent from the body.
- Keep existing 401 / owner-strip / mix validation tests.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/pages/api/profile.test.ts`
- `npm test`
- Touched-file eslint: `npx eslint src/pages/api/profile.ts src/pages/api/profile.test.ts src/lib/services/profile.ts`
- `npx astro check`

---

## Phase 3: SetupForm empty-km PUT (in-page)

### Overview

Empty Weekly km Save uses the same in-page PUT as numeric Save, with `weeklyKm: null` plus current long/rest/mix. Remove the DELETE path. After success, show **No weekly km set yet** without reload.

### Changes Required:

#### 1. Form

**File**: `src/components/setup/SetupForm.tsx`

**Intent**: S-134.1, S-134.2, S-134.5. Locked **Klik:** in-page fetch PUT.

**Contract**:
- `saveKm`: empty `kmInput.trim()` does **not** `fetch` DELETE. It `profileWriteSchema.safeParse`s `{ weeklyKm: null, longWeekdays, restWeekdays, mixEasy, mixThreshold, mixSpeed }` (no `coachNotes`) and `PUT /api/profile` with those fields.
- Numeric branch unchanged except it can share the PUT helper.
- On 200 with `weeklyKm === null`: `setWeeklyKm(null)`; leave `kmInput` `""`; do not reset last-race, notes, long/rest, or mix state; no `location` / full document load.
- Keep the existing **No weekly km set yet** paragraph gated on `weeklyKm === null`.
- Keep one **Save weekly km** button. Do not add a Save.
- `saveCoachNotes` still requires a parseable weekly km (FU-146).
- Last-race PATCH path unchanged.

#### 2. Source-read tests

**File**: `src/components/setup/SetupForm.test.ts`

**Intent**: Lock PUT-null and no profile DELETE without Playwright.

**Contract**: Assert `saveKm` / empty path sends `weeklyKm: null` and `method: "PUT"`. Assert the file does not `fetch("/api/profile", { method: "DELETE"`. Keep race DELETE (`/api/races/`) assertions out of this negative. Assert **No weekly km set yet** remains.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/setup/SetupForm.test.ts src/pages/api/profile.test.ts`
- `npm test`
- Touched-file eslint: `npx eslint src/components/setup/SetupForm.tsx src/components/setup/SetupForm.test.ts`
- `npx astro check`

#### Manual Verification:

- On Profile, with weekly km, last race, coach notes, and mix filled: clear Weekly km, click **Save weekly km**. Without reload: km input empty, **No weekly km set yet** visible, last race / notes / long / rest / mix unchanged. Reload: km still empty, last race / notes / prefs still filled. PATCH last race still saves.

---

## Testing Strategy

### Unit Tests:

- `profileWriteSchema` accepts `weeklyKm: null`; rejects 0 / negatives.
- SetupForm source-read: PUT null, no profile DELETE.

### Integration Tests:

- PUT null keeps the row and last race / notes / prefs (memory Supabase).
- GET after clear returns `weeklyKm: null` and unchanged extras.
- PATCH last race on null-km row: 200; no-row: 404.
- migrate-over-fixture over the new SQL keeps Member A `weekly_km: 42`.

### Manual Testing Steps:

1. Dashboard → Profile. Fill km, mix, last race, notes. Save each as today.
2. Clear Weekly km → **Save weekly km**. Confirm S-134.2 without reload.
3. Reload the page. Confirm S-134.3.
4. Save last race again. Confirm it persists (S-134.4).

## Performance Considerations

None. One PUT, same payload shape plus a JSON null.

## Migration Notes

Additive nullability. Existing rows keep their `weekly_km` values; CHECK still forbids 0. Rollback of the Worker does not undo hosted SQL. Apply on hosted via DEP-029 only. Do not run `supabase db push` against hosted from this change. Local `HF_MIGRATION_PG=1` is skippable and not a gate.

## References

- Notes: `context/changes/profile-keep-row-on-clear-km/change.md`
- Promoted from: FU-134
- Similar omit-to-preserve: `context/archive/2026-09-04-user-coach-notes/plan.md`
- Test-plan §6.5 (migration data safety) and §6.3 (no Playwright)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Nullable weekly_km, write schema, and profile service

#### Automated

- [x] 1.1 `src/lib/test/migration-safety.test.ts` lists `20260905120000_profile_weekly_km_nullable.sql` as newest and migrate-over-fixture stays green — b60e84b
- [x] 1.2 `npm test -- src/lib/services/profile-races.test.ts src/lib/test/migration-safety.test.ts` — b60e84b
- [x] 1.3 Touched-file eslint: `npx eslint src/lib/test/migration-safety.ts src/lib/test/migration-safety.test.ts src/lib/services/profile-races.ts src/lib/services/profile-races.test.ts src/lib/services/profile.ts` — b60e84b
- [x] 1.4 `npx astro check` — b60e84b

### Phase 2: Remove DELETE; PUT/GET/PATCH contracts for null km

#### Automated

- [x] 2.1 `npm test -- src/pages/api/profile.test.ts` — 0a80ea5
- [x] 2.2 `npm test` — 0a80ea5
- [x] 2.3 Touched-file eslint: `npx eslint src/pages/api/profile.ts src/pages/api/profile.test.ts src/lib/services/profile.ts` — 0a80ea5
- [x] 2.4 `npx astro check` — 0a80ea5

### Phase 3: SetupForm empty-km PUT (in-page)

#### Automated

- [x] 3.1 `npm test -- src/components/setup/SetupForm.test.ts src/pages/api/profile.test.ts` — 4aada30
- [x] 3.2 `npm test` — 4aada30
- [x] 3.3 Touched-file eslint: `npx eslint src/components/setup/SetupForm.tsx src/components/setup/SetupForm.test.ts` — 4aada30
- [x] 3.4 `npx astro check` — 4aada30

#### Manual

- [x] 3.5 On Profile, with weekly km, last race, coach notes, and mix filled: clear Weekly km, click **Save weekly km**. Without reload: km input empty, **No weekly km set yet** visible, last race / notes / long / rest / mix unchanged. Reload: km still empty, last race / notes / prefs still filled. PATCH last race still saves.
