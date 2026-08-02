// packages/database/src/schema/supplement-drafts.ts
import { pgTable, uuid, text, timestamp, jsonb, numeric, index } from 'drizzle-orm/pg-core';
import { supplements } from './supplements';

export const supplementDrafts = pgTable(
  'supplement_drafts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    supplementId: uuid('supplement_id').references(() => supplements.id, { onDelete: 'cascade' }).notNull(),
    version: numeric('version', { precision: 10, scale: 0 }).notNull().default('1'),
    status: text('status').notNull().default('draft'), // draft, reviewing, approved, rejected
    generatedAt: timestamp('generated_at').notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at'),
    approvedAt: timestamp('approved_at'),
    rejectedAt: timestamp('rejected_at'),
    reviewedBy: uuid('reviewed_by'),
    approvedBy: uuid('approved_by'),
    rejectedBy: uuid('rejected_by'),
    recommendations: jsonb('recommendations').notNull(),
    userModifications: jsonb('user_modifications'),
    aiProvider: text('ai_provider').notNull(),
    aiModel: text('ai_model').notNull(),
    confidenceScore: numeric('confidence_score', { precision: 5, scale: 2 }).notNull(), // 0-100 scoring model
    riskScore: numeric('risk_score', { precision: 5, scale: 2 }).notNull(), // 0-100 scoring model
    estimatedRevenue: numeric('estimated_revenue', { precision: 12, scale: 2 }).notNull(),
    actualRevenue: numeric('actual_revenue', { precision: 12, scale: 2 }),
    reviewTimeMinutes: numeric('review_time_minutes', { precision: 5, scale: 2 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    supplementIdIdx: index('supplement_drafts_supplement_id_idx').on(table.supplementId),
    statusIdx: index('supplement_drafts_status_idx').on(table.status),
    versionIdx: index('supplement_drafts_version_idx').on(table.version),
  })
);
