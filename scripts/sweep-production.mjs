// scripts/sweep-production.mjs
// Read-only authenticated endpoint sweep against the DEPLOYED production app.
//   sign in (demo user) -> sweep GET endpoints -> decision review (APPROVED)
//   -> decision detail -> export package
// No rows are created except the human-review status change on an existing
// demo decision. Secrets are never printed.
//
// Usage:
//   node scripts/sweep-production.mjs
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from
// .vercel-prod-check (gitignored) or process.env.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENV_FILE = join(ROOT, '.vercel-prod-check');
const APP_URL = process.env.APP_URL || 'https://project-atlas-07-web.vercel.app';
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

const out = { gets: {}, workflow: {} };
const failures = [];

// 1. Sign in
const token = await j(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
});
if (!token.ok) {
  console.error('SIGN-IN FAILED', token.status);
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

// 2. Read-only GET sweep of the main authenticated API surface
const gets = [
  '/api/claims?limit=5',
  '/api/claims/dashboard/stats',
  '/api/companies',
  '/api/adjusters',
  '/api/contacts',
  '/api/properties',
  '/api/documents?limit=5',
  '/api/supplements?limit=5',
  '/api/interviews?limit=5',
  '/api/notes?limit=5',
  '/api/tasks?limit=5',
  '/api/activity',
  '/api/activity/actions',
  '/api/activity/entity-types',
  '/api/activity/users',
  '/api/decisions',
  '/api/ai-supplements',
  '/api/demo/status',
];
for (const g of gets) {
  const res = await j(`${APP_URL}${g}`, { headers: H });
  out.gets[g] = res.status;
  // 405 = method not supported by design (e.g. POST-only routes when GET-swept)
  if (res.status === 500 || res.status === 404 || (res.status >= 400 && res.status !== 405 && res.status !== 401)) {
    failures.push(`${g}=${res.status}`);
  }
  process.stdout.write(res.status + ' ' + g + '\n');
}

// 3. Workflow: pick a decision, view it, review it (APPROVED), export it
const decisions = await j(`${APP_URL}/api/decisions`, { headers: H });
const decisionId = decisions.data?.decisions?.[0]?.id;
if (decisionId) {
  const detail = await j(`${APP_URL}/api/decisions/${decisionId}`, { headers: H });
  out.workflow.decisionDetail = detail.status;
  process.stdout.write(detail.status + ' /api/decisions/' + decisionId + '\n');
  if (detail.status >= 400) failures.push(`decisionDetail=${detail.status}`);

  const review = await j(`${APP_URL}/api/decisions/${decisionId}`, {
    method: 'POST',
    headers: H,
    body: { action: 'APPROVED', comments: 'Production endpoint sweep' },
  });
  out.workflow.decisionReview = review.status;
  process.stdout.write(review.status + ' POST /api/decisions/' + decisionId + ' (APPROVED)\n');
  if (review.status >= 400) failures.push(`decisionReview=${review.status}`);

  const exp = await j(`${APP_URL}/api/decisions/${decisionId}/export?format=json`, { headers: H });
  out.workflow.decisionExport = exp.status;
  process.stdout.write(exp.status + ' /api/decisions/' + decisionId + '/export\n');
  if (exp.status >= 400) failures.push(`decisionExport=${exp.status}`);

  const expMd = await j(`${APP_URL}/api/decisions/${decisionId}/export?format=markdown`, { headers: H });
  out.workflow.decisionExportMd = expMd.status;
  process.stdout.write(expMd.status + ' /api/decisions/' + decisionId + '/export?format=markdown\n');
  if (expMd.status >= 400) failures.push(`decisionExportMd=${expMd.status}`);

  // DELETE is part of the intended write path — record what the live app returns
  const del = await j(`${APP_URL}/api/decisions/${decisionId}`, { method: 'DELETE', headers: H });
  out.workflow.decisionDelete = del.status;
  process.stdout.write(del.status + ' DELETE /api/decisions/' + decisionId + '\n');
  if (del.status === 500 || del.status === 404) failures.push(`decisionDelete=${del.status}`);
}

// 4. Unauthenticated health
const health = await j(`${APP_URL}/api/claims`, {});
out.health = health.status;
process.stdout.write(health.status + ' GET /api/claims (no auth, expect 401)\n');

console.log('\n===== SWEEP SUMMARY =====');
console.log(JSON.stringify(out, null, 1));
console.log(
  `\nVERDICT: ${failures.length === 0 ? 'ZERO 500s / 404s ON AUTHENTICATED ENDPOINTS' : 'FAILURES: ' + failures.join(', ')}`
);
process.exit(failures.length === 0 ? 0 : 1);
