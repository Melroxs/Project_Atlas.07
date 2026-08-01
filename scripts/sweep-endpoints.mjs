// Authenticated sweep of Fastify endpoints — reads + writes.
// Uses shared helpers; cleans up throwaway users and created rows in finally.
import fs from 'node:fs';
import { loadEnv, j, createTestUser, login, COMPANY_ID } from './lib/atlas-validate.mjs';

const env = loadEnv();
const API = 'http://localhost:3001/api/v1';
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const SB = env.SUPABASE_URL.replace(/\/$/, '');
const out = { gets: {}, posts: {}, details: {}, workflow: {} };

// Track created rows so we can clean them up (best-effort, in finally)
const created = { companies: [], claims: [], adjusters: [], properties: [], contacts: [], documents: [], supplements: [], interviews: [], notes: [], tasks: [], tenants: [], profiles: [], memberships: [] };
const delREST = (table, id) => j('DELETE', `${SB}/rest/v1/${table}?id=eq.${id}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
async function cleanupRows() {
  for (const id of created.evidenceLinks || []) await delREST('evidence_links', id);
  for (const id of created.notes) await delREST('notes', id);
  for (const id of created.tasks) await delREST('tasks', id);
  for (const id of created.contacts) await delREST('contacts', id);
  for (const id of created.documents) await delREST('documents', id);
  for (const id of created.supplements) await delREST('supplements', id);
  for (const id of created.interviews) await delREST('interviews', id);
  for (const id of created.claims) await delREST('claims', id);
  for (const id of created.adjusters) await delREST('adjusters', id);
  for (const id of created.properties) await delREST('properties', id);
  for (const id of created.memberships) await j('DELETE', `${SB}/rest/v1/tenant_members?id=eq.${id}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  for (const id of created.profiles) await delREST('profiles', id);
  for (const id of created.tenants) await delREST('tenants', id);
  for (const id of created.companies) await delREST('companies', id);
}

