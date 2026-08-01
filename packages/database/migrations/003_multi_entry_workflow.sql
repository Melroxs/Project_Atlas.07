-- 003_multi_entry_workflow.sql
-- Additive migration: multi-entry claim workflow support.
-- Adds entry_point (how a claim entered the lifecycle) and source_system
-- (optional origin reference for imported projects). Both are additive and
-- backward compatible — existing rows default to 'new_claim'.

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS entry_point VARCHAR(32) NOT NULL DEFAULT 'new_claim';

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS source_system VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_claims_entry_point ON claims (entry_point);
