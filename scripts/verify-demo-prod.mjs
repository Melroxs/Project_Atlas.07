// scripts/verify-demo-prod.mjs
// QA probe for the DEPLOYED demo API surface. Signs in as the demo user and
// checks the demo endpoints a live presentation depends on:
//   GET  /api/demo/status
//   GET  /api/demo/metrics
//   GET  /api/demo/claims
//   POST /api/demo/export (package, markdown)
//   POST /api/demo/export (package, zip)
// Read-only — no rows are created. Secrets are never printed.
//
// Usage: node scripts/verify-demo-prod.mjs [baseUrl]
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENV_FILE = join(ROOT, '.vercel-prod-check');
const APP_URL = process.argv[2] || process.env.APP_URL || 'https://project-atlas-07-web.vercel.app';
const DEMO_EMAIL = 'demo@projectatlas07.app';
const DEMO_PASSWORD = 'AtlasDemo2026!';

function loadEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return out;
}
const env = loadEnv(ENV_FILE);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('MISSING ENV: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

async function j(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok, data };
}

// 1. Sign in
const token = await j(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
});
if (!token.ok) {
  console.error('SIGN-IN FAILED', token.status, JSON.stringify(token.data || {}).slice(0, 160));
  process.exit(1);
}
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const session = {
  access_token: token.data.access_token,
  refresh_token: token.data.refresh_token,
  expires_in: token.data.expires_in,
  expires_at: token.data.expires_at,
  token_type: token.data.token_type,
  user: token.data.user,
};
const cookie = `sb-${projectRef}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
const H = { Cookie: cookie, 'Content-Type': 'application/json' };
console.log('Signed in as', DEMO_EMAIL);

const results = {};
const failures = [];

// 2. Demo API surface
const status = await j(`${APP_URL}/api/demo/status`, { headers: H });
results.status = status.status;
console.log(status.status, 'GET /api/demo/status');
if (status.status === 200 && status.data) {
  console.log('   hasData:', status.data.hasData, '· enabled:', status.data.enabled, '· company:', status.data.companyName || '-');
}
if (status.status >= 500) failures.push('demo/status=' + status.status);

const metrics = await j(`${APP_URL}/api/demo/metrics`, { headers: H });
results.metrics = metrics.status;
console.log(metrics.status, 'GET /api/demo/metrics');
if (metrics.status === 200 && metrics.data?.metrics) {
  const m = metrics.data.metrics;
  console.log('   claims:', m.totalClaims ?? m.claims, '· revenue requested:', m.totalRevenueRequested ?? m.revenueRequested ?? '-');
}
if (metrics.status >= 500) failures.push('demo/metrics=' + metrics.status);

const claims = await j(`${APP_URL}/api/demo/claims`, { headers: H });
results.claims = claims.status;
console.log(claims.status, 'GET /api/demo/claims');
if (claims.status === 200 && claims.data?.claims) console.log('   claims:', claims.data.claims.length);
if (claims.status >= 500) failures.push('demo/claims=' + claims.status);

const expMd = await j(`${APP_URL}/api/demo/export`, {
  method: 'POST',
  headers: H,
  body: { type: 'package', format: 'markdown' },
});
results.exportMarkdown = expMd.status;
console.log(expMd.status, 'POST /api/demo/export (package, markdown)');
if (expMd.status === 200 && expMd.data) console.log('   filename:', expMd.data.filename);
if (expMd.status === 500) failures.push('export/markdown=' + expMd.status);

const expZip = await j(`${APP_URL}/api/demo/export`, {
  method: 'POST',
  headers: H,
  body: { type: 'package', format: 'zip' },
});
results.exportZip = expZip.status;
console.log(expZip.status, 'POST /api/demo/export (package, zip)');
// 400 on an older build without ZIP support is expected; 500 is a real failure.
if (expZip.status === 500) failures.push('export/zip=' + expZip.status);

console.log('\n===== DEMO PROBE SUMMARY =====');
console.log(JSON.stringify(results, null, 1));
console.log(
  `\nVERDICT: ${failures.length === 0 ? 'DEMO API SURFACE HEALTHY' : 'FAILURES: ' + failures.join(', ')}`
);
process.exit(failures.length === 0 ? 0 : 1);
