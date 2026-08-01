// ==========================================================
// Atlas
// apps/api/src/scripts/seed-demo.ts
// Demo environment seed CLI
// ==========================================================
//
// Usage:
//   DATABASE_URL=postgres://... bun src/scripts/seed-demo.ts
//   DATABASE_URL=postgres://... node -r ts-node/register src/scripts/seed-demo.ts
//
// Applies pending migrations then seeds the complete demo
// environment (company, users, adjusters, claims, policies,
// interviews, documents, photos, supplements, AI drafts,
// activity, decision history + compliance + outcomes).
//
// Safe to re-run: the seeder resets the demo company's data first.

import { generateDemoData } from "../lib/demo-data/demo-data-service";
import { seedDemoData } from "../lib/demo-data/database-seeder";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Provide a Postgres connection string (API Keys)."
    );
    process.exit(1);
  }

  console.log("Generating deterministic demo data (seed 42)...");
  const demoData = generateDemoData();

  console.log("Persisting demo environment to database...");
  const result = await seedDemoData(demoData);

  if (!result.success) {
    console.error("Seeding failed:", result.message);
    process.exit(1);
  }

  console.log(`✅ ${result.message}`);
  console.log(`   companyId: ${result.companyId}`);
  console.log("   Summary:");
  console.log(`     companies: 1`);
  console.log(`     users: ${demoData.users.length}`);
  console.log(`     adjusters: ${demoData.adjusters.length}`);
  console.log(`     customers: ${demoData.customers.length}`);
  console.log(`     properties: ${demoData.properties.length}`);
  console.log(`     claims: ${demoData.claims.length}`);
  console.log(`     documents: ${demoData.documents.length}`);
  console.log(`     interviews: ${demoData.interviews.length}`);
  console.log(`     supplements: ${demoData.supplements.length}`);
  console.log(`     activities: ${demoData.activities.length}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
