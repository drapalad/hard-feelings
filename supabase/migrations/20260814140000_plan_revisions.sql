-- Manual-edit undo snapshots (S-04). One stack per member per week.
-- Worker rollback does not undo this SQL.

CREATE TABLE plan_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start date NOT NULL,
  units jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plan_revisions_user_week_created_idx
  ON plan_revisions (user_id, week_start, created_at DESC);

ALTER TABLE plan_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_revisions_select_own ON plan_revisions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY plan_revisions_insert_own ON plan_revisions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY plan_revisions_delete_own ON plan_revisions
  FOR DELETE
  USING (auth.uid() = user_id);
