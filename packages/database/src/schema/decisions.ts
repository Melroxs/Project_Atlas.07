// packages/database/src/schema/decisions.ts
// DECISION-002 — decisions table with version history.
// Each Decision Engine execution creates a NEW row (version increments
// per claim) — previous decisions are never overwritten.

import { pgTable, uuid, text, timestamp, varchar, jsonb, numeric, integer, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { claims } from './claims';

export const decisions = pgTable(
  'decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),

    // Voice / explainability context (005_decision_voice_context.sql)
    claimNumber: varchar('claim_number', { length: 64 }),

    // Version history — never overwrite previous decisions
    version: integer('version').notNull().default(1),

    decisionType: varchar('decision_type', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('GENERATED'), // GENERATED | UNDER_REVIEW | APPROVED | REJECTED | ARCHIVED
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    recommendation: text('recommendation'),

    confidenceScore: numeric('confidence_score', { precision: 3, scale: 2 }),
    riskScore: numeric('risk_score', { precision: 5, scale: 2 }),
    priority: varchar('priority', { length: 16 }).default('MEDIUM'),

    // Structured pipeline output (DECISION-002 extension for MVP)
    evidenceSummary: jsonb('evidence_summary'),
    evidenceNodes: jsonb('evidence_nodes'), // normalized evidence nodes (explainability)
    recommendations: jsonb('recommendations'),
    missingEvidence: jsonb('missing_evidence'),
    reasoningTrace: jsonb('reasoning_trace'), // full pipeline trace (explainability)
    riskFactors: jsonb('risk_factors'), // persisted risk factors for voice/export
    complianceStatus: varchar('compliance_status', { length: 32 }),
    complianceScore: numeric('compliance_score', { precision: 5, scale: 2 }),
    humanReviewStatus: varchar('human_review_status', { length: 32 }).notNull().default('PENDING'), // PENDING | APPROVED | REJECTED | REQUEST_CHANGES

    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    claimIdx: index('decisions_claim_idx').on(table.claimId),
    statusIdx: index('decisions_status_idx').on(table.status),
    typeIdx: index('decisions_type_idx').on(table.decisionType),
    companyIdx: index('decisions_company_idx').on(table.companyId),
    versionIdx: index('decisions_version_idx').on(table.claimId, table.version),
  })
);
