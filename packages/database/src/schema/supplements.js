"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplements = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const claims_1 = require("./claims");
const companies_1 = require("./companies");
const adjusters_1 = require("./adjusters");
exports.supplements = (0, pg_core_1.pgTable)("supplements", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    companyId: (0, pg_core_1.uuid)("company_id").notNull().references(() => companies_1.companies.id, { onDelete: "cascade" }),
    claimId: (0, pg_core_1.uuid)("claim_id").notNull().references(() => claims_1.claims.id, { onDelete: "cascade" }),
    adjusterId: (0, pg_core_1.uuid)("adjuster_id").references(() => adjusters_1.adjusters.id, { onDelete: "set null" }),
    supplementNumber: (0, pg_core_1.varchar)("supplement_number", { length: 64 }).notNull(),
    version: (0, pg_core_1.numeric)("version", { precision: 3, scale: 0 }).default('1'),
    status: (0, pg_core_1.varchar)("status", { length: 32 }).notNull().default('draft'),
    carrier: (0, pg_core_1.varchar)("carrier", { length: 255 }),
    requestedAmount: (0, pg_core_1.numeric)("requested_amount", { precision: 12, scale: 2 }),
    approvedAmount: (0, pg_core_1.numeric)("approved_amount", { precision: 12, scale: 2 }),
    difference: (0, pg_core_1.numeric)("difference", { precision: 12, scale: 2 }),
    lineItems: (0, pg_core_1.jsonb)("line_items"), // Array of line items
    internalNotes: (0, pg_core_1.text)("internal_notes"),
    submissionDate: (0, pg_core_1.timestamp)("submission_date"),
    responseDate: (0, pg_core_1.timestamp)("response_date"),
    approvalDate: (0, pg_core_1.timestamp)("approval_date"),
    denialReason: (0, pg_core_1.text)("denial_reason"),
    revisionHistory: (0, pg_core_1.jsonb)("revision_history"), // Array of revision entries
    statusHistory: (0, pg_core_1.jsonb)("status_history"), // Array of status transitions
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
    createdBy: (0, pg_core_1.uuid)("created_by"),
    updatedBy: (0, pg_core_1.uuid)("updated_by"),
});
