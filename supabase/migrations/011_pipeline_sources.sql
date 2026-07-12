-- Additional sources beyond a pipeline's primary source_id/source_table,
-- combined via UNION ALL (same-shape tables, using the pipeline's existing
-- schema mapping for every source) before loading into the target.
CREATE TABLE pipeline_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  source_id UUID REFERENCES connectors(id),
  source_table TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE pipeline_sources ENABLE ROW LEVEL SECURITY;

-- Matches pipelines' own permission level: any authenticated user can
-- operate pipelines (only connector management is admin-only).
CREATE POLICY "Authenticated users can view pipeline sources"
  ON pipeline_sources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage pipeline sources"
  ON pipeline_sources FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
