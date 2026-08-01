// packages/database/src/schema/claim-intelligence-snapshots.ts
import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { claims } from './claims';

export const claimIntelligenceSnapshots = pgTable(
  'claim_intelligence_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
    healthScore: jsonb('health_score').notNull(),
    recoveryReadiness: jsonb('recovery_readiness').notNull(),
    evidenceCompleteness: jsonb('evidence_completeness'),
    documentationCompleteness: jsonb('documentation_completeness'),
    policyAnalysisStatus: text('policy_analysis_status'),
    complianceStatus: text('compliance_status'),
    aiConfidence: jsonb('ai_confidence'),
    model: jsonb('model').notNull(), // full ClaimIntelligenceModel
    analyzedAt: timestamp('analyzed_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index('claim_intelligence_snapshots_company_id_idx').on(table.companyId),
    claimIdx: index('claim_intelligence_snapshots_claim_id_idx').on(table.claimId),
  })
);
