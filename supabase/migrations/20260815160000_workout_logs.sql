-- Completed workout logs (S-05). One row per member per date; independent of training_units.
-- Worker rollback does not undo this SQL.

CREATE TABLE workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  type text NOT NULL,
  distance_km numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_logs_type_check CHECK (
    type IN ('base', 'recovery', 'tempo', 'threshold', 'anaerobic', 'long')
  ),
  CONSTRAINT workout_logs_distance_km_nonnegative CHECK (distance_km >= 0),
  CONSTRAINT workout_logs_user_id_date_key UNIQUE (user_id, date)
);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY workout_logs_select_own ON workout_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY workout_logs_insert_own ON workout_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY workout_logs_update_own ON workout_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY workout_logs_delete_own ON workout_logs
  FOR DELETE
  USING (auth.uid() = user_id);
