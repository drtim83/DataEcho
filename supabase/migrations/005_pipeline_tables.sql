-- Pipelines need to know which table on each side to sync. Everything else
-- (last_sync, records_synced) is derived from sync_runs rather than duplicated here.
ALTER TABLE pipelines
  ADD COLUMN IF NOT EXISTS source_table TEXT,
  ADD COLUMN IF NOT EXISTS target_table TEXT;
