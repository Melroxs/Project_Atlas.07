-- ==========================================================
-- Atlas
-- 006_score_columns_widen.sql
-- Widen every score column to NUMERIC(5,2) so the application's
-- 0-100 scoring model can never overflow. Previously several
-- score columns were NUMERIC(3,2) (max 9.99) which overflows
-- when the Decision Engine persists 0-100 scores such as
-- risk_score (0-100) or compliance_score (0-100).
--
-- Idempotent: ALTER COLUMN TYPE to the same type is a no-op,
-- so this is safe on production databases that have already
-- been widened, and on fresh databases created from the
-- updated 001-005 migrations.
-- ==========================================================

-- decisions (decision engine write path)
ALTER TABLE decisions ALTER COLUMN confidence_score TYPE NUMERIC(5,2);
ALTER TABLE decisions ALTER COLUMN risk_score TYPE NUMERIC(5,2);
ALTER TABLE decisions ALTER COLUMN compliance_score TYPE NUMERIC(5,2);

-- decision_scores (detailed score breakdown)
ALTER TABLE decision_scores ALTER COLUMN evidence_score TYPE NUMERIC(5,2);
ALTER TABLE decision_scores ALTER COLUMN coverage_score TYPE NUMERIC(5,2);
ALTER TABLE decision_scores ALTER COLUMN compliance_score TYPE NUMERIC(5,2);
ALTER TABLE decision_scores ALTER COLUMN risk_factor_score TYPE NUMERIC(5,2);
ALTER TABLE decision_scores ALTER COLUMN final_score TYPE NUMERIC(5,2);

-- decision_evidence_links (evidence graph importance)
ALTER TABLE decision_evidence_links ALTER COLUMN importance_score TYPE NUMERIC(5,2);

-- decision_outcomes (continuous learning feedback loop)
ALTER TABLE decision_outcomes ALTER COLUMN confidence_accuracy TYPE NUMERIC(5,2);

-- evidence_links (evidence graph strength)
ALTER TABLE evidence_links ALTER COLUMN strength_score TYPE NUMERIC(5,2);

-- communication_extractions (document intelligence confidence)
ALTER TABLE communication_extractions ALTER COLUMN confidence TYPE NUMERIC(5,2);

-- supplement_drafts (AI supplement generation)
ALTER TABLE supplement_drafts ALTER COLUMN confidence_score TYPE NUMERIC(5,2);
ALTER TABLE supplement_drafts ALTER COLUMN risk_score TYPE NUMERIC(5,2);
