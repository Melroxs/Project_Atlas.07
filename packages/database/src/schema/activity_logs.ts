import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { profiles } from "./users";

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
  userName: text("user_name"),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  entityName: text("entity_name"),
  claimId: uuid("claim_id"), // optional claim-scoped activity (used by AI supplement engine)
  action: text("action").notNull(),
  description: text("description"),
  previousValues: jsonb("previous_values"),
  newValues: jsonb("new_values"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
