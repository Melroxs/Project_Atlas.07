"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjusters = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const companies_1 = require("./companies");
exports.adjusters = (0, pg_core_1.pgTable)("adjusters", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    companyId: (0, pg_core_1.uuid)("company_id").notNull().references(() => companies_1.companies.id, { onDelete: "cascade" }),
    fullName: (0, pg_core_1.text)("full_name").notNull(),
    insuranceCompany: (0, pg_core_1.text)("insurance_company"),
    email: (0, pg_core_1.text)("email"),
    phone: (0, pg_core_1.text)("phone"),
    office: (0, pg_core_1.text)("office"),
    territory: (0, pg_core_1.text)("territory"),
    notes: (0, pg_core_1.text)("notes"),
    active: (0, pg_core_1.boolean)("active").default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
    createdBy: (0, pg_core_1.uuid)("created_by"),
    updatedBy: (0, pg_core_1.uuid)("updated_by"),
});
