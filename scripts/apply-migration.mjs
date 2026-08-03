// Apply a migration SQL file to the deployed DB using the API's DATABASE_URL.
// Reads creds from env files (never printed). Idempotent + additive only.
//
// Usage:
//   node scripts/apply-migration.mjs                 # default: 002_schema_alignment.sql
//   node scripts/apply-migration.mjs 006_score_columns_widen.sql
import fs from 'node:fs';
import pg from 'pg';

const CANDIDATE_ENV_FILES = ['apps/api/.env', '.env.local', '.env', 'apps/web/.env.local'];

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

let env = {};
for (const f of CANDIDATE_ENV_FILES) {
  env = { ...loadEnv(f), ...env };
}
const DATABASE_URL = process.env.DATABASE_URL || env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('NO DATABASE_URL found in env files or process.env');
  process.exit(1);
}

const migration = process.argv[2] || '002_schema_alignment.sql';
const sqlPath = `packages/database/migrations/${migration}`;
if (!fs.existsSync(sqlPath)) {
  console.error('MIGRATION FILE NOT FOUND:', sqlPath);
  process.exit(1);
}
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new pg.Client({ connectionString: DATABASE_URL });
try {
  await client.connect();
  const started = Date.now();
  await client.query(sql);
  console.log('MIGRATION APPLIED OK in', Date.now() - started, 'ms:', migration);
} catch (e) {
  console.error('MIGRATION FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
