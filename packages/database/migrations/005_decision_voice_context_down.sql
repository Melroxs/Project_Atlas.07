-- ==========================================================
-- Atlas
-- 005_decision_voice_context_down.sql
-- ==========================================================

DROP INDEX IF EXISTS decisions_claim_number_idx;
ALTER TABLE decisions DROP COLUMN IF EXISTS risk_factors;
ALTER TABLE decisions DROP COLUMN IF EXISTS claim_number;
