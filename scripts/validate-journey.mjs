// Phase 7: Complete 11-step user journey with DB persistence verification.
// Claim -> Interview -> Document Upload -> Photo Upload -> Evidence Graph ->
// Decision Engine -> Compliance Validation -> AI Recommendation -> Human Review ->
// Package Export -> Atlas Voice
import { loadEnv, j, createTestUser, login, COMPANY_ID } from './lib/atlas-validate.mjs';

const env = loadEnv();
const API = 'http://localhost:3001/api/v1';
const SB = env.SUPABASE_URL.replace(/\/$/, '');
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SVC, Authorization: `Bearer ${SVC}` };
const out = {};
const created = { claims: [], interviews: [], documents: [], supplements: [], links: [], drafts: [], profiles: [] };
const del = (t, id) => j('DELETE', `${SB}/rest/v1/${t}?id=eq.${id}`, { headers: H });
async function cleanup() {
  for (const id of created.drafts) await del('supplement_drafts', id).catch(() => {});
  for (const id of created.links) await del('evidence_links', id).catch(() => {});
  for (const id of created.supplements) await del('supplements', id).catch(() => {});
  for (const id of created.interviews) await del('interviews', id).catch(() => {});
  for (const id of created.documents) await del('documents', id).catch(() => {});
  for (const id of created.claims) await del('claims', id).catch(() => {});
  for (const id of created.profiles) await del('profiles', id).catch(() => {});
}

let testUser = null;
try {
  testUser = await createTestUser(env, 'yc-journey');
  const token = await login(env, testUser.email, testUser.password);
  if (!token) throw new Error('Login failed');
  const auth = { token };
  const t0 = Date.now();

  // 1. Claim
  const cl = await j('POST', `${API}/claims`, { ...auth, body: { claimNumber: `JRN-${Date.now()}`, status: 'new', insuranceCompany: 'State Farm', customerName: 'Journey Customer', companyId: COMPANY_ID } });
  const claimId = cl.data?.id; if (claimId) created.claims.push(claimId);
  out.claim = { status: cl.status, id: !!claimId };

  // 2. Interview (create + complete)
  const iv = await j('POST', `${API}/interviews`, { ...auth, body: { claimId, templateId: 'fnol-v1', templateName: 'FNOL', status: 'draft', companyId: COMPANY_ID } });
  const interviewId = iv.data?.id; if (interviewId) created.interviews.push(interviewId);
  const iv2 = interviewId ? await j('PUT', `${API}/interviews/${interviewId}/status`, { ...auth, body: { status: 'completed' } }) : null;
  out.interview = { create: iv.status, complete: iv2?.status };

  // 3. Document Upload
  const doc = await j('POST', `${API}/documents`, { ...auth, body: { claimId, url: `https://example.com/j-${Date.now()}.pdf`, fileName: `journey-${Date.now()}.pdf`, mimeType: 'application/pdf', sizeBytes: 2048, companyId: COMPANY_ID } });
  const documentId = doc.data?.id; if (documentId) created.documents.push(documentId);
  out.document = { create: doc.status, id: !!documentId };

  // 4. Photo Upload — no photos table exists; document the gap via evidence photoId
  out.photo = { status: 'NOT_IMPLEMENTED', note: 'No photos table or /photos endpoint in schema or API' };

  // 5. Evidence Graph
  const recId = crypto.randomUUID();
  const link = await j('POST', `${API}/evidence-links`, { ...auth, body: { recommendationId: recId, documentId, relevance: 'high', description: 'Journey evidence', strengthScore: 0.9 } });
  const linkId = link.data?.id; if (linkId) created.links.push(linkId);
  const graph = linkId ? await j('GET', `${API}/evidence-links/${recId}`, auth) : null;
  out.evidenceGraph = { create: link.status, query: graph?.status, edges: graph?.data?.evidence?.length ?? 0 };

  // 6. Decision Engine
  const ins = await j('GET', `${API}/intelligence/insights`, auth);
  const recs = await j('GET', `${API}/intelligence/recommendations`, auth);
  out.decisionEngine = { insights: ins.status, recommendations: recs.status, recommendationCount: recs.data?.length ?? 0 };

  // 7. Compliance Validation — no endpoint exists
  out.compliance = { status: 'NOT_IMPLEMENTED', note: 'No /compliance route registered in API; web ai-analysis route is a stub' };

  // 8. AI Recommendation (human review gateway)
  const sup = await j('POST', `${API}/supplements`, { ...auth, body: { claimId, supplementNumber: `SUP-${Date.now()}`, status: 'draft', companyId: COMPANY_ID } });
  const supplementId = sup.data?.id; if (supplementId) created.supplements.push(supplementId);
  out.aiRecommendation = { supplementCreate: sup.status, note: 'Generation endpoint reaches OpenAI but account has no credits (429)' };

  // 9. Human Review — approve workflow transition
  const rev = supplementId ? await j('PUT', `${API}/supplements/${supplementId}/status`, { ...auth, body: { status: 'ready_for_review' } }) : null;
  out.humanReview = { transition: rev?.status };

  // 10. Package Export — no export endpoint; diagnostics export is the only export
  const exp = await j('GET', `${API}/intelligence/diagnostics/export`, auth);
  out.packageExport = { status: 'PARTIAL', note: 'No claim/supplement package export endpoint; only /intelligence/diagnostics/export', diagnosticsExport: exp.status };

  // 11. Atlas Voice — orchestrator fallback exercised
  const q = await j('POST', `${API}/intelligence/query`, { ...auth, body: { question: 'Summarize today activity' } });
  out.atlasVoice = { orchestratorFallback: q.status, note: 'STT/TTS are browser Web Speech API in AskAtlas.tsx (manual step)' };

  out.elapsedMs = Date.now() - t0;
  out.summary = {
    complete: out.claim.status === 201 && out.document.create === 201 && out.interview.complete === 200 && out.evidenceGraph.create === 200 && out.decisionEngine.insights === 200,
    partial: ['photo', 'compliance', 'packageExport', 'aiRecommendation'].filter(k => String(out[k].status).includes('NOT_IMPLEMENTED') || String(out[k].status).includes('PARTIAL')),
  };
} catch (e) {
  out.fatal = e.message;
} finally {
  await cleanup().catch(() => {});
  if (testUser) await testUser.cleanup();
  console.log(JSON.stringify(out, null, 2));
}
