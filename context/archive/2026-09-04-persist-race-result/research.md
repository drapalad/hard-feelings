---
date: 2026-09-04T16:05:00+02:00
researcher: wave-audit
git_commit: 760e00179b4676413204b47e76f7a7b25770bdd0
branch: master
repository: hard-feelings
topic: "persist-race-result: files named in Notes"
tags: [research, wave-audit]
status: complete
last_updated: 2026-09-04
last_updated_by: wave-audit
---

# Research: persist-race-result

## Research Question
What exists at HEAD for the files listed in Notes?

## Summary

- Estimated paces is local `useState`: `refDistanceLabel` default `"10K"`, `refCustomKm`, `refTime` (`src/components/setup/SetupForm.tsx:129-145`, `:497-558`). `predictTimes` from `@/lib/services/pace-estimate`. No Save, no chip, no load from profile/races.
- `profiles` has weekly_km + weekdays + mix; no `last_race_*` (`supabase/migrations/20260813104727_profiles_and_races.sql:4-8`, `20260902140000_profile_plan_prefs.sql:5-21`).
- `races` has date, priority, goal, name — no finish time or distance km (`20260813104727_profiles_and_races.sql:10-18`). `Race` type matches (`src/types.ts:48-54`).
- Profile HTTP is GET / PUT / DELETE (`src/pages/api/profile.ts`). There is no PATCH. SetupForm saves prefs with PUT (`SetupForm.tsx:216-227`).
- `profileWriteSchema` is the six pref fields (`src/lib/services/profile-races.ts:49-60`). `SELECT_COLUMNS` has no last-race fields (`src/lib/services/profile.ts:4`).

## Code References

- `src/components/setup/SetupForm.tsx:129-145` - ref distance/time state + predictTimes
- `src/components/setup/SetupForm.tsx:497-558` - Estimated paces UI
- `src/components/setup/SetupForm.tsx:216-227` - PUT /api/profile prefs
- `src/types.ts:36-54` - Profile vs Race
- `src/lib/services/profile.ts:4` - SELECT_COLUMNS
- `src/lib/services/profile.ts:112-153` - get/upsert
- `src/lib/services/profile-races.ts:49-60` - profileWriteSchema
- `src/pages/api/profile.ts:9-62` - GET PUT DELETE
- `supabase/migrations/20260813104727_profiles_and_races.sql:4-18` - profiles + races columns

## Architecture Insights

Notes mention PATCH `/api/profile`; HEAD only has PUT of the full pref object. A last-race write either extends that PUT (and GET) or adds PATCH — both are new relative to HEAD. Races table cannot store finish time without a rejected (b) migration.

## Open Questions

- Test harness / migrate path for `last_race_date` / `last_race_km` / `last_race_time_sec` / optional `last_race_name` on `profiles` (`migration-safety.test.ts` filename list + UPDATE-seed restriction if a backfill UPDATE is used).
- `src/pages/api/profile.test.ts` exists; not fully read.
- Optional `last_race_name` vs chip copy `D MMM YYYY · {distance} · {time}` — formatter not in codebase.
- Collision with `user-coach-notes` on SetupForm / profile.ts / types.ts / api/profile.ts.
