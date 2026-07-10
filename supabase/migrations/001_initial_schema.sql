-- DataEcho Initial Schema

-- Connectors
CREATE TABLE connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('on_prem', 'cloud')),
  config JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'disconnected',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Pipelines
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_id UUID REFERENCES connectors(id),
  target_id UUID REFERENCES connectors(id),
  direction TEXT CHECK (direction IN ('cloud_bound', 'on_prem_bound', 'bidirectional')),
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Pipeline Canvas Data
CREATE TABLE pipeline_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  position_x FLOAT NOT NULL,
  position_y FLOAT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE pipeline_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  source_node UUID REFERENCES pipeline_nodes(id),
  target_node UUID REFERENCES pipeline_nodes(id),
  animated BOOLEAN DEFAULT true
);

-- AI Schema Mappings
CREATE TABLE schema_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  source_col TEXT NOT NULL,
  target_col TEXT NOT NULL,
  source_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  ai_confidence FLOAT NOT NULL,
  ai_warning TEXT
);

-- Scheduler
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('cron', 'interval', 'event')),
  expression TEXT,
  interval_ms BIGINT,
  trigger_event TEXT,
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Jobs
CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  records_processed BIGINT DEFAULT 0,
  records_failed BIGINT DEFAULT 0,
  bytes_transferred BIGINT DEFAULT 0,
  error_message TEXT
);

-- Progress & Stages
CREATE TABLE job_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  stage_name TEXT CHECK (stage_name IN ('extract', 'transform', 'validate', 'load')),
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  records_in BIGINT DEFAULT 0,
  records_out BIGINT DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  progress_pct INTEGER DEFAULT 0
);

-- Sync History
CREATE TABLE sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  job_id UUID REFERENCES scheduled_jobs(id) ON DELETE SET NULL,
  direction TEXT CHECK (direction IN ('cloud_bound', 'on_prem_bound', 'bidirectional')),
  status TEXT,
  records BIGINT DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT
);

-- Metering
CREATE TABLE metering_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  direction TEXT CHECK (direction IN ('cloud_bound', 'on_prem_bound', 'bidirectional')),
  records BIGINT NOT NULL,
  bytes BIGINT NOT NULL,
  compute_ms BIGINT NOT NULL,
  cost_usd FLOAT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Audit Trail
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details TEXT,
  records_affected BIGINT,
  status TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
