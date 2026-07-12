-- Adds real JOIN support to pipeline_sources (alongside the existing UNION
-- combine mode) and multi-condition filters to pipeline_destinations.

ALTER TABLE pipeline_sources
  ADD COLUMN IF NOT EXISTS combine_mode TEXT NOT NULL DEFAULT 'union' CHECK (combine_mode IN ('union', 'join')),
  ADD COLUMN IF NOT EXISTS join_type TEXT NOT NULL DEFAULT 'inner' CHECK (join_type IN ('inner', 'left')),
  ADD COLUMN IF NOT EXISTS join_column TEXT,
  ADD COLUMN IF NOT EXISTS primary_join_column TEXT;

-- Whether a destination requires ALL of its filter conditions to match (AND)
-- or ANY of them (OR). The destination's own filter_column/filter_operator/
-- filter_value (migration 012) remains condition #1; this table holds any
-- additional conditions beyond that.
ALTER TABLE pipeline_destinations
  ADD COLUMN IF NOT EXISTS match_mode TEXT NOT NULL DEFAULT 'all' CHECK (match_mode IN ('all', 'any'));

CREATE TABLE pipeline_destination_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID REFERENCES pipeline_destinations(id) ON DELETE CASCADE,
  filter_column TEXT NOT NULL,
  filter_operator TEXT NOT NULL CHECK (filter_operator IN ('=', '!=', '>', '<', '>=', '<=', 'contains')),
  filter_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE pipeline_destination_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view destination conditions"
  ON pipeline_destination_conditions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage destination conditions"
  ON pipeline_destination_conditions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
