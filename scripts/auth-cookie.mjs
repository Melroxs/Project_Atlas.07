// scripts/auth-cookie.mjs
// Generates an auth cookie exactly the way the deployed app does (via the
// repo's own @supabase/ssr client + auth.setSession) and tests it against a
// target deployment. This is the definitive session cookie format the app's
// middleware / requireAuth() will accept.
//
// Usage: node scripts/auth-cookie.mjs [baseUrl]
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServerClient } from '@supabase/ssr';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENV_FILE = join(ROOT, '.vercel-prod-check');
const APP_URL = process.argv[2] || process.env.APP_URL || 'https://project-atlas-07-web.vercel.app';

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
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 1. Sign in via Supabase Auth REST (same as the app's login page does)
const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@projectatlas07.app', password: 'AtlasDemo2026!' }),
});
const auth = await tokenRes.json();
if (!auth.access_token) {
  console.log('SIGN-IN FAILED', tokenRes.status, JSON.stringify(auth).slice(0, 200));
  process.exit(1);
}

// 2. Feed the session through the SAME @supabase/ssr client the app uses and
//    capture the cookies it would write.
const written = [];
const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
  cookies: {
    getAll: () => [],
    setAll: (cookiesToSet) => {
      for (const { name, value, options } of cookiesToSet) written.push({ name, value, options });
    },
  },
});
await supabase.auth.setSession({
  access_token: auth.access_token,
  refresh_token: auth.refresh_token,
});

const cookieStr = written.map((c) => `${c.name}=${c.value}`).join('; ');
console.log('Cookies written by @supabase/ssr setSession:');
for (const c of written) console.log('  ', c.name, `(len ${c.value.length})`);
if (written.length === 0) {
  console.log('NO COOKIES WRITTEN — cannot proceed');
  process.exit(1);
}

// 3. Replay against the target deployment
const res = await fetch(`${APP_URL}/api/claims?limit=1`, { headers: { Cookie: cookieStr } });
const body = await res.text();
console.log(`\nGET ${APP_URL}/api/claims -> ${res.status}`);
console.log('  body:', body.slice(0, 200));
process.exit(res.status === 200 ? 0 : 1);
