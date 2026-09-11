-- Admin grants and hidden algorithm-improvement reports (S-06).
-- This slice inserts kind = 'algorithm_proposal' only.
-- Worker rollback does not undo this SQL.

CREATE TABLE user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL,
  CONSTRAINT user_roles_role_check CHECK (role IN ('admin'))
);

CREATE TABLE agent_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start date NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  bound_codes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT agent_reports_kind_check CHECK (kind IN ('gap', 'algorithm_proposal')),
  CONSTRAINT agent_reports_status_check CHECK (status IN ('open', 'reviewed'))
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_select_own ON user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY agent_reports_insert_own ON agent_reports
  FOR INSERT
  WITH CHECK (auth.uid() = source_user_id);

CREATE POLICY agent_reports_select_admin ON agent_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE POLICY agent_reports_update_admin ON agent_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );
