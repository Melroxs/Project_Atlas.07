-- ==========================================================
-- Atlas
-- 003_decision_learning.sql
-- Decision Engine continuous-learning feedback loop
-- ==========================================================
-- Analytics and learning only. Never used for automatic model
-- retraining — human review remains mandatory.

CREATE TABLE IF NOT EXISTS decision_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES decisions(id) ON DELETE SET NULL,
  final_approved_supplement JSONB,
  reviewer_edits JSONB,
  adjuster_outcome VARCHAR(32),
  amount_approved NUMERIC(12,2),
  amount_denied NUMERIC(12,2),
  confidence_accuracy NUMERIC(3,2),
  evidence_gaps JSONB,
  time_to_approval_minutes NUMERIC(10,0),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS decision_outcomes_claim_idx ON decision_outcomes(claim_id);
CREATE INDEX IF NOT EXISTS decision_outcomes_company_idx ON decision_outcomes(company_id);
CREATE INDEX IF NOT EXISTS decision_outcomes_decision_idx ON decision_outcomes(decision_id);
