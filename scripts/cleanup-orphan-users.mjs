// Clean up orphaned validation users from earlier script runs (read-only listing + targeted delete).
import { loadEnv, j } from './lib/atlas-validate.mjs';

const env = loadEnv();
const SB = env.SUPABASE_URL.replace(/\/$/, '');
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

const list = await j('GET', `${SB}/auth/v1/admin/users?per_page=200`, {
  headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
});
const users = (list.data?.users || list.data || []);
const orphans = users.filter(u => /^yc-(validation|sweep|authdemo)-\d+@atlas\.local$/.test(u.email || ''));
console.log('Orphaned validation users found:', orphans.length);
for (const u of orphans) {
  // Remove tenant_members + profiles rows, then the auth user
  await j('DELETE', `${SB}/rest/v1/tenant_members?user_id=eq.${u.id}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  await j('DELETE', `${SB}/rest/v1/profiles?id=eq.${u.id}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  const del = await j('DELETE', `${SB}/auth/v1/admin/users/${u.id}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  console.log(`  deleted ${u.email} (${u.id}) -> ${del.status}`);
}
console.log('Cleanup complete.');
