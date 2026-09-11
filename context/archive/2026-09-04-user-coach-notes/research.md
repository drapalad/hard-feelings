---
date: 2026-09-04T16:05:00+02:00
researcher: wave-audit
git_commit: 760e00179b4676413204b47e76f7a7b25770bdd0
branch: master
repository: hard-feelings
topic: "user-coach-notes: files named in Notes"
tags: [research, wave-audit]
status: complete
last_updated: 2026-09-04
last_updated_by: wave-audit
---

# Research: user-coach-notes

## Research Question
What exists at HEAD for the files listed in Notes?

## Summary

- `profiles` has `weekly_km` plus plan-pref columns from `20260902140000_profile_plan_prefs.sql`; no `coach_notes`. Own-row RLS names are `profiles_select_own` / `insert_own` / `update_own` / `delete_own` (`supabase/migrations/20260813104727_profiles_and_races.sql:26-41`).
- `Profile` is weeklyKm + weekdays + mix only (`src/types.ts:36-43`). `getProfile` / `upsertProfile` select/write `SELECT_COLUMNS` without notes (`src/lib/services/profile.ts:4`, `:112-153`).
- `PUT /api/profile` validates `profileWriteSchema` (same six fields) (`src/pages/api/profile.ts:26-40`, `src/lib/services/profile-races.ts:49-60`). No PATCH handler.
- First-pass `systemPrompt` injects `Profile JSON: ${JSON.stringify(request.profile)}` and rolling `currentLoad`; no member free-text line (`src/lib/services/openai-chat.ts:327-332`). `sendMessage` loads profile and passes it into `completeSendTurn` (`src/lib/services/chat.ts:289-314`).
- SetupForm Profile tab has Weekly kilometres / mix / races / Estimated paces; no Coach notes textarea (`src/components/setup/SetupForm.tsx`).

## Code References

- `supabase/migrations/20260813104727_profiles_and_races.sql:4-41` - profiles create + RLS
- `supabase/migrations/20260902140000_profile_plan_prefs.sql:5-21` - long/rest weekdays + mix columns
- `src/types.ts:36-46` - Profile / ProfileView / ProfilePatch
- `src/lib/services/profile.ts:4` - SELECT_COLUMNS
- `src/lib/services/profile.ts:112-153` - getProfile / upsertProfile
- `src/lib/services/profile-races.ts:49-60` - profileWriteSchema
- `src/pages/api/profile.ts:9-45` - GET + PUT
- `src/components/setup/SetupForm.tsx:216-227` - PUT body (prefs only)
- `src/lib/services/openai-chat.ts:310-348` - systemPrompt
- `src/lib/services/chat.ts:289-314` - first-pass profile + currentLoad

## Architecture Insights

Profile writes are full PUT upserts of the six pref fields, not a patch of optional columns. Extending GET/PUT/schema/SELECT_COLUMNS together is the existing pattern (`profile-plan-prefs`). First-pass and extra follow-up both call `completeOpenAiPropose` → the same `systemPrompt` (`src/lib/services/openai-chat.ts:199`).

## Open Questions

- Test harness / migrate path: `src/lib/test/migration-safety.test.ts` hardcodes the migration filename list (`:12-24`); `migrateOverFixture` throws on `UPDATE` of owner-readable tables that touch seed keys (`src/lib/test/migration-safety.ts:341-345`). ADD COLUMN is parsed (`:327-329`). Whether `ALTER … ADD COLUMN coach_notes text` (nullable, no backfill) keeps `after === before` is unchecked.
- `src/lib/test/memory-supabase.ts` profiles rows: which columns the in-memory store requires after a new field.
- All callers of `getProfile` / `ProfileView` besides SetupForm and `sendMessage` (dashboard.astro also loads profile — `src/pages/dashboard.astro:44-50`).
- RLS: Notes say existing policies cover a new column; not re-verified against hosted Supabase.
