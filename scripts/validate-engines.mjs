// Live validation of Phase 3-7 engines against the running API.
// Evidence graph, decision engine, AI supplements, demo mode, health, voice.
import { loadEnv, j, createTestUser, login, COMPANY_ID } from './lib/atlas-validate.mjs';

const env = loadEnv();
const API = 'http://localhost:3001/api/v1';
const out = {};

let testUser = null;
try {
  testUser = await createTestUser(env, 'yc-engine');
  const token = await login(env, testUser.email, testUser.password);
  if (!token) throw new Error('Login failed');
  const auth = { token };

  // ---- Decision engine (intelligence) ----
  out.intelligence = {};
  out.intelligence.insights = (await j('GET', `${API}/intelligence/insights`, auth)).status;
  out.intelligence.recommendations = (await j('GET', `${API}/intelligence/recommendations`, auth)).status;
  out.intelligence.learningStats = (await j('GET', `${API}/intelligence/learning/statistics`, auth)).status;
  const q = await j('POST', `${API}/intelligence/query`, { ...auth, body: { question: 'Summarize today activity' } });
  out.intelligence.query = q.status;
  out.intelligence.queryHasAnswer = !!q.data?.answer;

  // ---- System health ----
  out.health = {};
  out.health.status = (await j('GET', `${API}/intelligence/health`, auth)).status;
  out.health.diagnostics = (await j('GET', `${API}/intelligence/diagnostics`, auth)).status;
  out.health.export = (await j('GET', `${API}/intelligence/diagnostics/export`, auth)).status;

  // ---- Evidence graph ----
  // Create a claim + document, then link them as evidence for a recommendation.
  const cl = await j('POST', `${API}/claims`, { ...auth, body: { claimNumber: `EV-${Date.now()}`, status: 'new', insuranceCompany: 'Test Ins', customerName: 'Ev Customer', companyId: COMPANY_ID } });
  const claimId = cl.data?.id;
  const doc = await j('POST', `${API}/documents`, { ...auth, body: { claimId, url: `https://example.com/ev-${Date.now()}.pdf`, fileName: `ev-${Date.now()}.pdf`, mimeType: 'application/pdf', sizeBytes: 999, companyId: COMPANY_ID } });
  const documentId = doc.data?.id;
  const recommendationId = crypto.randomUUID();
  const link = await j('POST', `${API}/evidence-links`, { ...auth, body: { recommendationId, documentId, relevance: 'high', description: 'Evidence link validation', strengthScore: 0.95 } });
  out.evidence = {};
  out.evidence.create = link.status;
  out.evidence.get = link.data?.id ? (await j('GET', `${API}/evidence-links/${recommendationId}`, auth)).status : null;
  out.evidence.linkHasEvidence = !!(link.data?.id);
  out.evidence.claimCreate = cl.status;
  out.evidence.docCreate = doc.status;

  // ---- AI supplements pipeline (needs OpenAI key) ----
  const sup = await j('POST', `${API}/supplements`, { ...auth, body: { claimId, supplementNumber: `SUP-${Date.now()}`, status: 'draft', companyId: COMPANY_ID } });
  out.aiSupplements = {};
  out.aiSupplements.supplementCreate = sup.status;
  if (sup.data?.id) {
    const gen = await j('POST', `${API}/ai-supplements/generate`, { ...auth, body: { supplementId: sup.data.id } });
    out.aiSupplements.generate = gen.status;
    out.aiSupplements.generateError = gen.data?.error || null;
    out.aiSupplements.hasDraft = !!gen.data?.draft;
    const drafts = await j('GET', `${API}/ai-supplements/${sup.data.id}/drafts`, auth);
    out.aiSupplements.drafts = drafts.status;
  }

  // ---- Demo mode ----
  out.demo = {};
  out.demo.statusBefore = (await j('GET', `${API}/demo/status`, auth)).status;
  const gen = await j('POST', `${API}/demo/generate`, auth);
  out.demo.generate = gen.status;
  out.demo.hasPersonas = !!gen.data?.data?.personas;
  out.demo.personaCount = gen.data?.data?.personas?.length ?? 0;
  out.demo.statusAfter = (await j('GET', `${API}/demo/status`, auth)).status;
  out.demo.metrics = (await j('GET', `${API}/demo/metrics`, auth)).status;
  out.demo.walkthroughs = (await j('GET', `${API}/demo/walkthroughs`, auth)).status;

  // ---- Voice readiness (orchestrator fallback = /intelligence/query; STT/TTS are browser-native) ----
  out.voice = {};
  out.voice.orchestratorFallback = out.intelligence.query; // AskAtlas routes unhandled questions here
  out.voice.speechRecognition = 'browser Web Speech API (SpeechRecognition) in AskAtlas.tsx';
  out.voice.speechSynthesis = 'browser speechSynthesis TTS in AskAtlas.tsx';
} catch (e) {
  out.fatal = e.message;
} finally {
  if (testUser) await testUser.cleanup();
  console.log(JSON.stringify(out, null, 2));
}
