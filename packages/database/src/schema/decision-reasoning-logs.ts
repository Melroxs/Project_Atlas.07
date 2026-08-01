// packages/database/src/schema/decision-reasoning-logs.ts
// DECISION-002 — decision_reasoning_logs table (explainability traces).

import { pgTable, uuid, timestamp, varchar, jsonb, index } from 'drizzle-orm/pg-core';
import { decisions } from './decisions';

export const decisionReasoningLogs = pgTable(
  'decision_reasoning_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    decisionId: uuid('decision_id').notNull().references(() => decisions.id, { onDelete: 'cascade' }),
    reasoningType: varchar('reasoning_type', { length: 64 }).notNull(), // EVIDENCE_ANALYSIS | COMPLIANCE_CHECK | RISK_ASSESSMENT | SUPPLEMENT_ANALYSIS
    inputData: jsonb('input_data'),
    outputData: jsonb('output_data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    decisionIdx: index('decision_reasoning_logs_decision_idx').on(table.decisionId),
  })
);
