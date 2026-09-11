-- Project-wide OpenAI model override for coaching chat (admin-llm-model-picker).
-- This slice writes only id = 'default'. Worker rollback does not undo this SQL.

CREATE TABLE project_settings (
  id text PRIMARY KEY,
  openai_model text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT project_settings_singleton CHECK (id = 'default'),
  CONSTRAINT project_settings_openai_model_check CHECK (
    openai_model IS NULL OR (char_length(btrim(openai_model)) BETWEEN 1 AND 64)
  )
);

ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_settings_select_authenticated ON project_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY project_settings_insert_admin ON project_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE POLICY project_settings_update_admin ON project_settings
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
