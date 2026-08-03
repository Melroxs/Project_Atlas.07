// scripts/probe-deploy.mjs
// Detects whether the DEPLOYED production build includes the new
// DELETE /api/decisions/:id handler: 200 (archive) = new build live,
// 405 = old build still serving. Reads the public Supabase config from
// .vercel-prod-check (gitignored) or process.env.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENV_FILE = join(ROOT, '.vercel-prod-check');
const APP_URL = process.env.APP_URL || 'https://project-atlas-07-web.vercel.app';
const DECISION_ID = process.env.DECISION_ID || '84646125-f30b-4fd1-a354-1bffb37ff098';

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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@projectatlas07.app', password: 'AtlasDemo2026!' }),
});
const data = await res.json();
if (!data.access_token) {
  console.log(`PROBE SIGN-IN FAILED (${res.status}) ${new Date().toISOString()}`);
  process.exit(1);
}
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const session = {
  access_token: data.access_token,
  refresh_token: data.refresh_token,
  expires_in: data.expires_in,
  expires_at: data.expires_at,
  token_type: data.token_type,
  user: data.user,
};
const cookie = `sb-${projectRef}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
const del = await fetch(`${APP_URL}/api/decisions/${DECISION_ID}`, {
  method: 'DELETE',
  headers: { Cookie: cookie },
});
console.log(`DELETE status: ${del.status} at ${new Date().toISOString()}`);
process.exit(del.status === 200 ? 0 : 1);
