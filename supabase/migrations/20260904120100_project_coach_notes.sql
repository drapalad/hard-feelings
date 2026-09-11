-- Project-wide admin coach notes on the existing project_settings singleton (admin-coach-notes).
-- Existing project_settings_select_authenticated / insert_admin / update_admin already cover the new column.
-- Worker rollback does not undo this SQL.

ALTER TABLE project_settings ADD COLUMN coach_notes text;
