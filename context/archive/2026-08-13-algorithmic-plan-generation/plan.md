# Algorithmic Plan Generation Implementation Plan

## Overview

Wire F-01’s existing `generatePlan` / `validatePlan` into persistence and the dashboard: a member generates a one-week plan from saved weekly km and races, optionally freezes in-week workouts and regenerates around them, and views the week on `/dashboard`. This is roadmap S-02 (FR-004, FR-013, FR-005 view-only).

## Current State Analysis

F-01 is on disk: `generatePlan` in `src/lib/services/generate-plan.ts` returns a 7-day `Plan` from `GenerateInput` (`weeklyKm`, `races: RaceInput[]`, `frozenUnits`, `weekStart`) or typed errors (`MISSING_WEEKLY_KM` / `INVALID_WEEKLY_KM` / `NO_A_RACE` / `UNSATISFIABLE_BOUNDS`). `validatePlan` is the hard-bound gate. No HTTP and no plan tables.

S-01 is on disk: `profiles` + `races` with RLS, JSON APIs (`prerender = false`, zod, 401 JSON via `unauthorized()`), `toRaceInput` dropping `id`/`name`, dashboard `SetupForm` island. Sign-in already redirects to `/dashboard`. `PROTECTED_ROUTES` is still `["/dashboard"]` only.

There is no `training_units` table, no `/api/plan`, and no calendar UI. DEP-008 (hosted `profiles`/`races`) is done; Worker rollback still does not undo SQL.

## Desired End State

A signed-in member with weekly km and at least one A race can generate a week, see seven days of type + km on `/dashboard`, freeze one or more in-week units, and regenerate so frozen anchors stay and the rest of the week is rewritten. Missing km or no A race surfaces F-01 codes (`MISSING_WEEKLY_KM` / `INVALID_WEEKLY_KM` / `NO_A_RACE`) — no second error schema. Stored rows map to `TrainingUnit` / `Plan`. Another member cannot read or write these rows. Unauthenticated JSON APIs return 401; `/api/plan*` is not on `PROTECTED_ROUTES`.

### Key Discoveries:

- `generatePlan` already copies in-week frozen units and fails closed on hard bounds (`src/lib/services/generate-plan.ts`). Do not rewrite it. S-02 is persist + HTTP + view/freeze UX.
- `toRaceInput` already exists (`src/types.ts:31-36`). Generate must call it; never pass `Race.name` or `Race.id` into `GenerateInput.races`.
- Missing km is a missing `profiles` row (`getProfile` → `weeklyKm: null`). Pass a non-finite `weeklyKm` into `generatePlan` so it returns `MISSING_WEEKLY_KM` — do not invent `KM_NOT_SET`.
- JSON APIs must not be added to `PROTECTED_ROUTES` (`src/middleware.ts:4-21`); middleware HTML-redirects would break `fetch`.
- Cookie SSR `createClient` only (`src/lib/supabase.ts`). RLS (`auth.uid() = user_id`) is isolation. No service role.
- Calendar dates are `YYYY-MM-DD`. F-01 uses `Date.UTC` on split Y-M-D (`addUtcDays`). Never `new Date("YYYY-MM-DD")`.
- `races.ts` + `races/[id].ts` coexist; the same Astro pattern works for `plan.ts` + `plan/units.ts`.
- Hosted SQL is a separate DEP: this slice’s migration needs **DEP-009**. Do not close DEP-001–DEP-008.

## What We're NOT Doing

- Inventing a training-science algorithm or changing `generatePlan` / `validatePlan` behavior (S-06).
- Manual edit of type/distance, undo, or version restore (S-04). FR-005 in this slice is **view** + freeze + generate.
- Chat, logging, Admin, FR-012 prefs, multiple A races, calling LLMs (S-03 / S-05 / S-06).
- Adding `name` or `id` onto `RaceInput`.
- Adding `/api/*` to `PROTECTED_ROUTES`, rebuilding auth, converting auth routes to JSON, or using a service-role / client Supabase key.
- Playwright / jsdom / CI Supabase.
- Closing DEP-001–DEP-008. Do not run `supabase login` / `db push` to hosted.
- Persisting validation results, multi-week generate in one request, or a season-long calendar.

## Implementation Approach

