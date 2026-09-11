-- Admin hard-delete of algorithm / gap reports from /admin.
-- Worker rollback does not undo this SQL.

CREATE POLICY agent_reports_delete_admin ON agent_reports
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );
