"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claims = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const companies_1 = require("./companies");
const adjusters_1 = require("./adjusters");
const properties_1 = require("./properties");
exports.claims = (0, pg_core_1.pgTable)("claims", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    companyId: (0, pg_core_1.uuid)("company_id").notNull().references(() => companies_1.companies.id, { onDelete: "cascade" }),
    adjusterId: (0, pg_core_1.uuid)("adjuster_id").references(() => adjusters_1.adjusters.id, { onDelete: "set null" }),
    propertyId: (0, pg_core_1.uuid)("property_id").references(() => properties_1.properties.id, { onDelete: "set null" }),
    claimNumber: (0, pg_core_1.varchar)("claim_number", { length: 64 }).notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 32 }).notNull().default('new'), // Workflow statuses
    dateOfLoss: (0, pg_core_1.timestamp)("date_of_loss"),
    dateReported: (0, pg_core_1.timestamp)("date_reported"),
    insuranceCompany: (0, pg_core_1.varchar)("insurance_company", { length: 255 }),
    policyNumber: (0, pg_core_1.varchar)("policy_number", { length: 100 }),
    deductible: (0, pg_core_1.numeric)("deductible"),
    estimatedValue: (0, pg_core_1.numeric)("estimated_value"),
    approvedValue: (0, pg_core_1.numeric)("approved_value"),
    description: (0, pg_core_1.text)("description"),
    customerName: (0, pg_core_1.varchar)("customer_name", { length: 255 }),
    customerEmail: (0, pg_core_1.varchar)("customer_email", { length: 255 }),
    customerPhone: (0, pg_core_1.varchar)("customer_phone", { length: 50 }),
    statusHistory: (0, pg_core_1.jsonb)("status_history"), // Array of status transitions
    financialSummary: (0, pg_core_1.jsonb)("financial_summary"), // Financial breakdown
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
    createdBy: (0, pg_core_1.uuid)("created_by"),
    updatedBy: (0, pg_core_1.uuid)("updated_by"),
});
