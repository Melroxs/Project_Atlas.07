// Apply 002_schema_alignment.sql to the deployed DB using the API's DATABASE_URL.
// Reads creds from apps/api/.env (never printed). Idempotent + additive only.
import fs from 'node:fs';
import pg from 'pg';

function loadEnv(file = 'apps/api/.env') {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const DATABASE_URL = env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('NO DATABASE_URL in apps/api/.env');
  process.exit(1);
}

const sql = fs.readFileSync('packages/database/migrations/002_schema_alignment.sql', 'utf8');

const client = new pg.Client({ connectionString: DATABASE_URL });
try {
  await client.connect();
  const started = Date.now();
  await client.query(sql);
  console.log('MIGRATION APPLIED OK in', Date.now() - started, 'ms');
} catch (e) {
  console.error('MIGRATION FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
