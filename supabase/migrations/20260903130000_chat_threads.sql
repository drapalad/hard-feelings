-- Member chat threads (P-05 / P-06). Worker rollback does not undo this SQL.

CREATE TABLE chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  title text,
  week_start date
);

CREATE INDEX chat_threads_user_started_at_idx
  ON chat_threads (user_id, started_at DESC);

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_threads_select_own ON chat_threads
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY chat_threads_insert_own ON chat_threads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY chat_threads_update_own ON chat_threads
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY chat_threads_delete_own ON chat_threads
  FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE chat_messages
  ADD COLUMN thread_id uuid REFERENCES chat_threads (id);

INSERT INTO chat_threads (user_id, started_at, title, week_start)
SELECT
  cm.user_id,
  COALESCE(MIN(cm.created_at), timezone('utc', cm.week_start::timestamp)),
  COALESCE(
    (
      SELECT LEFT(TRIM(u.content), 60)
      FROM chat_messages u
      WHERE u.user_id = cm.user_id
        AND u.week_start = cm.week_start
        AND u.role = 'user'
      ORDER BY u.created_at ASC, u.id ASC
      LIMIT 1
    ),
    'Week of ' || to_char(cm.week_start, 'FMDD Mon')
  ),
  cm.week_start
FROM chat_messages cm
GROUP BY cm.user_id, cm.week_start;

UPDATE chat_messages cm
SET thread_id = t.id
FROM chat_threads t
WHERE t.user_id = cm.user_id
  AND t.week_start = cm.week_start;

ALTER TABLE chat_messages
  ALTER COLUMN thread_id SET NOT NULL;

CREATE INDEX chat_messages_thread_id_idx
  ON chat_messages (thread_id, created_at);