One table (`training_units`) owned by `auth.uid()`, one unit per member per date (matches F-01’s 7-day stub). JSON APIs load S-01 profile/races, map with `toRaceInput`, pass in-week frozen rows from the table into existing `generatePlan`, upsert that week’s rows on success. Dashboard adds a second React island: week grid, generate, freeze toggles. Vitest covers mapping, week-window helpers, generate-input assembly (name stripped; null km → F-01 code), and 401 JSON. The page is a human check.

## Critical Implementation Details

**Reuse F-01 as-is.** Call `generatePlan`; do not duplicate fill/validate logic in the API. On `ok: false`, return HTTP 400 with `{ error: { code, message } }` using the generator’s `code` and `message` unchanged.

**Replace only the 7-day window.** APIs normalize `weekStart` with `utcMondayOf` so a Thursday query still means Mon–Sun. Persist via upsert on `(user_id, date)` for the seven `generatePlan` units — do not delete-then-insert (PostgREST is not a transaction; a failed insert after delete would empty the week). Other weeks stay. Frozen units in the window are loaded from DB and passed as `frozenUnits`; `generatePlan` copies them onto the new plan.

**Missing km uses F-01.** If `getProfile` returns `weeklyKm: null`, call `generatePlan` with `weeklyKm: Number.NaN` (or any non-finite). Do not add a new error code.

**JSON APIs are not `PROTECTED_ROUTES`.** Handlers return `401` JSON when `locals.user` is missing. Keep `/dashboard` on the list; do not add `/api/plan`.

**Anon + user JWT, not service role.** Reuse `createClient`. Wrap DB work in try/catch and return JSON `DB_ERROR` (S-01 impl-review: do not let PostgREST throws become a non-JSON 500).

**UTC dates.** Week Monday and day arithmetic use `Date.UTC` on split Y-M-D parts, same as F-01. Never `new Date("YYYY-MM-DD")`. `utcMondayOf` must treat UTC Sunday as the *previous* Monday (`getUTCDay() === 0` → offset `-6`, not `+1`). Default `weekStart` when omitted: `utcMondayOf(utcToday())`.

---

## Phase 1: Schema and RLS

### Overview

Persist generated units (including frozen) per member, with RLS and one-row-per-day so F-01’s week maps 1:1.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_training_units.sql` (new; timestamp at implement time)

**Intent**: Store the generated week so regenerate can reload frozen anchors and the dashboard can view units without re-running generate on every paint.

**Contract**:

- `training_units`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`; `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`; `date date NOT NULL`; `type text NOT NULL` with `CHECK (type IN ('base','recovery','tempo','threshold','anaerobic','long'))`; `distance_km numeric NOT NULL` with `CHECK (distance_km >= 0)`; `structure text`; `frozen boolean NOT NULL DEFAULT false`; `UNIQUE (user_id, date)`.
- `ENABLE ROW LEVEL SECURITY` and four policies (SELECT, INSERT, UPDATE, DELETE) using `auth.uid() = user_id`. No combined ALL policy.

#### 2. Deploy backlog

**File**: `context/deployment/deferred.md`

**Intent**: Record that this slice’s SQL must be applied to hosted Supabase separately from Worker deploys.

**Contract**: Append **DEP-009** (next free id): apply the `training_units` migration to the hosted project behind `SUPABASE_URL`; Source = this plan; note Worker rollback does not undo SQL. Leave DEP-001–DEP-008 unchanged (008 stays done).

### Success Criteria:

#### Automated Verification:

- `supabase/migrations/` contains a `*_training_units.sql` file with `training_units` as specified (workout-type check, `distance_km >= 0`, unique `(user_id, date)`, FK to `auth.users`, `frozen` default false)
- The table enables RLS with separate SELECT, INSERT, UPDATE, and DELETE policies on `auth.uid() = user_id`
- `context/deployment/deferred.md` has an open DEP-009 for applying this migration to hosted Supabase; DEP-001–DEP-008 statuses are unchanged

---

## Phase 2: Mapping, week window, and generate-input assembly

### Overview

Lock UTC week helpers and the stored-row ↔ `TrainingUnit` / `GenerateInput` mapping in Vitest before HTTP.

### Changes Required:

#### 1. UTC week helpers

**File**: `src/lib/dates.ts` (new) — F-01 forbade a shared dates module in that slice; S-02 needs the same arithmetic in service, API default, and UI.

