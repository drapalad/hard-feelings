-- Generated training week (S-02). One unit per member per date.
-- Frozen units are regenerated around; Worker rollback does not undo this SQL.

CREATE TABLE training_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  type text NOT NULL,
  distance_km numeric NOT NULL,
  structure text,
  frozen boolean NOT NULL DEFAULT false,
  CONSTRAINT training_units_type_check CHECK (
    type IN ('base', 'recovery', 'tempo', 'threshold', 'anaerobic', 'long')
  ),
  CONSTRAINT training_units_distance_km_nonnegative CHECK (distance_km >= 0),
  CONSTRAINT training_units_user_id_date_key UNIQUE (user_id, date)
);

ALTER TABLE training_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_units_select_own ON training_units
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY training_units_insert_own ON training_units
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY training_units_update_own ON training_units
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY training_units_delete_own ON training_units
  FOR DELETE
  USING (auth.uid() = user_id);
