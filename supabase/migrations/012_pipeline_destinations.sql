-- Additional destinations beyond a pipeline's primary target_id/target_table.
-- Each destination gets a filtered subset of the same extracted+mapped rows
-- (e.g. push customers to a regional system where region = 'APAC').
CREATE TABLE pipeline_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  target_id UUID REFERENCES connectors(id),
  target_table TEXT NOT NULL,
  filter_column TEXT NOT NULL,
  filter_operator TEXT NOT NULL CHECK (filter_operator IN ('=', '!=', '>', '<', '>=', '<=', 'contains')),
  filter_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE pipeline_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pipeline destinations"
  ON pipeline_destinations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage pipeline destinations"
  ON pipeline_destinations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
