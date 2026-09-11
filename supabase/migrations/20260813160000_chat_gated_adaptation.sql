-- Member chat thread and pending plan propositions (S-03).
-- Worker rollback does not undo this SQL.

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start date NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant'))
);

CREATE TABLE plan_propositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start date NOT NULL,
  proposed_units jsonb NOT NULL,
  validation jsonb NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_propositions_status_check CHECK (status IN ('pending', 'accepted', 'rejected'))
);

CREATE UNIQUE INDEX plan_propositions_one_pending_per_week
  ON plan_propositions (user_id, week_start)
  WHERE status = 'pending';

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_propositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_messages_select_own ON chat_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY chat_messages_insert_own ON chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY chat_messages_update_own ON chat_messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY chat_messages_delete_own ON chat_messages
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY plan_propositions_select_own ON plan_propositions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY plan_propositions_insert_own ON plan_propositions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY plan_propositions_update_own ON plan_propositions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY plan_propositions_delete_own ON plan_propositions
  FOR DELETE
  USING (auth.uid() = user_id);
