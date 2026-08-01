-- ==========================================================
-- Atlas
-- 005_decision_voice_context.sql
-- Adds claim_number + risk_factors to decisions so Atlas Voice
-- explanations (grounded fallback AND Elemental) reference the
-- same factual context (claim number, risk factors, reasoning).
-- ==========================================================

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS claim_number VARCHAR(64);
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS risk_factors JSONB;

CREATE INDEX IF NOT EXISTS decisions_claim_number_idx ON decisions(claim_number);
