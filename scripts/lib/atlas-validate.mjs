// Shared helpers for Atlas validation scripts.
// Reads creds from apps/api/.env (never printed). Creates/deletes throwaway Supabase users.
import fs from 'node:fs';

export const COMPANY_ID = '029ec4f5-be05-40c6-8563-476ab30077d4';

export function loadEnv(file = 'apps/api/.env') {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

export async function j(method, url, { token, body, headers = {}, noFollow = false } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body) h['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method, headers: h,
    body: body ? JSON.stringify(body) : undefined,
    redirect: noFollow ? 'manual' : 'follow',
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data, location: res.headers.get('location') };
}

// Create a throwaway user + tenant_members row. Returns { userId, cleanup }.
export async function createTestUser(env, emailPrefix = 'yc-validation') {
  const SB = env.SUPABASE_URL.replace(/\/$/, '');
  const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
  const EMAIL = `${emailPrefix}-${Date.now()}@atlas.local`;
  const PASS = `Val!${Math.random().toString(36).slice(2, 10)}`;
  const created = await j('POST', `${SB}/auth/v1/admin/users`, {
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    body: { email: EMAIL, password: PASS, email_confirm: true },
  });
  if (created.status !== 200 || !created.data?.id) {
    throw new Error(`createTestUser failed: ${created.status} ${created.data?.msg || ''}`);
  }
  const userId = created.data.id;
  const tm = await j('POST', `${SB}/rest/v1/tenant_members`, {
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: { user_id: userId, company_id: COMPANY_ID, role: 'admin' },
  });
  if (tm.status >= 300) {
    // Roll back the user we just created (best-effort; never throw from rollback)
    try {
      await j('DELETE', `${SB}/auth/v1/admin/users/${userId}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
    } catch {}
    throw new Error(`tenant_members insert failed: ${tm.status}`);
  }
  const cleanup = async () => {
    // Delete tenant_members + profiles rows explicitly (auth.user deletion does not cascade),
    // then the auth user. Best-effort, never throws.
    try { await j('DELETE', `${SB}/rest/v1/tenant_members?user_id=eq.${userId}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }); } catch {}
    try { await j('DELETE', `${SB}/rest/v1/profiles?id=eq.${userId}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }); } catch {}
    try { await j('DELETE', `${SB}/auth/v1/admin/users/${userId}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }); } catch {}
  };
  return { userId, email: EMAIL, password: PASS, cleanup };
}

// Login and return access token, or null.
export async function login(env, email, password) {
  const SB = env.SUPABASE_URL.replace(/\/$/, '');
  const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const res = await j('POST', `${SB}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON },
    body: { email, password },
  });
  return res.data?.access_token || null;
}
