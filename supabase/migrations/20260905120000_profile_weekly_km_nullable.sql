-- Allow clearing weekly km without deleting the profiles row (profile-keep-row-on-clear-km).
-- Existing owner RLS covers the column. Worker rollback does not undo this SQL.

ALTER TABLE profiles
  ALTER COLUMN weekly_km DROP NOT NULL,
  DROP CONSTRAINT profiles_weekly_km_bounds,
  ADD CONSTRAINT profiles_weekly_km_bounds
    CHECK (weekly_km IS NULL OR (weekly_km > 0 AND weekly_km <= 300));
