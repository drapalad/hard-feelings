-- Add optional pace and heart-rate columns to workout logs (log-pace-hr).
-- Worker rollback does not undo this SQL.

ALTER TABLE workout_logs
  ADD COLUMN avg_pace_sec_per_km integer,
  ADD COLUMN avg_hr integer;

ALTER TABLE workout_logs
  ADD CONSTRAINT workout_logs_pace_range
    CHECK (avg_pace_sec_per_km IS NULL OR (avg_pace_sec_per_km >= 120 AND avg_pace_sec_per_km <= 900));

ALTER TABLE workout_logs
  ADD CONSTRAINT workout_logs_hr_range
    CHECK (avg_hr IS NULL OR (avg_hr >= 60 AND avg_hr <= 220));
