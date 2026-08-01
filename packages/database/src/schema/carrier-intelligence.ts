// packages/database/src/schema/carrier-intelligence.ts
import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const carrierIntelligence = pgTable(
  'carrier_intelligence',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    carrier: text('carrier').notNull(),
    // Structured intelligence (foundation only — never automates carrier decisions):
    preferredDocumentation: jsonb('preferred_documentation').notNull().default([]),
    frequentlyRequestedEvidence: jsonb('frequently_requested_evidence').notNull().default([]),
    commonOmissions: jsonb('common_omissions').notNull().default([]),
    reviewTimelines: jsonb('review_timelines').notNull().default({}),
    communicationHistory: jsonb('communication_history').notNull().default([]),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index('carrier_intelligence_company_id_idx').on(table.companyId),
    carrierIdx: index('carrier_intelligence_carrier_idx').on(table.carrier),
  })
);
