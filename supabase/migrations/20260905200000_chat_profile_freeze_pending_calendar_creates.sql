-- Pending coach-chat calendar creates outside the 14-day auto-apply window.
-- Worker rollback does not undo this SQL.

ALTER TABLE chat_profile_freeze_pending
  ADD COLUMN calendar_creates jsonb;
