-- 005_operations_intelligence.sql
-- Additive migration: Operations Intelligence & AI Case Manager (Phase 3).
-- All tables are new; no existing tables are altered.

-- 1. digital_twins — persistent digital representation of each claim
CREATE TABLE IF NOT EXISTS digital_twins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  twin JSONB NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS digital_twins_company_id_idx ON digital_twins (company_id);
CREATE INDEX IF NOT EXISTS digital_twins_claim_id_idx ON digital_twins (claim_id);
