-- Adds fields the Connector Hub UI needs that weren't in the original schema.
-- Host/port/database/credentials live inside the existing `config` jsonb column.

ALTER TABLE connectors
  ADD COLUMN IF NOT EXISTS tables_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP WITH TIME ZONE;
