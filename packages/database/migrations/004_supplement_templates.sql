-- ==========================================================
-- Atlas
-- 004_supplement_templates.sql
-- Tables referenced by the drizzle schema but missing from the
-- original 001 migration: supplement_drafts (AI supplement
-- generation) and interview_templates (FNOL template library).
-- ==========================================================

-- supplement_drafts
CREATE TABLE IF NOT EXISTS supplement_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplement_id UUID NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  version NUMERIC(10,0) NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, reviewing, approved, rejected
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  reviewed_by UUID,
  approved_by UUID,
  rejected_by UUID,
  recommendations JSONB NOT NULL,
  user_modifications JSONB,
  ai_provider TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  confidence_score NUMERIC(3,2) NOT NULL,
  risk_score NUMERIC(3,2) NOT NULL,
  estimated_revenue NUMERIC(12,2) NOT NULL,
  actual_revenue NUMERIC(12,2),
  review_time_minutes NUMERIC(5,2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supplement_drafts_supplement_id_idx ON supplement_drafts(supplement_id);
CREATE INDEX IF NOT EXISTS supplement_drafts_status_idx ON supplement_drafts(status);
CREATE INDEX IF NOT EXISTS supplement_drafts_version_idx ON supplement_drafts(version);

-- interview_templates
CREATE TABLE IF NOT EXISTS interview_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(16) NOT NULL DEFAULT '1.0',
  sections JSONB NOT NULL,
  settings JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);
