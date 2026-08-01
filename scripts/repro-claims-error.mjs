// Reproduce the exact error from the claims/companies routes against the real DB.
import fs from 'node:fs';
import pg from 'pg';

const envFile = 'apps/api/.env';
const env = {};
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  // Replicate the drizzle SELECT that the claims route builds (all schema columns)
  const claimsCols = [
    'id','company_id','adjuster_id','property_id','claim_number','status','date_of_loss',
    'date_reported','insurance_company','policy_number','deductible','estimated_value',
    'approved_value','description','customer_name','customer_email','customer_phone',
    'status_history','financial_summary','created_at','updated_at','created_by','updated_by',
  ].map(c => `"claims"."${c}"`).join(', ');
  try {
    const r = await pool.query(`SELECT ${claimsCols} FROM "claims" WHERE "claims"."company_id" = $1`, ['029ec4f5-be05-40c6-8563-476ab30077d4']);
    console.log('CLAIMS SELECT OK, rows:', r.rows.length);
  } catch (e) {
    console.log('CLAIMS SELECT FAILED:', e.message.split('\n')[0]);
  }

  // RLS policies on claims/companies
  const pol = await pool.query(
    `SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('claims','companies')`
  );
  console.log('policies:', JSON.stringify(pol.rows));

  // Does companies table have company_id column (needed by RLS policy)?
  const co = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='company_id'`
  );
  console.log('companies has company_id:', co.rows.length > 0);

  // Replicate companies select
  try {
    const r = await pool.query(`SELECT * FROM "companies" WHERE "companies"."id" = $1`, ['029ec4f5-be05-40c6-8563-476ab30077d4']);
    console.log('COMPANIES SELECT OK, rows:', r.rows.length);
  } catch (e) {
    console.log('COMPANIES SELECT FAILED:', e.message.split('\n')[0]);
  }
} catch (e) {
  console.log('FATAL:', e.message);
} finally {
  await pool.end();
}
