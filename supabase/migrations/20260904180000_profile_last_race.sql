-- Last race result for Estimated paces (persist-race-result).
-- Existing profiles_select_own / insert_own / update_own / delete_own already cover new columns.
-- Worker rollback does not undo this SQL.

ALTER TABLE profiles
  ADD COLUMN last_race_date date,
  ADD COLUMN last_race_km numeric,
  ADD COLUMN last_race_time_sec integer;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_last_race_km_positive
    CHECK (last_race_km IS NULL OR last_race_km > 0);

ALTER TABLE profiles
  ADD CONSTRAINT profiles_last_race_time_range
    CHECK (last_race_time_sec IS NULL OR (last_race_time_sec > 0 AND last_race_time_sec <= 172800));

ALTER TABLE profiles
  ADD CONSTRAINT profiles_last_race_all_or_nothing
    CHECK (
      (last_race_date IS NULL AND last_race_km IS NULL AND last_race_time_sec IS NULL)
      OR
      (last_race_date IS NOT NULL AND last_race_km IS NOT NULL AND last_race_time_sec IS NOT NULL)
    );
