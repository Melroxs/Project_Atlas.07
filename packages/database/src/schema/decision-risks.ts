// packages/database/src/schema/decision-risks.ts
// DECISION-002 — decision_risks table.

import { pgTable, uuid, timestamp, varchar, text, integer, index } from 'drizzle-orm/pg-core';
import { decisions } from './decisions';

export const decisionRisks = pgTable(
  'decision_risks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    decisionId: uuid('decision_id').notNull().references(() => decisions.id, { onDelete: 'cascade' }),
    riskType: varchar('risk_type', { length: 64 }).notNull(),
    severity: varchar('severity', { length: 16 }).notNull(),
    description: text('description'),
    mitigation: text('mitigation'),
    points: integer('points').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    decisionIdx: index('decision_risks_decision_idx').on(table.decisionId),
  })
);
