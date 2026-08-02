// packages/database/src/schema/decision-scores.ts
// DECISION-002 — decision_scores table.

import { pgTable, uuid, timestamp, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { decisions } from './decisions';

export const decisionScores = pgTable(
  'decision_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    decisionId: uuid('decision_id').notNull().references(() => decisions.id, { onDelete: 'cascade' }),
    evidenceScore: numeric('evidence_score', { precision: 5, scale: 2 }),
    coverageScore: numeric('coverage_score', { precision: 5, scale: 2 }),
    complianceScore: numeric('compliance_score', { precision: 5, scale: 2 }),
    riskFactorScore: numeric('risk_factor_score', { precision: 5, scale: 2 }),
    finalScore: numeric('final_score', { precision: 5, scale: 2 }), // 0-100 scoring model
    calculationDetails: jsonb('calculation_details'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    decisionIdx: index('decision_scores_decision_idx').on(table.decisionId),
  })
);
