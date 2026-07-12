-- All tables from 001_initial_schema.sql turned out to already exist live in the
-- project (created outside these migration files) with RLS disabled, the same
-- anon-key exposure that 003 closed for `connectors`. Close it everywhere else.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pipelines', 'pipeline_nodes', 'pipeline_edges', 'schema_mappings',
    'schedules', 'scheduled_jobs', 'job_stages', 'sync_runs',
    'metering_events', 'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format(
      'CREATE POLICY "Authenticated users can view %1$s" ON %1$I FOR SELECT TO authenticated USING (true)', t
    );
    EXECUTE format(
      'CREATE POLICY "Authenticated users can insert %1$s" ON %1$I FOR INSERT TO authenticated WITH CHECK (true)', t
    );
    EXECUTE format(
      'CREATE POLICY "Authenticated users can update %1$s" ON %1$I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t
    );
    EXECUTE format(
      'CREATE POLICY "Authenticated users can delete %1$s" ON %1$I FOR DELETE TO authenticated USING (true)', t
    );
  END LOOP;
END $$;
