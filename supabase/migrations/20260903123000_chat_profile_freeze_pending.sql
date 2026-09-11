-- Pending profile/freeze changes proposed by coach chat.
-- Worker rollback does not undo this SQL.

CREATE TABLE chat_profile_freeze_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start date NOT NULL,
  profile_patch jsonb,
  freeze_dates text[] NOT NULL DEFAULT '{}',
  unfreeze_dates text[] NOT NULL DEFAULT '{}',
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT chat_profile_freeze_pending_status_check CHECK (status IN ('pending', 'accepted', 'dismissed'))
);

CREATE UNIQUE INDEX chat_profile_freeze_pending_one_pending_per_week
  ON chat_profile_freeze_pending (user_id, week_start)
  WHERE status = 'pending';

ALTER TABLE chat_profile_freeze_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_profile_freeze_pending_select_own ON chat_profile_freeze_pending
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY chat_profile_freeze_pending_insert_own ON chat_profile_freeze_pending
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY chat_profile_freeze_pending_update_own ON chat_profile_freeze_pending
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY chat_profile_freeze_pending_delete_own ON chat_profile_freeze_pending
  FOR DELETE
  USING (auth.uid() = user_id);
