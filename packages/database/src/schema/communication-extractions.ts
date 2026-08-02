// packages/database/src/schema/communication-extractions.ts
import { pgTable, uuid, text, timestamp, numeric, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { claims } from './claims';

export const communicationExtractions = pgTable(
  'communication_extractions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    source: text('source').notNull(), // note | activity | ai_conversation
    sourceId: uuid('source_id'),
    entityType: text('entity_type').notNull(), // claim_number | policy_number | date | ...
    value: text('value').notNull(),
    confidence: numeric('confidence', { precision: 5, scale: 2 }).notNull().default('0.5'),
    context: text('context'), // surrounding text snippet
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index('communication_extractions_company_id_idx').on(table.companyId),
    claimIdx: index('communication_extractions_claim_id_idx').on(table.claimId),
  })
);
