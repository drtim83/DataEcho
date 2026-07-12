-- Lets a pipeline overwrite its target on every run instead of always
-- appending, so re-running against a target with unique/primary keys
-- doesn't fail with a duplicate-key error.
ALTER TABLE pipelines
  ADD COLUMN IF NOT EXISTS sync_mode TEXT NOT NULL DEFAULT 'append' CHECK (sync_mode IN ('append', 'truncate_reload'));
