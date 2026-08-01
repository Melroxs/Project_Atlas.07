// Integration tests for the Atlas Multi-Entry Claim Workflow against the live API.
// Entry points: supplement-only, import, workspace state, AI task readiness.
// Requires: API running on :3001, migration 003 applied, DATABASE_URL reachable.
import { loadEnv, j, createTestUser, login, COMPANY_ID } from './lib/atlas-validate.mjs';

const env = loadEnv();
const API = 'http://localhost:3001/api/v1';
const SB = env.SUPABASE_URL.replace(/\/$/, '');
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SVC, Authorization: `Bearer ${SVC}` };
const out = {};
const created = { claims: [], documents: [], supplements: [] };
const del = (t, id) => j('DELETE', `${SB}/rest/v1/${t}?id=eq.${id}`, { headers: H });

let testUser = null;
try {
  testUser = await createTestUser(env, 'yc-multi');
  const token = await login(env, testUser.email, testUser.password);
  if (!token) throw new Error('Login failed');
  const auth = { token };
  const t0 = Date.now();
  const stamp = Date.now();

  // ---- Entry Point 3: Supplement-Only (no customer intake, no claim package) ----
  const so = await j('POST', `${API}/multi-entry/supplement-only`, {
    ...auth,
    body: {
      claimNumber: `SUP-${stamp}`,
      carrier: 'State Farm',
      policyNumber: 'SF-9921',
      carrierEstimateAmount: 4800,
      contractorEstimateAmount: 12150,
      lineItems: [{ id: 'x', description: 'Roof replacement', amount: 12150 }],
      photos: [{ url: `https://example.com/p-${stamp}.jpg`, fileName: `p-${stamp}.jpg`, mimeType: 'image/jpeg' }],
      documents: [{ url: `https://example.com/carrier-${stamp}.pdf`, fileName: `carrier-estimate-${stamp}.pdf`, mimeType: 'application/pdf' }],
    },
  });
  out.supplementOnly = {};
  out.supplementOnly.create = so.status;
  out.supplementOnly.claimId = !!so.data?.claim?.id;
  out.supplementOnly.supplementId = !!so.data?.supplement?.id;
  out.supplementOnly.entryPoint = so.data?.claim?.entryPoint;
  out.supplementOnly.supplementNumber = so.data?.supplement?.supplementNumber;
  if (so.data?.claim?.id) created.claims.push(so.data.claim.id);
  if (so.data?.supplement?.id) created.supplements.push(so.data.supplement.id);

  // ---- Workspace for the supplement-only claim: no customer/property pending ----
  const soId = so.data?.claim?.id;
  let ws = null;
  if (soId) {
    ws = await j('GET', `${API}/multi-entry/workspace/${soId}`, auth);
  }
  out.workspaceSupplementOnly = {};
  out.workspaceSupplementOnly.status = ws?.status;
  out.workspaceSupplementOnly.entryPoint = ws?.data?.entryPoint;
  const soSections = ws?.data?.sections || [];
  out.workspaceSupplementOnly.pendingSections = soSections.filter((s) => s.state === 'pending').map((s) => s.id);
  out.workspaceSupplementOnly.customerPending = out.workspaceSupplementOnly.pendingSections.includes('customer');
  out.workspaceSupplementOnly.propertyPending = out.workspaceSupplementOnly.pendingSections.includes('property');
  const soPkg = soSections.find((s) => s.id === 'claim_package');
  out.workspaceSupplementOnly.claimPackageOptional = soPkg?.state === 'optional';
  out.workspaceSupplementOnly.claimPackageMessage = soPkg?.message || null;
  out.workspaceSupplementOnly.supplementsReady = !!soSections.find((s) => s.id === 'supplements' && s.state === 'ready');

  // ---- AI task check: supplement ready (claim present) WITHOUT claim package ----
  const taskCheck = await j('POST', `${API}/multi-entry/ai-tasks/generate_supplement/check`, {
    ...auth, body: { claimId: soId },
  });
  out.aiTask = {};
  out.aiTask.supplementCheck = taskCheck.status;
  out.aiTask.supplementReady = taskCheck.data?.ready === true;
  out.aiTask.supplementBlocksOnClaimPackage = !!(taskCheck.data?.missingRequired || []).some((m) => m.key === 'claimPackage');

  // ---- Entry Point 4: Import Existing Project (full reconstruction) ----
  const imp = await j('POST', `${API}/multi-entry/import`, {
    ...auth,
    body: {
      claimNumber: `IMP-${stamp}`,
      carrier: 'Travelers',
      sourceSystem: 'XactAnalysis',
      dateOfLoss: '2026-06-01',
      customer: { name: 'Imported Customer', email: `imp-${stamp}@atlas.local`, phone: '555-0100' },
      property: { address: '1200 Maple Ave', city: 'Austin', state: 'TX', zip: '78701', ownerName: 'Imported Customer' },
      documents: [{ url: `https://example.com/policy-${stamp}.pdf`, fileName: `policy-${stamp}.pdf`, mimeType: 'application/pdf' }],
      estimates: [
        { carrierEstimateAmount: 6200, contractorEstimateAmount: 15800, lineItems: [{ id: 'a', description: 'Interior', amount: 15800 }] },
      ],
    },
  });
  out.import = {};
  out.import.create = imp.status;
  out.import.claimId = !!imp.data?.claim?.id;
  out.import.entryPoint = imp.data?.claim?.entryPoint;
  out.import.sourceSystem = imp.data?.claim?.sourceSystem;
  out.import.propertyCreated = !!imp.data?.propertyId;
  out.import.supplementCount = imp.data?.supplements?.length ?? 0;
  out.import.documentsAttached = imp.data?.documentsAttached;
  if (imp.data?.claim?.id) created.claims.push(imp.data.claim.id);

  // ---- Workspace for the imported claim: sections light up, no pending customer/property ----
  let wsImp = null;
  if (imp.data?.claim?.id) {
    wsImp = await j('GET', `${API}/multi-entry/workspace/${imp.data.claim.id}`, auth);
  }
  out.workspaceImport = {};
  out.workspaceImport.status = wsImp?.status;
  out.workspaceImport.entryPoint = wsImp?.data?.entryPoint;
  const impSections = wsImp?.data?.sections || [];
  out.workspaceImport.readySections = impSections.filter((s) => s.state === 'ready').map((s) => s.id);
  out.workspaceImport.pendingSections = impSections.filter((s) => s.state === 'pending').map((s) => s.id);
  out.workspaceImport.customerPending = out.workspaceImport.pendingSections.includes('customer');
  out.workspaceImport.supplementsReady = !!impSections.find((s) => s.id === 'supplements' && s.state === 'ready');

  // ---- Validation errors return 400 (not 500) ----
  const bad = await j('POST', `${API}/multi-entry/supplement-only`, { ...auth, body: { carrierEstimateAmount: 'not-a-number' } });
  out.validation = {};
  out.validation.invalidBody = bad.status; // expect 400

  // ---- Unknown AI task returns 400 ----
  const badTask = await j('POST', `${API}/multi-entry/ai-tasks/not_a_task/check`, { ...auth, body: { claimId: soId } });
  out.validation.unknownTask = badTask.status; // expect 400

  // ---- Missing claim returns 404 ----
  const missing = await j('POST', `${API}/multi-entry/ai-tasks/generate_supplement/check`, {
    ...auth, body: { claimId: crypto.randomUUID() },
  });
  out.validation.missingClaim = missing.status; // expect 404

  out.elapsedMs = Date.now() - t0;
  out.summary = {
    supplementOnlyCreated: out.supplementOnly.create === 201,
    noClaimPackageBlock: out.aiTask.supplementReady === true && out.aiTask.supplementBlocksOnClaimPackage === false,
    importReconstructed: out.import.create === 201 && out.import.entryPoint === 'imported' && out.import.propertyCreated,
    dynamicWorkspace: out.workspaceSupplementOnly.claimPackageOptional === true,
    zeroBlockingOptionalWarnings:
      !out.workspaceSupplementOnly.customerPending && !out.workspaceSupplementOnly.propertyPending &&
      !out.workspaceImport.customerPending,
    errorHandling: out.validation.invalidBody === 400 && out.validation.unknownTask === 400 && out.validation.missingClaim === 404,
  };
} catch (e) {
  out.fatal = e.message;
} finally {
  // Best-effort cleanup via direct Supabase REST (the established pattern in
  // validate-journey.mjs): attachment documents are never returned by the
  // create endpoints, so we clean them up by claim-scoped FK deletes.
  for (const id of created.documents) await del('documents', id).catch(() => {});
  for (const id of created.supplements) await del('supplements', id).catch(() => {});
  for (const id of created.claims) await del('claims', id).catch(() => {});
  if (testUser) await testUser.cleanup();
  console.log(JSON.stringify(out, null, 2));
}
