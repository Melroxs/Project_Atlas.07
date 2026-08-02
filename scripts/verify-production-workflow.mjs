// scripts/verify-production-workflow.mjs
// Verifies the write-path demo workflow against the DEPLOYED production app:
//   sign in -> list claims -> POST /api/decisions (Decision Engine) -> get decision
//   -> GET /api/decisions/[id]/export (Export Package)
// Values are masked in output; never prints secrets.

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
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return out;
}
const env = loadEnv(ENV_FILE);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

const out = { steps: {} };

// 1. Sign in
const token = await j(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
});
if (!token.ok) { console.error('SIGN-IN FAILED', token.status); process.exit(1); }
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

// 2. List claims -> pick the first seeded claim
const claims = await j(`${APP_URL}/api/claims?limit=5`, { headers: H });
out.steps.listClaims = claims.status;
if (!claims.ok) { console.error('LIST CLAIMS FAILED', claims.status); process.exit(1); }
const claim = claims.data?.data?.[0];
if (!claim) { console.error('NO CLAIMS — run demo generate first'); process.exit(1); }
console.log(`Picked claim ${claim.claimNumber} (${claim.id})`);
out.claimId = claim.id;

// 3. Run the Decision Engine
const evalRes = await j(`${APP_URL}/api/decisions`, {
  method: 'POST',
  headers: H,
  body: { claimId: claim.id },
});
out.steps.decisionEval = evalRes.status;
if (evalRes.ok) {
  const decisionId = evalRes.data?.decision?.id;
  out.decisionId = decisionId;
  console.log(`Decision Engine OK — decision ${decisionId} (confidence ${evalRes.data?.decision?.confidenceScore}, status ${evalRes.data?.decision?.status})`);
} else {
  console.log(`DECISION EVAL FAILED: ${evalRes.status} ${JSON.stringify(evalRes.data).slice(0, 300)}`);
}

// 4. Export the package
if (out.decisionId) {
  const exp = await j(`${APP_URL}/api/decisions/${out.decisionId}/export`, { headers: H });
  out.steps.exportPackage = exp.status;
  const isMarkdown = typeof exp.data === 'string' && exp.data.includes('#');
  console.log(`Export Package ${exp.status}${isMarkdown ? ' (markdown OK)' : ''}${exp.ok ? '' : ' FAILED'}`);
} else {
  out.steps.exportPackage = 'SKIPPED';
  console.log('Export skipped (no decision)');
}

// 5. Decision list now shows the new decision
const decisions = await j(`${APP_URL}/api/decisions`, { headers: H });
out.steps.listDecisions = decisions.status;
console.log(`Decision list ${decisions.status} — ${decisions.data?.decisions?.length ?? '?'} decisions`);

console.log('\n===== WORKFLOW SUMMARY =====');
console.log(JSON.stringify(out, null, 1));
const failed = Object.entries(out.steps).filter(([, s]) => s === 500 || (typeof s === 'number' && s >= 400));
console.log(`\nVERDICT: ${failed.length === 0 ? 'WRITE-PATH WORKFLOW PASSED' : 'ISSUES: ' + failed.map(([k, v]) => `${k}=${v}`).join(', ')}`);
process.exit(failed.length === 0 ? 0 : 1);