let testUser = null;
let secondUser = null;
try {
  testUser = await createTestUser(env, 'yc-sweep');
  const token = await login(env, testUser.email, testUser.password);
  if (!token) throw new Error('Login failed');
  const auth = { token };

  // ---- GET sweep ----
  const gets = [
    '/claims', '/companies', '/adjusters', '/properties', '/contacts', '/tenants',
    '/users', '/tenant-members', '/supplements', '/interviews', '/notes', '/tasks',
    '/documents', '/activity', '/claims/dashboard/stats', '/intelligence/insights',
    '/intelligence/recommendations', '/intelligence/learning/statistics',
  ];
  for (const g of gets) {
    const res = await j('GET', `${API}${g}`, auth);
    out.gets[g] = { status: res.status, error: res.data?.error || null };
  }

  // ---- POST sweep (children reference COMPANY_ID, which the test user belongs to) ----
  // Company (tenant-level, no company_id)
  const co = await j('POST', `${API}/companies`, { ...auth, body: { name: `Sweep Co ${Date.now()}`, slug: `sweep-co-${Date.now()}` } });
  out.posts['/companies'] = { status: co.status, error: co.data?.error || null };
  if (co.data?.id) created.companies.push(co.data.id);

  // Claim
  const cl = await j('POST', `${API}/claims`, { ...auth, body: { claimNumber: `SWP-${Date.now()}`, status: 'new', insuranceCompany: 'Test Ins', customerName: 'Sweep Customer', companyId: COMPANY_ID } });
  out.posts['/claims'] = { status: cl.status, error: cl.data?.error || null };
  const claimId = cl.data?.id; if (claimId) created.claims.push(claimId);

  // Adjuster
  const adj = await j('POST', `${API}/adjusters`, { ...auth, body: { fullName: `Sweep Adj ${Date.now()}`, email: `adj-${Date.now()}@sweep.test`, active: true, companyId: COMPANY_ID } });
  out.posts['/adjusters'] = { status: adj.status, error: adj.data?.error || null };
  const adjusterId = adj.data?.id; if (adjusterId) created.adjusters.push(adjusterId);

  // Property
  const pr = await j('POST', `${API}/properties`, { ...auth, body: { address: '1 Sweep St', city: 'Testville', state: 'TX', zip: '12345', ownerName: 'Sweep Owner', companyId: COMPANY_ID } });
  out.posts['/properties'] = { status: pr.status, error: pr.data?.error || null };
  const propertyId = pr.data?.id; if (propertyId) created.properties.push(propertyId);

  // Contact
  const ct = await j('POST', `${API}/contacts`, { ...auth, body: { name: 'Sweep Contact', email: 'c@sweep.test', companyId: COMPANY_ID } });
  out.posts['/contacts'] = { status: ct.status, error: ct.data?.error || null };
  if (ct.data?.id) created.contacts.push(ct.data.id);

  // Document (url is NOT NULL; schema now includes it)
  const doc = await j('POST', `${API}/documents`, { ...auth, body: { claimId, url: `https://example.com/d-${Date.now()}.pdf`, fileName: `doc-${Date.now()}.pdf`, mimeType: 'application/pdf', sizeBytes: 1234, companyId: COMPANY_ID } });
  out.posts['/documents'] = { status: doc.status, error: doc.data?.error || null };
  const documentId = doc.data?.id; if (documentId) created.documents.push(documentId);

  // Supplement
  const sup = await j('POST', `${API}/supplements`, { ...auth, body: { claimId, adjusterId, supplementNumber: `SUP-${Date.now()}`, status: 'draft', companyId: COMPANY_ID } });
  out.posts['/supplements'] = { status: sup.status, error: sup.data?.error || null };
  const supplementId = sup.data?.id; if (supplementId) created.supplements.push(supplementId);

  // Interview
  const iv = await j('POST', `${API}/interviews`, { ...auth, body: { claimId, propertyId, templateId: 'fnol-v1', templateName: 'FNOL', status: 'draft', companyId: COMPANY_ID } });
  out.posts['/interviews'] = { status: iv.status, error: iv.data?.error || null };
  const interviewId = iv.data?.id; if (interviewId) created.interviews.push(interviewId);

  // Note
  const nt = await j('POST', `${API}/notes`, { ...auth, body: { entityType: 'claim', entityId: claimId, content: 'Sweep note', companyId: COMPANY_ID } });
  out.posts['/notes'] = { status: nt.status, error: nt.data?.error || null };
  if (nt.data?.id) created.notes.push(nt.data.id);

  // Task
  const tk = await j('POST', `${API}/tasks`, { ...auth, body: { title: 'Sweep task', status: 'open', companyId: COMPANY_ID } });
  out.posts['/tasks'] = { status: tk.status, error: tk.data?.error || null };
  if (tk.data?.id) created.tasks.push(tk.data.id);

  // Tenant (tenant-level)
  const tn = await j('POST', `${API}/tenants`, { ...auth, body: { name: `Sweep Tenant ${Date.now()}`, slug: `sweep-tn-${Date.now()}` } });
  out.posts['/tenants'] = { status: tn.status, error: tn.data?.error || null };
  if (tn.data?.id) created.tenants.push(tn.data.id);

  // User profile (tenant-level; profiles.id has no default, pass one)
  const profileId = crypto.randomUUID();
  const us = await j('POST', `${API}/users`, { ...auth, body: { id: profileId, email: `sweep-user-${Date.now()}@atlas.test`, firstName: 'Sweep', lastName: 'User' } });
  out.posts['/users'] = { status: us.status, error: us.data?.error || null };
  if (us.data?.id) created.profiles.push(us.data.id);

  // Tenant member: use a SECOND throwaway user so the main test user keeps exactly
  // one membership (auth middleware uses .single()).
  secondUser = await createTestUser(env, 'yc-mem');
  const tm = await j('POST', `${API}/tenant-members`, { ...auth, body: { userId: secondUser.userId, companyId: COMPANY_ID, role: 'member' } });
  out.posts['/tenant-members'] = { status: tm.status, error: tm.data?.error || null };
  if (tm.data?.id) created.memberships.push(tm.data.id);

  // Evidence link (requires a real document + recommendationId)
  const el = await j('POST', `${API}/evidence-links`, { ...auth, body: { recommendationId: crypto.randomUUID(), documentId, relevance: 'high', description: 'Evidence from sweep document', strengthScore: 0.9 } });
  out.posts['/evidence-links'] = { status: el.status, error: el.data?.error || null, missing: el.data?.error === 'At least one of documentId, photoId, or interviewAnswerId must be provided' };
  if (el.data?.id) created.evidenceLinks = [el.data.id];

  // ---- Detail GETs ----
  if (claimId) {
    const d = await j('GET', `${API}/claims/${claimId}`, auth);
    out.details['/claims/:id'] = { status: d.status, error: d.data?.error || null, hasFinancialSummary: !!d.data?.financialSummary };
    const s = await j('GET', `${API}/claims/${claimId}/supplements`, auth);
    out.details['/claims/:id/supplements'] = { status: s.status, error: s.data?.error || null };
    const i = await j('GET', `${API}/claims/${claimId}/interviews`, auth);
    out.details['/claims/:id/interviews'] = { status: i.status, error: i.data?.error || null };
    const t = await j('GET', `${API}/claims/${claimId}/transitions`, auth);
    out.details['/claims/:id/transitions'] = { status: t.status, error: t.data?.error || null };
  }
  if (supplementId) {
    const d = await j('GET', `${API}/supplements/${supplementId}`, auth);
    out.details['/supplements/:id'] = { status: d.status, error: d.data?.error || null };
    const t = await j('GET', `${API}/supplements/${supplementId}/transitions`, auth);
    out.details['/supplements/:id/transitions'] = { status: t.status, error: t.data?.error || null };
  }
  if (interviewId) {
    const d = await j('GET', `${API}/interviews/${interviewId}`, auth);
    out.details['/interviews/:id'] = { status: d.status, error: d.data?.error || null };
  }
  if (documentId) {
    const d = await j('GET', `${API}/documents/${documentId}`, auth);
    out.details['/documents/:id'] = { status: d.status, error: d.data?.error || null };
    const dl = await j('GET', `${API}/documents/${documentId}/download`, { ...auth, noFollow: true });
    out.details['/documents/:id/download'] = { status: dl.status, redirectTo: dl.location || null, error: dl.data?.error || null };
    out.details['/documents/:id/download'].ok = dl.status >= 300 && dl.status < 400 && (dl.location || '').startsWith('http');
  }
  if (adjusterId) {
    const d = await j('GET', `${API}/adjusters/${adjusterId}`, auth);
    out.details['/adjusters/:id'] = { status: d.status, error: d.data?.error || null };
  }
  if (propertyId) {
    const d = await j('GET', `${API}/properties/${propertyId}`, auth);
    out.details['/properties/:id'] = { status: d.status, error: d.data?.error || null };
  }

  // ---- Workflow transitions ----
  if (claimId) {
    const c1 = await j('PUT', `${API}/claims/${claimId}/status`, { ...auth, body: { status: 'inspection_scheduled' } });
    out.workflow['claim->inspection_scheduled'] = { status: c1.status, error: c1.data?.error || null };
    const c2 = await j('PUT', `${API}/claims/${claimId}/status`, { ...auth, body: { status: 'inspection_complete' } });
    out.workflow['claim->inspection_complete'] = { status: c2.status, error: c2.data?.error || null };
    const c3 = await j('PUT', `${API}/claims/${claimId}/status`, { ...auth, body: { status: 'estimate_submitted' } });
    out.workflow['claim->estimate_submitted'] = { status: c3.status, error: c3.data?.error || null };
  }
  if (supplementId) {
    const s1 = await j('PUT', `${API}/supplements/${supplementId}/status`, { ...auth, body: { status: 'ready_for_review' } });
    out.workflow['supplement->ready_for_review'] = { status: s1.status, error: s1.data?.error || null };
  }
  if (interviewId) {
    const i1 = await j('PUT', `${API}/interviews/${interviewId}/status`, { ...auth, body: { status: 'in_progress' } });
    out.workflow['interview->in_progress'] = { status: i1.status, error: i1.data?.error || null };
    const i2 = await j('PUT', `${API}/interviews/${interviewId}/status`, { ...auth, body: { status: 'completed' } });
    out.workflow['interview->completed'] = { status: i2.status, error: i2.data?.error || null };
    const gen = await j('POST', `${API}/interviews/${interviewId}/generate-claim`, auth);
    out.workflow['interview->generate-claim'] = { status: gen.status, error: gen.data?.error || null };
  }

  // ---- Summary: separate server errors (>=500) from client/validation errors (4xx) ----
  const all = [
    ...Object.values(out.gets), ...Object.values(out.posts),
    ...Object.values(out.details), ...Object.values(out.workflow),
  ];
  out.summary = {
    total: all.length,
    serverErrors: all.filter(r => r.status >= 500).length,
    clientErrors: all.filter(r => r.status >= 400 && r.status < 500).length,
    ok: all.filter(r => r.status >= 200 && r.status < 400).length,
  };
} catch (e) {
  out.fatal = e.message;
} finally {
  await cleanupRows().catch(() => {});
  if (secondUser) await secondUser.cleanup();
  if (testUser) await testUser.cleanup();
  console.log(JSON.stringify(out, null, 2));
}
