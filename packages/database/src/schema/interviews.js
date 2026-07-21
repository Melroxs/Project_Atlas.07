"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interviews = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const companies_1 = require("./companies");
const users_1 = require("./users");
const properties_1 = require("./properties");
const claims_1 = require("./claims");
exports.interviews = (0, pg_core_1.pgTable)("interviews", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    companyId: (0, pg_core_1.uuid)("company_id").notNull().references(() => companies_1.companies.id, { onDelete: "cascade" }),
    propertyId: (0, pg_core_1.uuid)("property_id").references(() => properties_1.properties.id, { onDelete: "set null" }),
    claimId: (0, pg_core_1.uuid)("claim_id").references(() => claims_1.claims.id, { onDelete: "set null" }),
    createdBy: (0, pg_core_1.uuid)("created_by").notNull().references(() => users_1.profiles.id, { onDelete: "set null" }),
    updatedBy: (0, pg_core_1.uuid)("updated_by").references(() => users_1.profiles.id, { onDelete: "set null" }),
    // Interview metadata
    interviewNumber: (0, pg_core_1.varchar)("interview_number", { length: 64 }).notNull(),
    templateId: (0, pg_core_1.varchar)("template_id", { length: 64 }).notNull(),
    templateName: (0, pg_core_1.varchar)("template_name", { length: 255 }).notNull(),
    // Status and progress
    status: (0, pg_core_1.varchar)("status", { length: 32 }).notNull().default("draft"), // draft, in_progress, completed, archived
    currentSection: (0, pg_core_1.varchar)("current_section", { length: 64 }),
    progress: (0, pg_core_1.numeric)("progress", { precision: 5, scale: 2 }).default('0'), // 0-100
    // Interview data
    responses: (0, pg_core_1.jsonb)("responses"), // All question responses
    conversationHistory: (0, pg_core_1.jsonb)("conversation_history"), // AI conversation history
    metadata: (0, pg_core_1.jsonb)("metadata"), // Additional metadata for AI processing
    // Generated entities
    generatedCustomerId: (0, pg_core_1.uuid)("generated_customer_id"),
    generatedPropertyId: (0, pg_core_1.uuid)("generated_property_id"),
    generatedClaimId: (0, pg_core_1.uuid)("generated_claim_id"),
    generatedAdjusterId: (0, pg_core_1.uuid)("generated_adjuster_id"),
    generatedDocumentIds: (0, pg_core_1.jsonb)("generated_document_ids"), // Array of document IDs
    // Timestamps
    startedAt: (0, pg_core_1.timestamp)("started_at"),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    archivedAt: (0, pg_core_1.timestamp)("archived_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
