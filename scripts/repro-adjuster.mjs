import { loadEnv, j, createTestUser, login, COMPANY_ID } from './lib/atlas-validate.mjs';
const env = loadEnv();
const API = 'http://localhost:3001/api/v1';
let tu = null;
try {
  tu = await createTestUser(env, 'yc-repro');
  const token = await login(env, tu.email, tu.password);
  const r = await j('POST', `${API}/adjusters`, { token, body: { fullName: 'Repro Adj', email: 'adj@sweep.test', active: true, companyId: COMPANY_ID } });
  console.log(JSON.stringify({ status: r.status, data: r.data }, null, 2));
} catch (e) { console.error('ERR', e.message); }
finally { if (tu) await tu.cleanup(); }
