// packages/database/src/schema/decision-actions.ts
// DECISION-002 — decision_actions table.

import { pgTable, uuid, timestamp, varchar, text, index } from 'drizzle-orm/pg-core';
import { decisions } from './decisions';

export const decisionActions = pgTable(
  'decision_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    decisionId: uuid('decision_id').notNull().references(() => decisions.id, { onDelete: 'cascade' }),
    actionType: varchar('action_type', { length: 64 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'),
    assignedTo: uuid('assigned_to'),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    decisionIdx: index('decision_actions_decision_idx').on(table.decisionId),
    statusIdx: index('decision_actions_status_idx').on(table.status),
  })
);
