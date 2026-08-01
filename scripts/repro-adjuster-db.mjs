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
const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();
try {
  // Minimal insert matching what the route sends
  const r = await client.query(
    `INSERT INTO adjusters (company_id, full_name, email, active, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    ['029ec4f5-be05-40c6-8563-476ab30077d4', 'DB Repro Adj', 'adj2@sweep.test', true, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000']
  );
  console.log('INSERT OK:', r.rows[0].id);
} catch (e) {
  console.error('INSERT FAILED:', e.message);
  console.error('CODE:', e.code);
} finally {
  await client.end();
}
