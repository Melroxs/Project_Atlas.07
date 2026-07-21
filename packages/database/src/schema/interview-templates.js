"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interviewTemplates = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const companies_1 = require("./companies");
exports.interviewTemplates = (0, pg_core_1.pgTable)("interview_templates", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    companyId: (0, pg_core_1.uuid)("company_id").notNull().references(() => companies_1.companies.id, { onDelete: "cascade" }),
    // Template metadata
    templateId: (0, pg_core_1.varchar)("template_id", { length: 64 }).notNull().unique(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    version: (0, pg_core_1.varchar)("version", { length: 16 }).notNull().default("1.0"),
    // Template structure
    sections: (0, pg_core_1.jsonb)("sections").notNull(), // Array of sections with questions
    settings: (0, pg_core_1.jsonb)("settings"), // Template settings (autosave, validation, etc.)
    // Status
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    isDefault: (0, pg_core_1.boolean)("is_default").default(false),
    // Timestamps
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
    createdBy: (0, pg_core_1.uuid)("created_by"),
    updatedBy: (0, pg_core_1.uuid)("updated_by"),
});
