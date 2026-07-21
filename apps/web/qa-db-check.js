require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const { rows: tenantCols } = await pool.query(
      `SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'tenant_members'`
    );
    console.log('tenant_members columns:', JSON.stringify(tenantCols, null, 2));
    const { rows: companyCols } = await pool.query(
      `SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'companies'`
    );
    console.log('companies columns:', JSON.stringify(companyCols, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
main();
