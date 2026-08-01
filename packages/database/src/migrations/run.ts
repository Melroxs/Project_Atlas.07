// ==========================================================
// Atlas
// packages/database/src/migrations/run.ts
// Migration Runner
// ==========================================================
//
// Applies pending SQL migrations from packages/database/migrations
// in filename order (001_*, 002_*, ...), tracking applied versions
// in a `schema_migrations` table so each migration runs exactly
// once. Skips `000_reset_*` (destructive reset script) and
// `*_down.sql` files.
//
// Usage:
//   DATABASE_URL=postgres://... node -r ts-node/register packages/database/src/migrations/run.ts
//   DATABASE_URL=postgres://... bun packages/database/src/migrations/run.ts

import { Pool } from "pg";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "migrations");

/**
 * Pure file-selection logic (unit-testable): returns the migration SQL
 * files to apply, in order. Skips the destructive reset (000_*), the
 * down migrations (*_down.sql), and any non-\d{3}_*.sql files.
 */
export function collectMigrationFiles(files: string[]): string[] {
  // Deduplicate so a migration can never be applied twice, then sort
  // deterministically by filename (001_*, 002_*, ...).
  return [...new Set(files)]
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .filter((f) => !f.startsWith("000_"))
    .filter((f) => !f.endsWith("_down.sql"))
    .sort();
}

async function runMigrations(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "DATABASE_URL is not set. Provide a Postgres connection string (e.g. via freebuff-env or API Keys)."
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    // Ensure the tracking table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Collect migration files (skip reset + down files)
    const files = collectMigrationFiles(readdirSync(MIGRATIONS_DIR));

    const { rows } = await pool.query("SELECT version FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.version));

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`SKIP  ${file} (already applied)`);
        continue;
      }

      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`APPLY ${file}`);
        appliedCount++;
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(`FAIL  ${file}:`, error);
        process.exitCode = 1;
        break;
      } finally {
        client.release();
      }
    }

    console.log(
      appliedCount === 0
        ? "No pending migrations."
        : `Applied ${appliedCount} migration${appliedCount === 1 ? "" : "s"}.`
    );
  } finally {
    await pool.end();
  }
}

// Run directly when invoked as the entry script
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("run.ts") || process.argv[1].endsWith("run.js"));

if (isMain) {
  runMigrations()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { runMigrations };
