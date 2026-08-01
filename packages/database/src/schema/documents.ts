import { pgTable, uuid, text, varchar, bigint, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { claims } from "./claims";

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  claimId: uuid("claim_id").references(() => claims.id, { onDelete: "set null" }),
  url: text("url").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  sizeBytes: bigint("size_bytes", { mode: "number" }), // file size in bytes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});
