// packages/database/src/schema/decision-evidence-links.ts
// DECISION-002 — decision_evidence_links table.

import { pgTable, uuid, timestamp, varchar, numeric, index } from 'drizzle-orm/pg-core';
import { decisions } from './decisions';

export const decisionEvidenceLinks = pgTable(
  'decision_evidence_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    decisionId: uuid('decision_id').notNull().references(() => decisions.id, { onDelete: 'cascade' }),
    evidenceNodeId: varchar('evidence_node_id', { length: 255 }).notNull(),
    relationshipType: varchar('relationship_type', { length: 32 }).notNull(), // SUPPORTS | PRIMARY_REASON | SECONDARY_REASON | RISK_INDICATOR
    importanceScore: numeric('importance_score', { precision: 5, scale: 2 }).notNull().default('1'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    decisionIdx: index('decision_evidence_links_decision_idx').on(table.decisionId),
    nodeIdx: index('decision_evidence_links_node_idx').on(table.evidenceNodeId),
  })
);
