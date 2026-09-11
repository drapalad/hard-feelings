---
change_id: persist-race-result
title: Persist last race result for Estimated paces on the profile
status: archived
created: 2026-09-04
updated: 2026-09-04
archived_at: 2026-09-04T22:35:20Z
---

## Notes

Files: `src/components/setup/SetupForm.tsx` (Estimated paces); `src/types.ts`, `src/lib/services/profile.ts`, `src/pages/api/profile.ts`. Migration named in S-08.5.
Depends on: none.

### Sequencing

Not in parallel with `user-coach-notes` (`SetupForm.tsx`, `profile.ts`, `types.ts`).

### Option

(a) `profiles.last_race_date` / `last_race_km` / `last_race_time_sec` (optional `last_race_name`) + Save on Estimated paces + PATCH `/api/profile`. S-08.5: implement the **(a)** clause only. S-08.3 writes via profile PATCH, not a race row.
Do not ship (b) `races.finish_time_sec` / distance on `races` / “latest past race with a time.” Do not add `finish_time` on `races`.

### Today

Estimated paces is client `useState` (reference distance + time) → Riegel `predictTimes`. Nothing persisted. `profiles` has weekly km / weekdays / mix only. `races` has date, priority, name, goal — no finish time, no distance.

### Requirements

- [ ] S-08.1 Persist last race result as date + distance + finish time in seconds. It must survive reload and another device; not component state only.
- [ ] S-08.2 On Profile Estimated paces, when a result exists, show a saved chip `D MMM YYYY · {distance} · {time}` (mock: `12 Apr 2026 · 10K · 41:30`).
- [ ] S-08.3 A **Save** control on Estimated paces writes date, distance, and time (profile PATCH for a; race row for b).
- [ ] S-08.4 On load, seed Riegel reference distance and finish-time inputs from the saved result so estimates appear without retyping.
- [ ] S-08.5 Implement the Notes option: **(a)** migration `YYYYMMDDHHmmss_profile_last_race.sql` adding `last_race_date date`, `last_race_km numeric`, `last_race_time_sec int` (optional `last_race_name text`) on `profiles`; existing owner RLS covers new columns. **(b)** migration adding `finish_time_sec int` and distance km on `races`; UI uses the latest past race that has a finish time. Existing past races stay null until edited.

### Do not

Keep this in `useState` only; change Riegel; add Strava; migrate during a mock. Do not add `finish_time_sec` or distance km on `races`.

### Supabase

Migration `YYYYMMDDHHmmss_profile_last_race.sql` on `profiles`: `last_race_date date`, `last_race_km numeric`, `last_race_time_sec int` (optional `last_race_name text`); existing owner RLS covers new columns; do not add RLS. Decision-pack chip was mocked (no POST) — implement the real columns, not a stub.

### Visible

After reload, Estimated paces still shows the last-result chip and estimates, not empty inputs.
