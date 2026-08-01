// Reproduce POST /ai-supplements/generate and capture the full error details.
import { loadEnv, j, createTestUser, login, COMPANY_ID } from './lib/atlas-validate.mjs';

const env = loadEnv();
const API = 'http://localhost:3001/api/v1';
let testUser = null;
try {
  testUser = await createTestUser(env, 'yc-repro');
  const token = await login(env, testUser.email, testUser.password);
  const auth = { token };

  const cl = await j('POST', `${API}/claims`, { ...auth, body: { claimNumber: `AI-${Date.now()}`, status: 'new', insuranceCompany: 'Test Ins', customerName: 'AI Customer', companyId: COMPANY_ID } });
  console.log('claim:', cl.status, cl.data?.id);
  const claimId = cl.data?.id;

  const sup = await j('POST', `${API}/supplements`, { ...auth, body: { claimId, supplementNumber: `SUP-${Date.now()}`, status: 'draft', companyId: COMPANY_ID } });
  console.log('supplement:', sup.status, sup.data?.id);

  const gen = await j('POST', `${API}/ai-supplements/generate`, { ...auth, body: { supplementId: sup.data?.id } });
  console.log('generate status:', gen.status);
  console.log('generate body:', JSON.stringify(gen.data, null, 2).slice(0, 2000));
} catch (e) {
  console.error('FATAL', e.message);
} finally {
  if (testUser) await testUser.cleanup();
}
