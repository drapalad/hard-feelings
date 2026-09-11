# Fidelity — persist-race-result

Merged: `9921ba4` (`unattended/persist-race-result` → `master`)

| id | verdict |
| --- | --- |
| S-08.1 | implemented |
| S-08.2 | implemented |
| S-08.3 | implemented |
| S-08.4 | implemented |
| S-08.5 | changed |

S-08.5: option **(a)** shipped (`last_race_date` / `last_race_km` / `last_race_time_sec` on `profiles`). Optional `last_race_name` omitted — **FU-135** (was FU-133 in the persist worktree; renumbered so it does not collide with topbar-plan-nav). Option **(b)** not shipped (locked).

Proof (`git diff ed754b5..9921ba4`): `+  ADD COLUMN last_race_date date,` in `supabase/migrations/20260904180000_profile_last_race.sql`.