**Intent**: One UTC implementation so APIs and the island cannot drift into local `Date` parsing.

**Contract**: Export `addUtcDays(isoDate: string, n: number): string` (same algorithm as `generate-plan.ts`), `utcToday(): string`, `utcMondayOf(isoDate: string): string` (ISO Monday of the UTC calendar week containing `isoDate`; Sunday maps backward), `weekDates(weekStart: string): string[]` (seven dates from `utcMondayOf(weekStart)`). Input/output are `YYYY-MM-DD`. Do not use `new Date("YYYY-MM-DD")`.

#### 2. Row mapping and generate-input builder

**File**: `src/lib/services/plan.ts` (new), colocated `src/lib/services/plan.test.ts`

**Intent**: Keep PostgREST and `generatePlan` call-shape out of route files; prove `Race.name` never enters generate.

**Contract**:

- Map DB row ↔ `TrainingUnit`: `date` as `YYYY-MM-DD` string; `type`; `distanceKm` from `distance_km`; optional `structure`; `frozen`. No extra fields.
- `buildGenerateInput({ weeklyKm, races, frozenUnits, weekStart })`: `races` are `Race[]`; internally `races.map(toRaceInput)`. If `weeklyKm` is `null`, pass `Number.NaN`. Return a `GenerateInput`.
- Zod: `weekStartSchema` — `YYYY-MM-DD` string (same ISO-date regex as races). Freeze write: `{ date: YYYY-MM-DD, frozen: boolean }`.
- Do not import or wrap a second error-code union; tests that call `generatePlan(buildGenerateInput(...))` assert F-01 codes.

### Success Criteria:

#### Automated Verification:

- `src/lib/dates.ts` exports `addUtcDays`, `utcToday`, `utcMondayOf`, `weekDates`; `weekDates` of a Monday is seven consecutive UTC days; `utcMondayOf("2026-08-13")` and `utcMondayOf("2026-08-16")` are both `"2026-08-10"`
- Mapping round-trips a unit with `structure` and `frozen: true`; omits `structure` when null/empty
- `buildGenerateInput` with a named race produces `GenerateInput.races` that have only `date`, `priority`, and optional `goal` (no `id`/`name`)
- `generatePlan(buildGenerateInput({ weeklyKm: null, races: [A], frozenUnits: [], weekStart }))` returns `ok: false` with `MISSING_WEEKLY_KM`; races with no A returns `NO_A_RACE`
- `npm test` exits 0
- `npm run lint` exits 0

---

## Phase 3: Services and APIs

### Overview

Authenticated JSON: load a week, generate+persist a week, toggle freeze. Session from cookies.

### Changes Required:

#### 1. Data services

**File**: `src/lib/services/plan.ts` (extend Phase 2)

**Intent**: Handlers stay parse → authorize → service → respond.

**Contract**: Functions take a Supabase client plus `user.id`.

- `listWeek(client, userId, weekStart)` → `TrainingUnit[]` for dates in `weekDates(weekStart)` (already Monday-normalized), ordered by date.
- `replaceWeek(client, userId, weekStart, units)` → upsert the seven units on `(user_id, date)` (the full `generatePlan` plan for that week). Do not delete the window first.
- `setFrozen(client, userId, date, frozen)` → update `frozen` on that user’s row for `date`; missing row → typed `NOT_FOUND`.
- `generateAndPersist(client, userId, weekStart)`: `getProfile` + `listRaces` + `listWeek`; `frozenUnits` = in-week units with `frozen === true`; `buildGenerateInput` + `generatePlan`; on `ok: false` return that error; on `ok: true` `replaceWeek` with `result.plan.units` and return `{ plan, validation }`.
- Do not call a service-role client. Do not pass `Race` objects into `generatePlan`.

#### 2. HTTP routes

**File**: `src/pages/api/plan.ts`, `src/pages/api/plan/units.ts` (new)

**Intent**: Cookie JSON APIs for the calendar island; 401 must be JSON.

**Contract**: Each file exports `const prerender = false`. If `locals.user` is null → `unauthorized()` (401 `{ error: { code: "UNAUTHORIZED", message } }`). Bodies/query via zod from Phase 2. try/catch around DB → `jsonError(500, "DB_ERROR", message)`.

