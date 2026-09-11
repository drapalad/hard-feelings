# Keep last race and notes when weekly km is cleared — Plan Brief

> Full plan: `context/changes/profile-keep-row-on-clear-km/plan.md`

## What & Why

Clearing Weekly km must not wipe last race, coach notes, or prefs. Today empty Save `DELETE`s the `profiles` row. Empty Save becomes in-page `PUT` with `weeklyKm: null`; the row stays.

## Starting Point

`weekly_km` is `NOT NULL`. SetupForm empty Save calls `DELETE /api/profile`. `ProfileView.weeklyKm` is already nullable for the no-row case. `asProfileRow` / `upsertProfile` treat null km as failure.

## Desired End State

Empty **Save weekly km** PUTs `weeklyKm: null` plus current long/rest/mix. After Save and after reload, km is empty, **No weekly km set yet** shows, and last race / notes / prefs remain. PATCH last race works on a null-km row. Hosted apply is DEP-029.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Clear-km click | In-page `fetch` PUT, not DELETE, not document load | Notes **Klik:** and S-134.1 | Plan |
| Empty Save payload | `{ weeklyKm: null, longWeekdays, restWeekdays, mixEasy, mixThreshold, mixSpeed }` | S-134.1; omit `coachNotes` so notes survive | Plan |
| Zod | `profileWriteSchema.weeklyKm` nullable; `weeklyKmSchema` stays number-only; 0 / negatives invalid | Notes; generate/chat still need a number schema | Plan |
| SQL | `weekly_km` nullable; CHECK `NULL OR (0 < km ≤ 300)` | Notes; no sentinel 0 | Plan |
| Hosted SQL | Open DEP-029; do not apply | Notes; test-plan §6.5 | Plan |
| API DELETE | Remove handler + `deleteProfile`; leave `profiles_delete_own` RLS | S-134.5; only this form used DELETE | Plan |
| Null-km row identity | `asProfileRow` accepts `weekly_km: null`; upsert uses `Omit<Profile, "weeklyKm">` plus `weeklyKm: number or null` | `Profile & { weeklyKm: null }` would stay `number` and reject null | Plan |
| Coach notes Save when km empty | Keep “Save weekly km before saving coach notes” | Notes did not unlock notes Save; don’t widen | Unattended |

## Scope

**In scope:** nullable `weekly_km`, PUT null, remove DELETE, SetupForm empty Save, API tests, migrate-over-fixture, DEP-029.

**Out of scope:** restyle, second Save, sentinel 0, hosted push, Playwright, generate/chat freeze behavior, notes-Save-without-km (FU-146).

## Architecture / Approach

Same PUT upsert as today, with `weekly_km` allowed to be JSON/SQL null. Form empty branch shares that PUT. Last-race PATCH is unchanged and succeeds because the row still exists.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema + service | Nullable column, zod null, get/upsert round-trip | `asProfileRow` still treating null as missing |
| 2. API contracts | DELETE gone; PUT/GET/PATCH tests | 0 used as sentinel; PATCH 404 on null km |
| 3. SetupForm | In-page PUT null; no profile DELETE | Reload vs in-page; leftover DELETE fetch |

**Prerequisites:** Notes S-134.* locked; in-memory Supabase tests (no hosted secrets).
**Estimated effort:** ~1 session, 3 phases.

## Open Risks & Assumptions

- Coach notes cannot be saved while km is empty (FU-146).
- Hosted DB stays on NOT NULL until DEP-029 is applied; local/tests use the new migration.
- Combined `ALTER TABLE` (or classified `DROP CONSTRAINT`) is required so migrate-over-fixture does not throw unclassified SQL.

## Success Criteria (Summary)

- Empty Save PUTs `weeklyKm: null` and does not DELETE.
- After Save and after reload, last race / notes / prefs remain; km empty + **No weekly km set yet**.
- PATCH last race works when `weekly_km` is null; no row still 404s.
