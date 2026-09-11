-- Member coach notes on the existing profile row (user-coach-notes).
-- Existing profiles_select_own / insert_own / update_own / delete_own already cover the new column.
-- Worker rollback does not undo this SQL.

ALTER TABLE profiles ADD COLUMN coach_notes text;
