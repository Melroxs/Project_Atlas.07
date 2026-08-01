// packages/database/src/schema/domain-events.ts
import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { claims } from './claims';

export const domainEvents = pgTable(
  'domain_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index('domain_events_company_id_idx').on(table.companyId),
    claimIdx: index('domain_events_claim_id_idx').on(table.claimId),
    typeIdx: index('domain_events_type_idx').on(table.eventType),
  })
);
