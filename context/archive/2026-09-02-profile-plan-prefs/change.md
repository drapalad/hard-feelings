---
change_id: profile-plan-prefs
title: Profile schedule prefs and Easy / Threshold / Speed mix that persist
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T17:15:51Z
---

## Notes

LOCKED. Files: `supabase/migrations/20260902140000_profile_plan_prefs.sql`, `src/types.ts` (`Profile`), `src/lib/services/profile.ts`, `src/lib/services/profile-races.ts` (zod), `src/pages/api/profile.ts`, `src/pages/dashboard.astro`, `src/components/setup/SetupForm.tsx`, `src/components/dashboard/DashboardTabs.tsx` (pass profile into SetupForm). Merge classes with `cn()` from `@/lib/utils`. Reuse `FormField` / existing select + button styles. Tests: profile GET/PUT + SetupForm source-scan if present.

Human override: preferred long-run is **multi-select**, same idea as rest days — not a single Saturday dropdown.

A decision-pack screen used local React state because the migration was not applied there. Production must write the SQL and the API — no UI-only stub.

### Today

`profiles` has `weekly_km` only. RLS: `profiles_select_own` / `insert_own` / `update_own` / `delete_own` (`auth.uid() = user_id`). Profile UI and `PUT /api/profile` persist weekly km. `Profile` is `{ weeklyKm }`. Chat and generate do not read schedule or mix. Workout types already include `base`, `recovery`, `long`, `tempo`, `threshold`, `anaerobic`.

### Do

1. **One migration** `20260902140000_profile_plan_prefs.sql` (`ALTER TABLE profiles`):
   - `long_weekdays text[] NOT NULL DEFAULT '{sat}'` with a check that every element is in `mon,tue,wed,thu,fri,sat,sun` and `cardinality(long_weekdays) >= 1`.
   - `rest_weekdays text[] NOT NULL DEFAULT '{}'` (empty = every weekday available).
   - `mix_easy smallint NOT NULL DEFAULT 70`, `mix_threshold smallint NOT NULL DEFAULT 20`, `mix_speed smallint NOT NULL DEFAULT 10`, each `CHECK` 0–100 inclusive, plus `CHECK (mix_easy + mix_threshold + mix_speed = 100)`.
   - Existing `profiles_*_own` policies already cover new columns — do not add a second table or weaker RLS.

2. Extend `Profile` + `getProfile` / `upsertProfile` + PUT body (zod) with `longWeekdays`, `restWeekdays`, `mixEasy`, `mixThreshold`, `mixSpeed`. GET returns them (defaults as above when a row exists). Pass values from dashboard SSR into `SetupForm`.

3. **UI under weekly km — schedule.** Seven checkboxes **Preferred long-run days** (Mon–Sun, values `mon`–`sun`); default Saturday checked; save requires at least one. Seven checkboxes **Rest weekdays**; helper: none checked means every day is available. Persist on Save (may share one Save with mix, or a **Save schedule** plus **Save mix** — both must hit the API).

4. **UI — stimulus mix.** Heading **Stimulus mix**, three named numeric `%` fields (or equivalent) **Easy** / **Threshold** / **Speed** with captions: Easy = base + recovery + long; Threshold = tempo + threshold; Speed = anaerobic, hills, strides — not gym. Live total must equal 100 before save. A thin proportion bar is OK. Do not add an 8-week load chart here.

5. This change only **persists and shows**. Do not teach generate or chat to honor the prefs yet.

### Do not

- Pace fields (T/MP/VO2). Gym strength. Race CRUD changes. Load chart (`training-load-chart`).
- A `long_weekday` single-select — that was the pre-override mock.

### Visible

Profile has multi-select long-run days (Saturday on by default), rest-day checkboxes, and Easy / Threshold / Speed summing to 100 (default 70 / 20 / 10).

### Sequencing

Independent of calendar/chat islands. May run in parallel with `dashboard-list-chrome` and `calendar-month-polish`. Do not parallel with another change that edits `SetupForm.tsx` or `profiles` (none in this batch).
