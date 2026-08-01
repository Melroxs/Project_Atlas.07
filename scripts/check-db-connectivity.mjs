// Read-only connectivity check. Never prints credentials.
import fs from 'node:fs';
import pg from 'pg';

const envFile = process.argv[2] || 'apps/api/.env';
const content = fs.readFileSync(envFile, 'utf8');
const env = {};
for (const line of content.split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const url = env.DATABASE_URL;
if (!url) {
  console.log('NO DATABASE_URL in', envFile);
  process.exit(2);
}
const host = (url.match(/@([^:/]+)/) || [])[1];
const db = (url.match(/\/([^/?]+)(\?|$)/) || [])[1];
const user = (url.match(/^[a-z+]+:\/\/([^:]+):/) || [])[1];
console.log(`Target (masked): user=${user} host=${host} db=${db}`);

const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 10000 });
try {
  const r = await pool.query('SELECT 1 AS ok, version()');
  console.log('CONNECT OK');
  console.log('PG:', r.rows[0].version.split(' on ')[0]);
} catch (e) {
  console.log('CONNECT FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
