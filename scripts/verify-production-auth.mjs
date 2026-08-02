// scripts/verify-production-auth.mjs
// End-to-end authenticated verification against the DEPLOYED Atlas production app.
// - Reads env from .vercel-prod-check (pulled from Vercel; values never printed)
// - Creates a demo user in the production Supabase project (Admin API)
// - Inserts company + profile + tenant_members rows via the production DB
// - Signs in via password grant, builds the @supabase/ssr session cookie
// - Sweeps authenticated API routes on the live deployment
// - Seeds demo data via POST /api/demo/generate and re-sweeps
// - Prints a summary with ALL secrets masked

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENV_FILE = join(ROOT, '.vercel-prod-check');
const APP_URL = process.env.APP_URL || 'https://project-atlas-07-web.vercel.app';
const DEMO_EMAIL = 'demo@projectatlas07.app';
const DEMO_PASSWORD = 'AtlasDemo2026!';
const DEMO_FIRST = 'Atlas';
const DEMO_LAST = 'Demo';

function loadEnv(file) {
  if (!existsSync(file)) {
    console.error(`ENV FILE MISSING: ${file}`);
    process.exit(1);
  }
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  }
  return out;
}

const env = loadEnv(ENV_FILE);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = env.DATABASE_URL;

for (const [k, v] of [
  ['NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', ANON_KEY],
  ['SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY],
  ['DATABASE_URL', DATABASE_URL],
]) {
  if (!v) {
    console.error(`MISSING REQUIRED ENV: ${k}`);
    process.exit(1);
  }
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const COOKIE_NAME = `sb-${projectRef}-auth-token`;

const out = { appUrl: APP_URL, projectRef, cookieName: COOKIE_NAME, steps: {}, sweep: {} };

async function j(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, ok: res.ok, data };
}

function mask(str, keep = 6) {
  if (!str) return str;
  if (str.length <= keep * 2) return '***';
  return `${str.slice(0, keep)}...${str.slice(-keep)}`;
}

async function main() {
  // ---------- 1. Create demo user via Supabase Admin API ----------
  console.log('== 1. Create demo user (Supabase Admin API) ==');
  let authRes = await j(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: DEMO_FIRST, last_name: DEMO_LAST },
    },
  });
  if (!authRes.ok && authRes.status === 409) {
    console.log('  demo user already exists (409) — reusing');
  } else if (!authRes.ok) {
    console.log(`  WARN admin user create failed: ${authRes.status} ${JSON.stringify(authRes.data || {}).slice(0, 200)}`);
  } else {
    console.log(`  created user: ${authRes.data?.id || 'unknown'}`);
  }
  out.steps.adminUserCreate = authRes.status;

  // ---------- 2. Ensure company + profile + tenant_members rows ----------
  console.log('== 2. Ensure tenant context in production DB ==');
  const pg = await import('pg');
  const pool = new pg.default.Pool({ connectionString: DATABASE_URL, max: 3 });
  let userId = null;
  try {
    // find existing user id from profiles, else we need auth.users lookup via admin API list
    const prof = await pool.query(`SELECT id FROM profiles WHERE email = $1 LIMIT 1`, [DEMO_EMAIL]);
    if (prof.rows.length) {
      userId = prof.rows[0].id;
      console.log(`  profile exists: ${userId}`);
    } else {
      // fetch the auth user id from the admin API list
      const list = await j(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      const u = (list.data?.users || []).find((x) => x.email === DEMO_EMAIL);
      if (u) {
        userId = u.id;
        await pool.query(
          `INSERT INTO profiles (id, email, first_name, last_name) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
          [userId, DEMO_EMAIL, DEMO_FIRST, DEMO_LAST],
        );
        console.log(`  profile inserted: ${userId}`);
      } else {
        console.error('  FATAL: could not resolve demo user id');
        process.exit(1);
      }
    }

    // company (slug unique)
    const companySlug = 'atlas-demo-company';
    let companyId = null;
    const comp = await pool.query(`SELECT id FROM companies WHERE slug = $1 LIMIT 1`, [companySlug]);
    if (comp.rows.length) {
      companyId = comp.rows[0].id;
      console.log(`  company exists: ${companyId}`);
    } else {
      const ins = await pool.query(
        `INSERT INTO companies (name, slug, plan) VALUES ($1,$2,$3) RETURNING id`,
        ['Atlas Demo Company', companySlug, 'demo'],
      );
      companyId = ins.rows[0].id;
      console.log(`  company inserted: ${companyId}`);
    }
    out.companyId = companyId;

    const mem = await pool.query(
      `INSERT INTO tenant_members (user_id, company_id, role) VALUES ($1,$2,'Owner') ON CONFLICT DO NOTHING`,
      [userId, companyId],
    );
    console.log(`  tenant_members ensured (command ${mem.command})`);
    out.steps.tenantContext = 'ok';
  } finally {
    await pool.end();
  }

  // ---------- 3. Sign in and build the SSR cookie ----------
  console.log('== 3. Sign in + build @supabase/ssr cookie ==');
  const token = await j(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  if (!token.ok || !token.data?.access_token) {
    console.error(`  SIGN-IN FAILED: ${token.status} ${JSON.stringify(token.data || {}).slice(0, 300)}`);
    process.exit(1);
  }
  const session = {
    access_token: token.data.access_token,
    refresh_token: token.data.refresh_token,
    expires_in: token.data.expires_in,
    expires_at: token.data.expires_at,
    token_type: token.data.token_type,
    user: token.data.user,
  };
  // @supabase/ssr stores cookie values as "base64-" + base64url(JSON.stringify(session))
  // (see node_modules/@supabase/ssr/dist/main/cookies.js: BASE64_PREFIX = "base64-")
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const cookieHeader = `${COOKIE_NAME}=${cookieValue}`;
  console.log(`  cookie: ${COOKIE_NAME}=${cookieValue.slice(0, 14)}... (${cookieValue.length} chars)`);
  out.steps.signIn = token.status;

  // ---------- 4. Authenticated route sweep (pre-seed) ----------
  console.log('== 4. Authenticated API sweep (pre-seed) ==');
  const routes = [
    ['/api/demo/status', 'GET'],
    ['/api/claims', 'GET'],
    ['/api/companies', 'GET'],
    ['/api/adjusters', 'GET'],
    ['/api/properties', 'GET'],
    ['/api/contacts', 'GET'],
    ['/api/notes', 'GET'],
    ['/api/activity', 'GET'],
    ['/api/intelligence/health', 'GET'],
    ['/api/intelligence/recommendations', 'GET'],
    ['/api/intelligence/insights', 'GET'],
    ['/api/decisions', 'GET'],
    ['/api/demo/metrics', 'GET'],
    ['/api/demo/personas', 'GET'],
    ['/api/demo/walkthroughs', 'GET'],
    ['/api/operations/company/overview', 'GET'],
  ];
  for (const [path, method] of routes) {
    const r = await j(`${APP_URL}${path}`, {
      method,
      headers: { Cookie: cookieHeader },
    });
    const ok = r.status < 400;
    out.sweep[path] = r.status;
    console.log(`  [${ok ? 'OK ' : 'ERR'}] ${r.status} ${path}${r.status === 401 ? '  <- session rejected' : ''}`);
    if (r.status >= 500) {
      console.log(`       body: ${JSON.stringify(r.data || {}).slice(0, 250)}`);
    }
  }

  // ---------- 5. Seed demo data ----------
  console.log('== 5. POST /api/demo/generate ==');
  const gen = await j(`${APP_URL}/api/demo/generate`, {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: {},
  });
  out.steps.demoGenerate = gen.status;
  if (gen.ok) {
    const s = gen.data?.data?.summary;
    console.log(`  generate OK: claims=${s?.claims} supplements=${s?.supplements} documents=${s?.documents} interviews=${s?.interviews} activities=${s?.activities} adjusters=${s?.adjusters}`);
  } else {
    console.log(`  generate FAILED: ${gen.status} ${JSON.stringify(gen.data || {}).slice(0, 300)}`);
  }

  // ---------- 6. Re-sweep key routes after seeding ----------
  console.log('== 6. Post-seed verification ==');
  const postRoutes = [
    ['/api/claims', 'GET'],
    ['/api/supplements', 'GET'],
    ['/api/interviews', 'GET'],
    ['/api/documents', 'GET'],
    ['/api/demo/metrics', 'GET'],
    ['/api/demo/claims', 'GET'],
    ['/api/demo/activities', 'GET'],
    ['/api/demo/supplements', 'GET'],
    ['/api/operations/company/overview', 'GET'],
    ['/api/intelligence/health', 'GET'],
  ];
  for (const [path, method] of postRoutes) {
    const r = await j(`${APP_URL}${path}`, {
      method,
      headers: { Cookie: cookieHeader },
    });
    out.sweep[`post:${path}`] = r.status;
    const ok = r.status < 400;
    console.log(`  [${ok ? 'OK ' : 'ERR'}] ${r.status} ${path}`);
    if (r.status >= 500) console.log(`       body: ${JSON.stringify(r.data || {}).slice(0, 250)}`);
  }

  // ---------- 7. Protected page check ----------
  console.log('== 7. Protected page (admin) with session ==');
  const page = await fetch(`${APP_URL}/admin`, { headers: { Cookie: cookieHeader }, redirect: 'manual' });
  out.steps.adminPage = page.status;
  console.log(`  /admin with cookie -> ${page.status}${page.status >= 300 && page.status < 400 ? ' (redirect)' : ''}`);

  // ---------- Summary ----------
  const failed = Object.entries(out.sweep).filter(([, s]) => s >= 400);
  console.log('\n===== SUMMARY =====');
  console.log(`App URL:    ${APP_URL}`);
  console.log(`Project ref: ${projectRef}`);
  console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Endpoints checked: ${Object.keys(out.sweep).length}`);
  console.log(`Failed (>=400): ${failed.length}`);
  for (const [p, s] of failed) console.log(`  FAIL ${s} ${p}`);
  console.log('Secrets (masked):');
  console.log(`  SUPABASE_URL=${mask(SUPABASE_URL)}  ANON_KEY=${mask(ANON_KEY)}  SERVICE_KEY=${mask(SERVICE_KEY)}  DATABASE_URL=${mask(DATABASE_URL)}`);

  const allOk = failed.length === 0 && gen.ok && page.status < 400;
  console.log(`\nVERDICT: ${allOk ? 'AUTHENTICATED PRODUCTION CHECK PASSED' : 'ISSUES FOUND'}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
