-- 004_claim_intelligence.sql
-- Additive migration: AI Claim Intelligence Layer (Phase 2).
-- All tables are new; no existing tables are altered.

-- 1. domain_events — persistent event history for the event bus (auditable, replayable)
CREATE TABLE IF NOT EXISTS domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS domain_events_company_id_idx ON domain_events (company_id);
CREATE INDEX IF NOT EXISTS domain_events_claim_id_idx ON domain_events (claim_id);
CREATE INDEX IF NOT EXISTS domain_events_type_idx ON domain_events (event_type);

-- 2. claim_intelligence_snapshots — persisted live intelligence model per claim
CREATE TABLE IF NOT EXISTS claim_intelligence_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  health_score JSONB NOT NULL,
  recovery_readiness JSONB NOT NULL,
  evidence_completeness JSONB,
  documentation_completeness JSONB,
  policy_analysis_status TEXT,
  compliance_status TEXT,
  ai_confidence JSONB,
  model JSONB NOT NULL,
  analyzed_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claim_intelligence_snapshots_company_id_idx ON claim_intelligence_snapshots (company_id);
CREATE INDEX IF NOT EXISTS claim_intelligence_snapshots_claim_id_idx ON claim_intelligence_snapshots (claim_id);

-- 3. communication_extractions — structured entities extracted from communications
CREATE TABLE IF NOT EXISTS communication_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
  source TEXT NOT NULL,          -- note | activity | ai_conversation
  source_id UUID,
  entity_type TEXT NOT NULL,     -- claim_number | policy_number | date | ...
  value TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL DEFAULT '0.50',
  context TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS communication_extractions_company_id_idx ON communication_extractions (company_id);
CREATE INDEX IF NOT EXISTS communication_extractions_claim_id_idx ON communication_extractions (claim_id);

-- 4. carrier_intelligence — structured per-carrier learning foundation
CREATE TABLE IF NOT EXISTS carrier_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  carrier TEXT NOT NULL,
  preferred_documentation JSONB NOT NULL DEFAULT '[]'::jsonb,
  frequently_requested_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  common_omissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_timelines JSONB NOT NULL DEFAULT '{}'::jsonb,
  communication_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS carrier_intelligence_company_id_idx ON carrier_intelligence (company_id);
CREATE INDEX IF NOT EXISTS carrier_intelligence_carrier_idx ON carrier_intelligence (carrier);
