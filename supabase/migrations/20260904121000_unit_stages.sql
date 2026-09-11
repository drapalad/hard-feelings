-- Explicit workout stages for day-edit / chart (workout-stages-make-ai).
-- Existing training_units_select_own / insert_own / update_own / delete_own already cover the new column.
-- Worker rollback does not undo this SQL.

ALTER TABLE training_units
  ADD COLUMN stages jsonb;
