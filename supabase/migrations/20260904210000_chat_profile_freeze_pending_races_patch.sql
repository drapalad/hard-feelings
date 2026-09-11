-- Pending coach-chat race add/remove/patch (same Accept/Dismiss as profile/freeze).
-- Worker rollback does not undo this SQL.

ALTER TABLE chat_profile_freeze_pending
  ADD COLUMN races_patch jsonb;
