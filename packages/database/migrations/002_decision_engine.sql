-- ==========================================================
-- Atlas
-- 002_decision_engine.sql
-- DECISION-002 — Decision Engine database schema
-- ==========================================================
-- Version history: each Decision Engine execution inserts a NEW
-- decisions row with an incremented version per claim. Previous
-- decisions are never overwritten.

-- decisions
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  decision_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'GENERATED',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  recommendation TEXT,
  confidence_score NUMERIC(3,2),
  risk_score NUMERIC(5,2),
  priority VARCHAR(16) DEFAULT 'MEDIUM',
  evidence_summary JSONB,
  evidence_nodes JSONB,
  recommendations JSONB,
  missing_evidence JSONB,
  reasoning_trace JSONB,
  compliance_status VARCHAR(32),
  compliance_score NUMERIC(5,2),
  human_review_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS decisions_claim_idx ON decisions(claim_id);
CREATE INDEX IF NOT EXISTS decisions_status_idx ON decisions(status);
CREATE INDEX IF NOT EXISTS decisions_type_idx ON decisions(decision_type);
CREATE INDEX IF NOT EXISTS decisions_company_idx ON decisions(company_id);
CREATE INDEX IF NOT EXISTS decisions_version_idx ON decisions(claim_id, version);

-- decision_scores
CREATE TABLE IF NOT EXISTS decision_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  evidence_score NUMERIC(3,2),
  coverage_score NUMERIC(3,2),
  compliance_score NUMERIC(5,2),
  risk_factor_score NUMERIC(5,2),
  final_score NUMERIC(3,2),
  calculation_details JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS decision_scores_decision_idx ON decision_scores(decision_id);

-- decision_evidence_links
CREATE TABLE IF NOT EXISTS decision_evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  evidence_node_id VARCHAR(255) NOT NULL,
  relationship_type VARCHAR(32) NOT NULL,
  importance_score NUMERIC(3,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS decision_evidence_links_decision_idx ON decision_evidence_links(decision_id);
CREATE INDEX IF NOT EXISTS decision_evidence_links_node_idx ON decision_evidence_links(evidence_node_id);

-- decision_risks
CREATE TABLE IF NOT EXISTS decision_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  risk_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  description TEXT,
  mitigation TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS decision_risks_decision_idx ON decision_risks(decision_id);

-- decision_actions
CREATE TABLE IF NOT EXISTS decision_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  action_type VARCHAR(64) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  assigned_to UUID,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS decision_actions_decision_idx ON decision_actions(decision_id);
CREATE INDEX IF NOT EXISTS decision_actions_status_idx ON decision_actions(status);

-- decision_approvals
CREATE TABLE IF NOT EXISTS decision_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  approval_status VARCHAR(32) NOT NULL,
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS decision_approvals_decision_idx ON decision_approvals(decision_id);

-- decision_reasoning_logs
CREATE TABLE IF NOT EXISTS decision_reasoning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  reasoning_type VARCHAR(64) NOT NULL,
  input_data JSONB,
  output_data JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS decision_reasoning_logs_decision_idx ON decision_reasoning_logs(decision_id);
