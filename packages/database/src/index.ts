import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export * from "./schema/tenants";
export * from "./schema/users";
export * from "./schema/companies";
export * from "./schema/contacts";
export * from "./schema/properties";
export * from "./schema/claims";
export * from "./schema/supplements";
export * from "./schema/supplement-drafts";
export * from "./schema/documents";
export * from "./schema/evidence-links";
export * from "./schema/tasks";
export * from "./schema/notes";
export * from "./schema/adjusters";
export * from "./schema/activity_logs";
export * from "./schema/interviews";
export * from "./schema/interview_questions";
export * from "./schema/interview-templates";
export * from "./schema/ai_conversations";
export * from "./schema/tenant_members";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);