- `GET /api/plan?weekStart=` → `{ weekStart, units: TrainingUnit[] }`. Omitted `weekStart` → `utcMondayOf(utcToday())`. Present but not `YYYY-MM-DD` → 400 `VALIDATION_ERROR`. Valid date → normalize with `utcMondayOf` and return that Monday as `weekStart`.
- `POST /api/plan` body `{ weekStart?: string }` → same omit/validate/normalize rules; on generate failure 400 with F-01 `{ error: { code, message } }`; on success `{ weekStart, plan, validation }` (`weekStart` is the normalized Monday).
- `PATCH /api/plan/units` body `{ date, frozen }` → updated `TrainingUnit`; `404` `{ error: { code: "NOT_FOUND", message } }` when no unit on that date.

Do not add these paths to `PROTECTED_ROUTES`. Auth routes stay formData/redirect.

### Success Criteria:

#### Automated Verification:

- Plan API files export `prerender = false`
- Handlers return 401 JSON (not a redirect) when `locals.user` is missing
- `PROTECTED_ROUTES` still does not include `/api/plan`
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

---

## Phase 4: Calendar view and freeze UX

### Overview

Show the generated week on `/dashboard`, generate from saved km + races, freeze in-week units and regenerate. No manual type/km edit.

### Changes Required:

#### 1. Dashboard island

**File**: `src/pages/dashboard.astro`, new island under `src/components/plan/` (e.g. `PlanCalendar.tsx`)

**Intent**: Interactivity (generate, freeze, week change) needs an island; first paint should show server-loaded units, not an empty flash.

**Contract**: `dashboard.astro` stays on `PROTECTED_ROUTES`. Server-load current UTC week via `listWeek` (same `createClient` as profile/races) and pass `{ weekStart, units }` as props. Keep `SetupForm`. Widen the dashboard content column if needed so seven days fit (today `max-w-2xl`). New island: 7-day calendar (date, type, distance km); empty copy when no units; Generate button `POST /api/plan` with displayed `weekStart`; per-unit freeze control `PATCH /api/plan/units` (persists flag only — does not regenerate); Generate again reloads frozen rows as anchors. Prev/next week using `addUtcDays(weekStart, ±7)` and `GET /api/plan`. `fetch` with `credentials: "same-origin"`. Surface F-01 error `message` (and `code`) for `MISSING_WEEKLY_KM` / `INVALID_WEEKLY_KM` / `NO_A_RACE` / `UNSATISFIABLE_BOUNDS`. May show `validation.soft` after a successful generate. Reuse `Button` / `ServerError` and `cn()`. No `"use client"`. No inputs that change `type` or `distanceKm`.

### Success Criteria:

#### Automated Verification:

- `src/pages/dashboard.astro` hydrates a plan calendar island in addition to `SetupForm`
- The island has generate and freeze controls and does not expose type/distance edit fields
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Sign in; with weekly km and an A race, Generate fills a 7-day calendar; reload keeps the week
- Generate with no weekly km shows `MISSING_WEEKLY_KM`; with km but no A race shows `NO_A_RACE`
- Freeze one in-week workout and Generate again: that day’s type and km stay, other days may change
- Calendar has no control that edits type or distance (view + freeze + generate only)

---

## Testing Strategy

### Unit Tests:

- UTC: `addUtcDays`, `utcMondayOf("2026-08-13") === "2026-08-10"`, `weekDates` length 7.
- Row ↔ `TrainingUnit` round-trip; `structure` omitted when empty.
- `buildGenerateInput` strips `id`/`name`; null km → `MISSING_WEEKLY_KM`; no A → `NO_A_RACE`.
- Existing `unauthorized()` 401 JSON test remains; add the same assertion style if plan handlers extract a shared helper (optional — file-level `prerender` + 401 checks may be source inspection).

### Integration Tests:

- None in CI (no Supabase in GHA). Local `npx supabase db reset` proves the migration applies; not a Progress Manual row.

### Manual Testing Steps:

1. `npx supabase start` and apply migrations; sign in; set km + A race on `/dashboard`.
2. Generate; confirm seven days; reload.
3. Hit missing-km and no-A errors; freeze + regenerate; confirm no type/km editors.

## Performance Considerations

