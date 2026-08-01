// packages/database/src/schema/digital-twins.ts
import { pgTable, uuid, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { claims } from './claims';

/**
 * Claim Digital Twin — the persistent digital representation of a claim
 * (Phase 3 Operations Intelligence). The twin aggregates customer, property,
 * policy, carrier, timeline, evidence, knowledge graph, AI insights, financial
 * metrics, recommendations, supplements, and carrier responses. Persisted on
 * each analysis so AI decisions operate on a stable twin and history exists.
 */
export const digitalTwins = pgTable(
  'digital_twins',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
    twin: jsonb('twin').notNull(), // full DigitalTwin
    generatedAt: timestamp('generated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index('digital_twins_company_id_idx').on(table.companyId),
    claimIdx: index('digital_twins_claim_id_idx').on(table.claimId),
  })
);
