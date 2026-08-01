// Integration tests for the Atlas AI Claim Intelligence Layer against the live API.
// Requires: API running on :3001, migration 004 applied.
import { loadEnv, j, createTestUser, login, COMPANY_ID } from './lib/atlas-validate.mjs';

const env = loadEnv();
const API = 'http://localhost:3001/api/v1';
const out = {};
const created = { claims: [], documents: [], supplements: [] };

let testUser = null;
try {
  testUser = await createTestUser(env, 'yc-intel');
  const token = await login(env, testUser.email, testUser.password);
  if (!token) throw new Error('Login failed');
  const auth = { token };
  const t0 = Date.now();
  const stamp = Date.now();

  // ---- Seed a claim with evidence ----
  const cl = await j('POST', `${API}/claims`, {
    ...auth,
    body: {
      claimNumber: `INT-${stamp}`,
      status: 'new',
      insuranceCompany: 'Progressive',
      policyNumber: 'PG-5566',
      estimatedValue: 24500,
      customerName: 'Intel Customer',
      description: 'Hail damage to roof',
      companyId: COMPANY_ID,
    },
  });
  const claimId = cl.data?.id;
  if (claimId) created.claims.push(claimId);
  out.seed = { claimCreate: cl.status, claimId: !!claimId };

  if (claimId) {
    const doc = await j('POST', `${API}/documents`, {
      ...auth,
      body: {
        claimId,
        url: `https://example.com/int-${stamp}.pdf`,
        fileName: `carrier-estimate-${stamp}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 4096,
        companyId: COMPANY_ID,
      },
    });
    if (doc.data?.id) created.documents.push(doc.data.id);
    out.seed.docCreate = doc.status;

    const photo = await j('POST', `${API}/documents`, {
      ...auth,
      body: {
        claimId,
        url: `https://example.com/photo-${stamp}.jpg`,
        fileName: `roof-${stamp}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 2048,
        companyId: COMPANY_ID,
      },
    });
    if (photo.data?.id) created.documents.push(photo.data.id);
    out.seed.photoCreate = photo.status;

    const sup = await j('POST', `${API}/supplements`, {
      ...auth,
      body: {
        claimId,
        supplementNumber: `SUP-INT-${stamp}`,
        status: 'submitted',
        carrier: 'Progressive',
        requestedAmount: 18400,
        approvedAmount: 6200,
        companyId: COMPANY_ID,
      },
    });
    if (sup.data?.id) created.supplements.push(sup.data.id);
    out.seed.supplementCreate = sup.status;

    // Note = communication → emits communication.added → the '*' subscriber
    // auto re-analyzes and persists a snapshot (continuous analysis, no manual
    // refresh). We assert history is already populated BEFORE the explicit
    // POST /analyze below to prove the event-driven flow works end-to-end.
    const note = await j('POST', `${API}/notes`, {
      ...auth,
      body: { entityType: 'claim', entityId: claimId, content: `Adjuster Sam called about claim ${cl.data.claimNumber}. Policy #PG-5566. Please send the engineering report by Dec 20.` },
    });
    out.seed.noteCreate = note.status;

    // Event-driven persistence check: the note's communication.added event must
    // already have produced a snapshot before any manual analyze trigger.
    const historyBefore = await j('GET', `${API}/intelligence/claims/${claimId}/history`, auth);
    out.seed.eventDrivenSnapshot = (historyBefore.data?.snapshots || []).length > 0;
  }

  // ---- Claim Intelligence Summary (read-only, dynamic) ----
  const summary = await j('GET', `${API}/intelligence/claims/${claimId}/summary`, auth);
  out.summary = {
    status: summary.status,
    hasHealth: !!summary.data?.health && typeof summary.data.health.score === 'number',
    hasRecovery: !!summary.data?.recoveryReadiness && typeof summary.data.recoveryReadiness.score === 'number',
    factorCount: summary.data?.recoveryReadiness?.factors?.length ?? 0,
    hasActions: Array.isArray(summary.data?.nextBestActions),
    hasRisks: Array.isArray(summary.data?.openRisks),
    hasMissing: Array.isArray(summary.data?.missingInformation),
    hasKG: summary.data?.knowledgeGraph && Array.isArray(summary.data.knowledgeGraph.nodes),
    evidenceCompleteness: summary.data?.evidenceCompleteness,
    complianceStatus: summary.data?.complianceStatus,
    policyAnalysisStatus: summary.data?.policyAnalysisStatus,
    aiConfidence: summary.data?.aiConfidence,
  };

  // ---- Recovery Readiness ----
  const rr = await j('GET', `${API}/intelligence/claims/${claimId}/recovery-readiness`, auth);
  out.recovery = {
    status: rr.status,
    score: rr.data?.score,
    level: rr.data?.level,
    factors: rr.data?.factors?.length,
    weightsSum: rr.data?.factors?.reduce((s, f) => s + f.weight, 0),
  };

  // ---- Health (alerts) ----
  const health = await j('GET', `${API}/intelligence/claims/${claimId}/health`, auth);
  out.health = {
    status: health.status,
    healthScore: health.data?.health?.score,
    risks: health.data?.openRisks?.length,
    riskTitles: (health.data?.openRisks || []).map((r) => r.title).slice(0, 3),
    missing: health.data?.missingInformation?.length,
  };

  // ---- Next Best Actions ----
  const nba = await j('GET', `${API}/intelligence/claims/${claimId}/next-best-actions`, auth);
  out.nba = {
    status: nba.status,
    actionCount: nba.data?.actions?.length,
    actions: (nba.data?.actions || []).map((a) => ({ title: a.title, priority: a.priority, confidence: a.confidence })),
  };

  // ---- Explainable AI: fetch the explanation for the first action ----
  const firstAction = nba.data?.actions?.[0];
  let explain = null;
  if (firstAction?.id) {
    explain = await j('GET', `${API}/intelligence/claims/${claimId}/explain/${firstAction.id}`, auth);
  }
  out.explain = {
    status: explain?.status,
    hasWhy: !!explain?.data?.why,
    hasDocs: Array.isArray(explain?.data?.documentsUsed),
    hasPhotos: Array.isArray(explain?.data?.photosReferenced),
    hasPolicy: Array.isArray(explain?.data?.policySectionsReferenced),
  };

  // ---- Knowledge Graph ----
  const kg = await j('GET', `${API}/intelligence/claims/${claimId}/knowledge-graph`, auth);
  out.kg = {
    status: kg.status,
    nodes: kg.data?.nodes?.length,
    edges: kg.data?.edges?.length,
    nodeTypes: [...new Set((kg.data?.nodes || []).map((n) => n.type))],
    hasClaimNode: (kg.data?.nodes || []).some((n) => n.type === 'claim'),
    hasCarrierNode: (kg.data?.nodes || []).some((n) => n.type === 'carrier'),
  };

  // ---- Communications Intelligence ----
  const comms = await j('GET', `${API}/intelligence/claims/${claimId}/communications`, auth);
  out.comms = {
    status: comms.status,
    extracted: (comms.data?.extracted || []).map((e) => `${e.entityType}:${e.value}`).slice(0, 8),
    hasPolicyNumber: (comms.data?.extracted || []).some((e) => e.entityType === 'policy_number'),
    hasRequestedDoc: (comms.data?.extracted || []).some((e) => e.entityType === 'requested_document'),
  };

  // ---- Analyze trigger (persists snapshot + emits event) ----
  const analyze = await j('POST', `${API}/intelligence/claims/${claimId}/analyze`, auth);
  out.analyze = { status: analyze.status, success: analyze.data?.success === true };

  // ---- History (snapshot persisted by the analyze trigger) ----
  const history = await j('GET', `${API}/intelligence/claims/${claimId}/history`, auth);
  out.history = {
    status: history.status,
    count: history.data?.count,
    hasSnapshot: (history.data?.snapshots || []).length > 0,
  };

  // ---- Carrier Intelligence (foundation) ----
  const carrier = await j('GET', `${API}/intelligence/carrier?carrier=Progressive`, auth);
  out.carrier = {
    status: carrier.status,
    count: carrier.data?.carriers?.length,
    hasPreferredDocs: Array.isArray(carrier.data?.carriers?.[0]?.preferredDocumentation),
  };

  // ---- Error handling: 404 on unknown claim ----
  const missing = await j('GET', `${API}/intelligence/claims/${crypto.randomUUID()}/summary`, auth);
  out.errorHandling = { missingClaim404: missing.status === 404 };

  out.elapsedMs = Date.now() - t0;
  out.summaryFlags = {
    dynamicSummary: out.summary.status === 200 && out.summary.hasHealth && out.summary.hasRecovery && out.summary.factorCount === 6,
    weightsSum100: out.recovery.weightsSum === 100,
    explainable: out.explain.hasWhy && out.explain.hasDocs,
    knowledgeGraph: out.kg.hasClaimNode && out.kg.nodes > 0,
    communications: out.comms.hasPolicyNumber && out.comms.hasRequestedDoc,
    eventDriven: out.seed.eventDrivenSnapshot === true,
    analyzePersists: out.analyze.success === true && out.history.hasSnapshot,
    carrierFoundation: out.carrier.count >= 1 && out.carrier.hasPreferredDocs,
    errorHandling: out.errorHandling.missingClaim404,
  };
} catch (e) {
  out.fatal = e.message;
} finally {
  // Best-effort cleanup via Supabase REST (established pattern)
  const SB = env.SUPABASE_URL.replace(/\/$/, '');
  const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
  const H = { apikey: SVC, Authorization: `Bearer ${SVC}` };
  const del = (t, id) => j('DELETE', `${SB}/rest/v1/${t}?id=eq.${id}`, { headers: H });
  // Best-effort cleanup: notes have no FK cascade (entity_id is a plain uuid),
  // and carrier_intelligence has no claim_id column — delete them directly.
  for (const id of created.supplements) await del('supplements', id).catch(() => {});
  for (const id of created.documents) await del('documents', id).catch(() => {});
  for (const id of created.claims) await del('claims', id).catch(() => {});
  try { await j('DELETE', `${SB}/rest/v1/notes?entity_type=eq.claim&entity_id=in.(${created.claims.join(',')})`, { headers: H }); } catch {}
  try { await j('DELETE', `${SB}/rest/v1/carrier_intelligence?carrier=eq.Progressive&company_id=eq.${COMPANY_ID}`, { headers: H }); } catch {}
  if (testUser) await testUser.cleanup();
  console.log(JSON.stringify(out, null, 2));
}
