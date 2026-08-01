// Read-only DB inspection: list public tables + row counts. Never prints credentials.
import fs from 'node:fs';
import pg from 'pg';

const envFile = 'apps/api/.env';
const content = fs.readFileSync(envFile, 'utf8');
const env = {};
for (const line of content.split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  console.log('PUBLIC TABLES:', tables.rows.map(r => r.table_name).join(', ') || '(none)');

  for (const { table_name } of tables.rows) {
    try {
      const c = await pool.query(`SELECT COUNT(*)::int AS n FROM public."${table_name}"`);
      console.log(`  ${table_name}: ${c.rows[0].n} rows`);
    } catch { console.log(`  ${table_name}: (count failed)`); }
  }

  // Check auth schema presence (Supabase-managed)
  const authT = await pool.query(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema='auth'`
  );
  console.log('AUTH SCHEMA TABLES:', authT.rows[0].n);
} catch (e) {
  console.log('INSPECTION FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
