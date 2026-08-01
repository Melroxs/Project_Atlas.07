import { pgTable, uuid, text, timestamp, varchar, jsonb, numeric } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { adjusters } from "./adjusters";
import { properties } from "./properties";

export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  adjusterId: uuid("adjuster_id").references(() => adjusters.id, { onDelete: "set null" }),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
  claimNumber: varchar("claim_number", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default('new'), // Workflow statuses
  // Multi-entry workflow: how this claim entered the lifecycle.
  // 'new_claim' | 'existing_claim' | 'supplement_only' | 'imported'
  entryPoint: varchar("entry_point", { length: 32 }).notNull().default('new_claim'),
  // For imported projects: source system reference (optional)
  sourceSystem: varchar("source_system", { length: 255 }),
  dateOfLoss: timestamp("date_of_loss"),
  dateReported: timestamp("date_reported"),
  insuranceCompany: varchar("insurance_company", { length: 255 }),
  policyNumber: varchar("policy_number", { length: 100 }),
  deductible: numeric("deductible"),
  estimatedValue: numeric("estimated_value"),
  approvedValue: numeric("approved_value"),
  description: text("description"),
  customerName: varchar("customer_name", { length: 255 }),
  customerEmail: varchar("customer_email", { length: 255 }),
  customerPhone: varchar("customer_phone", { length: 50 }),
  statusHistory: jsonb("status_history"), // Array of status transitions
  financialSummary: jsonb("financial_summary"), // Financial breakdown
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});
