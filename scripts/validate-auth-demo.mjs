// Full auth + demo validation for Atlas. Uses shared helpers; cleans up throwaway user in finally.
import { loadEnv, j, createTestUser, login } from './lib/atlas-validate.mjs';

const env = loadEnv();
const SB = env.SUPABASE_URL.replace(/\/$/, '');
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API = 'http://localhost:3001/api/v1';
const out = {};

let testUser = null;
try {
  testUser = await createTestUser(env, 'yc-authdemo');
  out.createUser = { status: 200 };

  const loginRes = await login(env, testUser.email, testUser.password);
  out.login = { status: loginRes ? 200 : 401, hasAccessToken: !!loginRes, user: testUser.email };
  const token = loginRes;

  // Protected routes with real token
  out.protected = {};
  for (const r of ['/claims', '/companies', '/demo/status', '/intelligence/health', '/documents']) {
    const res = await j('GET', `${API}${r}`, { token });
    out.protected[r] = { status: res.status, keys: res.data ? Object.keys(res.data).slice(0, 6) : null };
  }

  // Generate demo data
  const demo = await j('POST', `${API}/demo/generate`, { token, body: {} });
  out.demoGenerate = { status: demo.status, success: demo.data?.success, summary: demo.data?.data?.summary };

  // Demo entities
  const personas = await j('GET', `${API}/demo/personas`, { token });
  out.demoPersonas = { status: personas.status, count: personas.data?.personas?.length };
  const claims = await j('GET', `${API}/demo/claims`, { token });
  out.demoClaims = { status: claims.status, count: claims.data?.claims?.length };

  // Intelligence health + diagnostics
  const health = await j('GET', `${API}/intelligence/health`, { token });
  out.intelHealth = { status: health.status, overall: health.data?.status, checks: health.data?.checks?.map(c => `${c.name}:${c.status}`) };

  // Logout (revoke access token; shared login helper exposes only the access token)
  const logout = await j('POST', `${SB}/auth/v1/logout`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    body: {},
  });
  out.logout = { status: logout.status };

  // Verify token invalid after logout
  const after = await j('GET', `${API}/claims`, { token });
  out.afterLogoutClaims = { status: after.status };
} catch (e) {
  out.fatal = e.message;
} finally {
  if (testUser) await testUser.cleanup();
  out.cleanup = 'done';
  console.log(JSON.stringify(out, null, 2));
}
