// packages/database/src/schema/decision-outcomes.ts
// DECISION-005 (Continuous Learning) — decision_outcomes table.
// Stores claim-completion feedback for analytics/learning.
// Analytics only — never used for automatic model retraining.

import { pgTable, uuid, text, timestamp, varchar, jsonb, numeric, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { claims } from './claims';
import { decisions } from './decisions';

export const decisionOutcomes = pgTable(
  'decision_outcomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
    decisionId: uuid('decision_id').references(() => decisions.id, { onDelete: 'set null' }),

    // Feedback loop data
    finalApprovedSupplement: jsonb('final_approved_supplement'),
    reviewerEdits: jsonb('reviewer_edits'),
    adjusterOutcome: varchar('adjuster_outcome', { length: 32 }), // APPROVED | PARTIAL | DENIED | PENDING
    amountApproved: numeric('amount_approved', { precision: 12, scale: 2 }),
    amountDenied: numeric('amount_denied', { precision: 12, scale: 2 }),
    confidenceAccuracy: numeric('confidence_accuracy', { precision: 5, scale: 2 }), // 0-100 scoring model
    evidenceGaps: jsonb('evidence_gaps'),
    timeToApprovalMinutes: numeric('time_to_approval_minutes', { precision: 10, scale: 0 }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    claimIdx: index('decision_outcomes_claim_idx').on(table.claimId),
    companyIdx: index('decision_outcomes_company_idx').on(table.companyId),
    decisionIdx: index('decision_outcomes_decision_idx').on(table.decisionId),
  })
);
