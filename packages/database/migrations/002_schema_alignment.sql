-- ==========================================================
-- Atlas — Migration 002: Schema Alignment (drift repair)
-- ==========================================================
-- Aligns the deployed database (001_initial baseline) with the
-- drizzle schema in packages/database/src/schema that the running
-- apps (Fastify API + Next.js web routes) actually query.
--
-- PURELY ADDITIVE: adds missing columns and missing tables only.
-- No drops, no data loss, no destructive operations.
-- Idempotent: safe to run multiple times.
-- ==========================================================

BEGIN;

-- ------------------------------------------------------------
-- claims — add rich workflow columns (drizzle claims.ts)
-- ------------------------------------------------------------
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS adjuster_id UUID REFERENCES adjusters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_reported TIMESTAMP,
  ADD COLUMN IF NOT EXISTS insurance_company VARCHAR(255),
  ADD COLUMN IF NOT EXISTS policy_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS deductible NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_value NUMERIC,
  ADD COLUMN IF NOT EXISTS approved_value NUMERIC,
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status_history JSONB,
  ADD COLUMN IF NOT EXISTS financial_summary JSONB;

-- ------------------------------------------------------------
-- adjusters — align with drizzle (full_name, insurance_company,
-- office, territory, notes, active). Backfill full_name from
-- the legacy `name` column (kept as a harmless extra column).
-- ------------------------------------------------------------
ALTER TABLE adjusters
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS insurance_company TEXT,
  ADD COLUMN IF NOT EXISTS office TEXT,
  ADD COLUMN IF NOT EXISTS territory TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE adjusters
   SET full_name = name
 WHERE full_name IS NULL OR full_name = '';

-- The legacy `name` column is no longer written by the app (drizzle uses
-- full_name). Relax its NOT NULL constraint so inserts that only provide
-- full_name succeed.
ALTER TABLE adjusters ALTER COLUMN name DROP NOT NULL;

-- ------------------------------------------------------------
-- interviews — align with drizzle interviews.ts
-- ------------------------------------------------------------
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS interview_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS template_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS template_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS current_section VARCHAR(64),
  ADD COLUMN IF NOT EXISTS progress NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responses JSONB,
  ADD COLUMN IF NOT EXISTS conversation_history JSONB,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS generated_customer_id UUID,
  ADD COLUMN IF NOT EXISTS generated_property_id UUID,
  ADD COLUMN IF NOT EXISTS generated_claim_id UUID,
  ADD COLUMN IF NOT EXISTS generated_adjuster_id UUID,
  ADD COLUMN IF NOT EXISTS generated_document_ids JSONB,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- ------------------------------------------------------------
-- supplements — align with drizzle supplements.ts
-- ------------------------------------------------------------
ALTER TABLE supplements
  ADD COLUMN IF NOT EXISTS adjuster_id UUID REFERENCES adjusters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplement_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS version NUMERIC(3,0) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS carrier VARCHAR(255),
  ADD COLUMN IF NOT EXISTS requested_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS difference NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS line_items JSONB,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS submission_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS response_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS denial_reason TEXT,
  ADD COLUMN IF NOT EXISTS revision_history JSONB,
  ADD COLUMN IF NOT EXISTS status_history JSONB;

-- ------------------------------------------------------------
-- activity_logs — align with drizzle activity_logs.ts
-- (keeps legacy `details` column as harmless extra)
-- ------------------------------------------------------------
ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS entity_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS previous_values JSONB,
  ADD COLUMN IF NOT EXISTS new_values JSONB,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS claim_id UUID REFERENCES claims(id) ON DELETE SET NULL;

UPDATE activity_logs
   SET description = details
 WHERE description IS NULL AND details IS NOT NULL;

-- ------------------------------------------------------------
-- ai_conversations — align with drizzle ai_conversations.ts
-- ------------------------------------------------------------
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- ------------------------------------------------------------
-- tenant_members — align with drizzle tenant_members.ts
-- ------------------------------------------------------------
ALTER TABLE tenant_members
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- ------------------------------------------------------------
-- interview_questions — add drizzle `order` column
-- (keeps legacy `answer` column as harmless extra)
-- ------------------------------------------------------------
ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- NEW TABLE: evidence_links (drizzle evidence-links.ts)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  photo_id UUID,
  interview_answer_id UUID,
  relevance TEXT NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  strength_score NUMERIC(5,2) NOT NULL DEFAULT 0.50,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evidence_links_recommendation_id_idx ON evidence_links (recommendation_id);
CREATE INDEX IF NOT EXISTS evidence_links_document_id_idx ON evidence_links (document_id);
CREATE INDEX IF NOT EXISTS evidence_links_photo_id_idx ON evidence_links (photo_id);
CREATE INDEX IF NOT EXISTS evidence_links_relevance_idx ON evidence_links (relevance);

-- ------------------------------------------------------------
-- NEW TABLE: supplement_drafts (drizzle supplement-drafts.ts)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplement_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplement_id UUID NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  version NUMERIC(10,0) NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
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
  confidence_score NUMERIC(5,2) NOT NULL, -- 0-100 scoring model
  risk_score NUMERIC(5,2) NOT NULL, -- 0-100 scoring model
  estimated_revenue NUMERIC(12,2) NOT NULL,
  actual_revenue NUMERIC(12,2),
  review_time_minutes NUMERIC(5,2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supplement_drafts_supplement_id_idx ON supplement_drafts (supplement_id);
CREATE INDEX IF NOT EXISTS supplement_drafts_status_idx ON supplement_drafts (status);
CREATE INDEX IF NOT EXISTS supplement_drafts_version_idx ON supplement_drafts (version);

-- ------------------------------------------------------------
-- NEW TABLE: interview_templates (drizzle interview-templates.ts)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- NEW TABLE: organizations (drizzle organizations.ts)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan') THEN
    CREATE TYPE subscription_plan AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY,
  legal_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  registration_number VARCHAR(100),
  tax_number VARCHAR(100),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  website TEXT,
  logo_url TEXT,
  primary_color VARCHAR(20),
  secondary_color VARCHAR(20),
  address_line_1 TEXT,
  address_line_2 TEXT,
  city VARCHAR(100),
  state_province VARCHAR(100),
  postal_code VARCHAR(30),
  country VARCHAR(100) NOT NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  locale VARCHAR(20) NOT NULL DEFAULT 'en-ZA',
  currency VARCHAR(10) NOT NULL DEFAULT 'ZAR',
  subscription_plan subscription_plan NOT NULL,
  subscription_status subscription_status NOT NULL,
  trial_ends_at TIMESTAMPTZ,
  subscription_renews_at TIMESTAMPTZ,
  ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  voice_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  mobile_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  api_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  require_mfa BOOLEAN NOT NULL DEFAULT FALSE,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
  password_policy JSONB,
  document_retention_days INTEGER DEFAULT 2555,
  audit_retention_days INTEGER DEFAULT 2555,
  voice_retention_days INTEGER DEFAULT 365,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  archived_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS org_slug_idx ON organizations (slug);
CREATE INDEX IF NOT EXISTS org_email_idx ON organizations (email);
CREATE INDEX IF NOT EXISTS org_country_idx ON organizations (country);
CREATE INDEX IF NOT EXISTS org_subscription_idx ON organizations (subscription_status);
CREATE INDEX IF NOT EXISTS org_created_at_idx ON organizations (created_at);
CREATE INDEX IF NOT EXISTS org_archived_at_idx ON organizations (archived_at);

COMMIT;