One week, ≤7 rows. Replace-week is upsert of those seven dates. Island `client:load` is enough. Do not treat this slice as a reason to close DEP-002.

## Migration Notes

Additive table. Local: `npx supabase db reset` (or `migration up`) after start. Hosted: apply the new file via DEP-009 **before** expecting production generate to persist. Rolling back the Worker does not drop `training_units`. No backfill (no existing plan rows). Empty week = no rows = empty calendar.

## References

- Roadmap S-02: `context/foundation/roadmap.md`
- PRD: US-01, FR-004, FR-013, FR-005 (view in this slice) — `context/foundation/prd.md`
- F-01: `src/types.ts`, `src/lib/services/generate-plan.ts`, `src/lib/services/validate-plan.ts`
- S-01: `src/pages/api/profile.ts`, `src/pages/api/races.ts`, `src/pages/dashboard.astro`, `toRaceInput`
- AGENTS: zod APIs, `prerender = false`, RLS migrations, `PROTECTED_ROUTES`, `cn()`
- Deploy backlog: `context/deployment/deferred.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and RLS

#### Automated

- [x] 1.1 `supabase/migrations/` contains a `*_training_units.sql` file with `training_units` as specified (workout-type check, `distance_km >= 0`, unique `(user_id, date)`, FK to `auth.users`, `frozen` default false) — e188854
- [x] 1.2 The table enables RLS with separate SELECT, INSERT, UPDATE, and DELETE policies on `auth.uid() = user_id` — e188854
- [x] 1.3 `context/deployment/deferred.md` has an open DEP-009 for applying this migration to hosted Supabase; DEP-001–DEP-008 statuses are unchanged — e188854

### Phase 2: Mapping, week window, and generate-input assembly

#### Automated

- [x] 2.1 `src/lib/dates.ts` exports `addUtcDays`, `utcToday`, `utcMondayOf`, `weekDates`; `weekDates` of a Monday is seven consecutive UTC days; `utcMondayOf("2026-08-13")` and `utcMondayOf("2026-08-16")` are both `"2026-08-10"` — 8267b72
- [x] 2.2 Mapping round-trips a unit with `structure` and `frozen: true`; omits `structure` when null/empty — 8267b72
- [x] 2.3 `buildGenerateInput` with a named race produces `GenerateInput.races` that have only `date`, `priority`, and optional `goal` (no `id`/`name`) — 8267b72
- [x] 2.4 `generatePlan(buildGenerateInput({ weeklyKm: null, races: [A], frozenUnits: [], weekStart }))` returns `ok: false` with `MISSING_WEEKLY_KM`; races with no A returns `NO_A_RACE` — 8267b72
- [x] 2.5 `npm test` exits 0 — 8267b72
- [x] 2.6 `npm run lint` exits 0 — 8267b72

### Phase 3: Services and APIs

#### Automated

- [x] 3.1 Plan API files export `prerender = false` — cedbf4a
- [x] 3.2 Handlers return 401 JSON (not a redirect) when `locals.user` is missing — cedbf4a
- [x] 3.3 `PROTECTED_ROUTES` still does not include `/api/plan` — cedbf4a
- [x] 3.4 `npm test` exits 0 — cedbf4a
- [x] 3.5 `npm run lint` exits 0 — cedbf4a
- [x] 3.6 `npm run build` exits 0 — cedbf4a

### Phase 4: Calendar view and freeze UX

#### Automated

- [x] 4.1 `src/pages/dashboard.astro` hydrates a plan calendar island in addition to `SetupForm` — 1c52dba
- [x] 4.2 The island has generate and freeze controls and does not expose type/distance edit fields — 1c52dba
- [x] 4.3 `npm run lint` exits 0 — 1c52dba
- [x] 4.4 `npm run build` exits 0 — 1c52dba

#### Manual

- [x] 4.5 Sign in; with weekly km and an A race, Generate fills a 7-day calendar; reload keeps the week — 1c52dba
- [x] 4.6 Generate with no weekly km shows `MISSING_WEEKLY_KM`; with km but no A race shows `NO_A_RACE` — 1c52dba
- [x] 4.7 Freeze one in-week workout and Generate again: that day’s type and km stay, other days may change — 1c52dba
- [x] 4.8 Calendar has no control that edits type or distance (view + freeze + generate only) — 1c52dba
