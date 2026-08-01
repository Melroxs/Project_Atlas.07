// Apply 003_multi_entry_workflow.sql to the deployed DB using the API's DATABASE_URL.
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

const sql = fs.readFileSync('packages/database/migrations/003_multi_entry_workflow.sql', 'utf8');

const client = new pg.Client({ connectionString: DATABASE_URL });
try {
  await client.connect();
  const started = Date.now();
  await client.query(sql);
  // Verify the columns landed
  const check = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='claims' AND column_name IN ('entry_point','source_system') ORDER BY column_name"
  );
  console.log('MIGRATION 003 APPLIED OK in', Date.now() - started, 'ms');
  console.log('claims columns now:', JSON.stringify(check.rows.map((r) => r.column_name)));
} catch (e) {
  console.error('MIGRATION FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
