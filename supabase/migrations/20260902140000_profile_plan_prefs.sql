-- Profile schedule prefs and Easy / Threshold / Speed mix on the existing member row.
-- Existing profiles_select_own / insert_own / update_own / delete_own already cover new columns.
-- Worker rollback does not undo this SQL.

ALTER TABLE profiles
  ADD COLUMN long_weekdays text[] NOT NULL DEFAULT '{sat}'
    CONSTRAINT profiles_long_weekdays_valid CHECK (
      cardinality(long_weekdays) >= 1
      AND long_weekdays <@ ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
    ),
  ADD COLUMN rest_weekdays text[] NOT NULL DEFAULT '{}'
    CONSTRAINT profiles_rest_weekdays_valid CHECK (
      rest_weekdays <@ ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
    ),
  ADD COLUMN mix_easy smallint NOT NULL DEFAULT 70
    CONSTRAINT profiles_mix_easy_bounds CHECK (mix_easy >= 0 AND mix_easy <= 100),
  ADD COLUMN mix_threshold smallint NOT NULL DEFAULT 20
    CONSTRAINT profiles_mix_threshold_bounds CHECK (mix_threshold >= 0 AND mix_threshold <= 100),
  ADD COLUMN mix_speed smallint NOT NULL DEFAULT 10
    CONSTRAINT profiles_mix_speed_bounds CHECK (mix_speed >= 0 AND mix_speed <= 100),
  ADD CONSTRAINT profiles_mix_sum CHECK (mix_easy + mix_threshold + mix_speed = 100);
