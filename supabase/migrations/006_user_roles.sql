-- Role system: 'admin' (full access) vs 'user' (can operate pipelines/schema
-- mapping, but cannot manage connectors since those hold DB credentials).

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- SECURITY DEFINER so this can read profiles regardless of the caller's own
-- RLS visibility, without opening profiles' RLS up further than it needs.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Auto-create a profile (defaulting to 'user') whenever a new account is
-- created via the Supabase dashboard's "Add user".
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill any accounts that already existed before this migration.
INSERT INTO profiles (id, email, role)
SELECT id, email, 'user' FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Bootstrap the first real account as admin.
UPDATE profiles SET role = 'admin' WHERE email = 'admin@dataecho.com';

-- Restrict connector mutations to admins; SELECT stays open to all authenticated.
DROP POLICY IF EXISTS "Authenticated users can insert connectors" ON connectors;
DROP POLICY IF EXISTS "Authenticated users can update connectors" ON connectors;
DROP POLICY IF EXISTS "Authenticated users can delete connectors" ON connectors;

CREATE POLICY "Admins can insert connectors"
  ON connectors FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update connectors"
  ON connectors FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete connectors"
  ON connectors FOR DELETE
  TO authenticated
  USING (is_admin());
