import { loadEnv, j, createTestUser, login, COMPANY_ID } from './lib/atlas-validate.mjs';
const env = loadEnv();
const API = 'http://localhost:3001/api/v1';
let tu = null;
try {
  tu = await createTestUser(env, 'yc-det');
  const token = await login(env, tu.email, tu.password);
  const auth = { token };
  const ts = Date.now();

  const adj = await j('POST', `${API}/adjusters`, { ...auth, body: { fullName: `Det Adj ${ts}`, email: `det-adj-${ts}@sweep.test`, active: true, companyId: COMPANY_ID } });
  console.log('POST /adjusters:', adj.status, JSON.stringify(adj.data)?.slice(0, 200));
  if (adj.data?.id) {
    const g = await j('GET', `${API}/adjusters/${adj.data.id}`, auth);
    console.log('GET /adjusters/:id:', g.status, JSON.stringify(g.data)?.slice(0, 200));
    const gl = await j('GET', `${API}/adjusters`, auth);
    console.log('GET /adjusters (list):', gl.status, 'count:', Array.isArray(gl.data) ? gl.data.length : (gl.data?.data?.length ?? 'n/a'));
  }

  const doc = await j('POST', `${API}/documents`, { ...auth, body: { url: `https://x.test/d-${ts}.pdf`, fileName: `d-${ts}.pdf`, mimeType: 'application/pdf', sizeBytes: 99, companyId: COMPANY_ID } });
  console.log('POST /documents:', doc.status, JSON.stringify(doc.data)?.slice(0, 200));
  if (doc.data?.id) {
    const g = await j('GET', `${API}/documents/${doc.data.id}`, auth);
    console.log('GET /documents/:id:', g.status, JSON.stringify(g.data)?.slice(0, 200));
  }

  const pr = await j('POST', `${API}/properties`, { ...auth, body: { address: '9 Det St', city: 'D', state: 'TX', zip: '12345', ownerName: 'O', companyId: COMPANY_ID } });
  console.log('POST /properties:', pr.status, JSON.stringify(pr.data)?.slice(0, 200));
  if (pr.data?.id) {
    const g = await j('GET', `${API}/properties/${pr.data.id}`, auth);
    console.log('GET /properties/:id:', g.status, JSON.stringify(g.data)?.slice(0, 200));
  }

  const cl = await j('POST', `${API}/claims`, { ...auth, body: { claimNumber: `DET-${ts}`, status: 'new', companyId: COMPANY_ID } });
  console.log('POST /claims:', cl.status, JSON.stringify(cl.data)?.slice(0, 200));
  if (cl.data?.id) {
    const g = await j('GET', `${API}/claims/${cl.data.id}`, auth);
    console.log('GET /claims/:id:', g.status, JSON.stringify(g.data)?.slice(0, 200));
  }
} catch (e) { console.error('ERR', e.message); }
finally { if (tu) await tu.cleanup(); }
