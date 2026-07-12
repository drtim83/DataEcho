-- Closes the data-exposure hole where anyone holding the public anon/publishable
-- key could read, write, or delete every connector (including credentials in
-- `config`) directly via the Supabase REST API, bypassing the app entirely.
--
-- The app's API routes now run every query using the logged-in user's session
-- (see src/lib/supabase/server.ts createClient()), so Postgres sees them as
-- role `authenticated`. These policies allow that role and deny everyone else
-- (in particular the `anon` role used by an unauthenticated API caller).

ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view connectors"
  ON connectors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert connectors"
  ON connectors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update connectors"
  ON connectors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete connectors"
  ON connectors FOR DELETE
  TO authenticated
  USING (true);
