// packages/database/src/schema/decision-approvals.ts
// DECISION-002 — decision_approvals table (human review outcomes).

import { pgTable, uuid, timestamp, varchar, text, index } from 'drizzle-orm/pg-core';
import { decisions } from './decisions';

export const decisionApprovals = pgTable(
  'decision_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    decisionId: uuid('decision_id').notNull().references(() => decisions.id, { onDelete: 'cascade' }),
    reviewerId: uuid('reviewer_id').notNull(),
    approvalStatus: varchar('approval_status', { length: 32 }).notNull(), // APPROVED | REJECTED | REQUEST_CHANGES
    comments: text('comments'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    decisionIdx: index('decision_approvals_decision_idx').on(table.decisionId),
  })
);
