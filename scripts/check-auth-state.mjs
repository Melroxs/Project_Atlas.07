// Read-only check: tenant membership + auth users (non-secret fields only).
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
  const tm = await pool.query('SELECT user_id, company_id, role FROM tenant_members');
  console.log('tenant_members:', JSON.stringify(tm.rows));
  const co = await pool.query('SELECT id, name, slug FROM companies');
  console.log('companies:', JSON.stringify(co.rows));
  const pr = await pool.query('SELECT id, email FROM profiles');
  console.log('profiles:', JSON.stringify(pr.rows));
  const au = await pool.query('SELECT id, email, created_at FROM auth.users ORDER BY created_at');
  console.log('auth.users:', JSON.stringify(au.rows));
} catch (e) {
  console.log('CHECK FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
