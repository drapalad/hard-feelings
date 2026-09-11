-- Member weekly volume and race calendar (S-01).
-- No profiles row means weekly km is not set yet.

CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  weekly_km numeric(4, 1) NOT NULL,
  CONSTRAINT profiles_weekly_km_bounds CHECK (weekly_km > 0 AND weekly_km <= 300)
);

CREATE TABLE races (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  priority text NOT NULL,
  goal text,
  name text,
  CONSTRAINT races_priority_check CHECK (priority IN ('A', 'B', 'C', 'D')),
  CONSTRAINT races_user_id_date_key UNIQUE (user_id, date)
);

CREATE UNIQUE INDEX races_one_a_per_user ON races (user_id) WHERE priority = 'A';

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE races ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY profiles_delete_own ON profiles
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY races_select_own ON races
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY races_insert_own ON races
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY races_update_own ON races
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY races_delete_own ON races
  FOR DELETE
  USING (auth.uid() = user_id);
