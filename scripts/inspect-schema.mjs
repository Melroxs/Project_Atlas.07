// Full deployed schema introspection: tables, columns, types, nullability, defaults, FKs, indexes, enums.
import fs from 'node:fs';
import pg from 'pg';

const env = {};
for (const line of fs.readFileSync('apps/api/.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  // Public tables
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
  );
  console.log('=== PUBLIC TABLES (' + tables.rows.length + ') ===');
  console.log(tables.rows.map(r => r.table_name).join('\n'));

  console.log('\n=== COLUMNS PER TABLE ===');
  for (const { table_name } of tables.rows) {
    const cols = await pool.query(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1
       ORDER BY ordinal_position`, [table_name]);
    console.log(`\n-- ${table_name} --`);
    for (const c of cols.rows) {
      console.log(`  ${c.column_name} | ${c.data_type}${c.udt_name !== c.data_type ? ' (' + c.udt_name + ')' : ''} | null=${c.is_nullable} | def=${c.column_default || '-'}`);
    }
  }

  console.log('\n=== FOREIGN KEYS ===');
  const fks = await pool.query(
    `SELECT tc.table_name AS from_table, kcu.column_name AS from_col,
            ccu.table_name AS to_table, ccu.column_name AS to_col
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
     WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
     ORDER BY tc.table_name`);
  for (const f of fks.rows) console.log(`  ${f.from_table}.${f.from_col} -> ${f.to_table}.${f.to_col}`);

  console.log('\n=== INDEXES ===');
  const idxs = await pool.query(
    `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname`);
  for (const i of idxs.rows) console.log(`  ${i.tablename}: ${i.indexname} :: ${i.indexdef}`);

  console.log('\n=== ENUM TYPES ===');
  const enums = await pool.query(`SELECT typname, enumlabel FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid ORDER BY typname, e.enumsortorder`);
  for (const e of enums.rows) console.log(`  ${e.typname}: ${e.enumlabel}`);

  console.log('\n=== RLS POLICIES ===');
  const pols = await pool.query(
    `SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
     FROM pg_policies WHERE schemaname='public' ORDER BY tablename`);
  for (const p of pols.rows) console.log(`  ${p.tablename}: ${p.policyname} [${p.permissive}, ${p.cmd}] qual=${p.qual || '-'} with_check=${p.with_check || '-'}`);

  console.log('\n=== ROW COUNTS ===');
  for (const { table_name } of tables.rows) {
    try {
      const c = await pool.query(`SELECT COUNT(*)::int AS n FROM public."${table_name}"`);
      console.log(`  ${table_name}: ${c.rows[0].n}`);
    } catch (e) { console.log(`  ${table_name}: (count failed: ${e.message.split('\n')[0]})`); }
  }
} catch (e) {
  console.log('FATAL:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
