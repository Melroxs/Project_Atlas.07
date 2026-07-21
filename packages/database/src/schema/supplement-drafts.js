"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplementDrafts = void 0;
// packages/database/src/schema/supplement-drafts.ts
const pg_core_1 = require("drizzle-orm/pg-core");
const supplements_1 = require("./supplements");
exports.supplementDrafts = (0, pg_core_1.pgTable)('supplement_drafts', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    supplementId: (0, pg_core_1.uuid)('supplement_id').references(() => supplements_1.supplements.id, { onDelete: 'cascade' }).notNull(),
    version: (0, pg_core_1.numeric)('version', { precision: 10, scale: 0 }).notNull().default('1'),
    status: (0, pg_core_1.text)('status').notNull().default('draft'), // draft, reviewing, approved, rejected
    generatedAt: (0, pg_core_1.timestamp)('generated_at').notNull().defaultNow(),
    reviewedAt: (0, pg_core_1.timestamp)('reviewed_at'),
    approvedAt: (0, pg_core_1.timestamp)('approved_at'),
    rejectedAt: (0, pg_core_1.timestamp)('rejected_at'),
    reviewedBy: (0, pg_core_1.uuid)('reviewed_by'),
    approvedBy: (0, pg_core_1.uuid)('approved_by'),
    rejectedBy: (0, pg_core_1.uuid)('rejected_by'),
    recommendations: (0, pg_core_1.jsonb)('recommendations').notNull(),
    userModifications: (0, pg_core_1.jsonb)('user_modifications'),
    aiProvider: (0, pg_core_1.text)('ai_provider').notNull(),
    aiModel: (0, pg_core_1.text)('ai_model').notNull(),
    confidenceScore: (0, pg_core_1.numeric)('confidence_score', { precision: 3, scale: 2 }).notNull(),
    riskScore: (0, pg_core_1.numeric)('risk_score', { precision: 3, scale: 2 }).notNull(),
    estimatedRevenue: (0, pg_core_1.numeric)('estimated_revenue', { precision: 12, scale: 2 }).notNull(),
    actualRevenue: (0, pg_core_1.numeric)('actual_revenue', { precision: 12, scale: 2 }),
    reviewTimeMinutes: (0, pg_core_1.numeric)('review_time_minutes', { precision: 5, scale: 2 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
}, (table) => ({
    supplementIdIdx: (0, pg_core_1.index)('supplement_drafts_supplement_id_idx').on(table.supplementId),
    statusIdx: (0, pg_core_1.index)('supplement_drafts_status_idx').on(table.status),
    versionIdx: (0, pg_core_1.index)('supplement_drafts_version_idx').on(table.version),
}));
