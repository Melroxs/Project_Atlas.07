-- ==========================================================
-- Atlas
-- 002_decision_engine_down.sql
-- Rollback: drop DECISION-002 decision engine tables
-- ==========================================================

DROP TABLE IF EXISTS decision_reasoning_logs CASCADE;
DROP TABLE IF EXISTS decision_approvals CASCADE;
DROP TABLE IF EXISTS decision_actions CASCADE;
DROP TABLE IF EXISTS decision_risks CASCADE;
DROP TABLE IF EXISTS decision_evidence_links CASCADE;
DROP TABLE IF EXISTS decision_scores CASCADE;
DROP TABLE IF EXISTS decisions CASCADE;
