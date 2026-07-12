-- Tags a connector as usable as a pipeline source, target, or both, so the
-- Pipeline Canvas can pre-filter connector choices and reduce mismatched
-- source/target selections.
ALTER TABLE connectors
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'both' CHECK (role IN ('source', 'target', 'both'));
