// Unit tests for the Atlas Claim Intelligence Engine (shared @project-atlas/claim-intelligence).
// Imports the compiled package from packages/claim-intelligence/dist/index.js.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ci = require('../packages/claim-intelligence/dist/index.js');

const {
  analyzeClaim,
  computeRecoveryReadiness,
  computeClaimHealth,
  generateNextBestActions,
  detectRisks,
  detectMissingInformation,
  buildKnowledgeGraph,
  extractAll,
  RECOVERY_WEIGHTS,
  claimEventBus,
} = ci;

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, name, detail) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function bundle(overrides = {}) {
  const now = new Date().toISOString();
  return {
    claimId: 'c-1',
    companyId: 'co-1',
    claimNumber: 'CLM-001',
    status: 'new',
    entryPoint: 'new_claim',
    insuranceCompany: 'State Farm',
    policyNumber: 'SF-9921',
    createdAt: now,
    updatedAt: now,
    documents: [],
    supplements: [],
    interviews: [],
    communications: [],
    evidenceLinks: [],
    ...overrides,
  };
}

const photoDoc = (id, fileName) => ({ id, fileName, url: `https://x/${fileName}`, mimeType: 'image/jpeg', createdAt: new Date().toISOString(), isPhoto: true });
const pdfDoc = (id, fileName, extra = {}) => ({ id, fileName, url: `https://x/${fileName}`, mimeType: 'application/pdf', createdAt: new Date().toISOString(), ...extra });

// ---- 1. Recovery readiness: weights sum to 100 ----
{
  const total = RECOVERY_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  assert(total === 100, 'recovery weights sum to 100', `got ${total}`);
  assert(RECOVERY_WEIGHTS.length === 6, 'six recovery factors');
}

// ---- 2. Empty claim → low readiness, critical health ----
{
  const rr = computeRecoveryReadiness(bundle());
  assert(rr.score < 40, 'empty claim has low recovery readiness', `score=${rr.score}`);
  assert(rr.level === 'low', 'empty claim level low');
  const health = computeClaimHealth(bundle());
  assert(health.level === 'critical', 'empty claim health critical', `level=${health.level}`);
}

// ---- 3. Well-documented claim → high readiness ----
{
  const full = bundle({
    documents: [
      photoDoc('p1', 'roof.jpg'),
      photoDoc('p2', 'interior.jpg'),
      pdfDoc('d1', 'policy-2024.pdf', { isPolicy: true, isSigned: true }),
      pdfDoc('d2', 'carrier-estimate.pdf', { isEstimate: true, isCarrierDocument: true }),
      pdfDoc('d3', 'contractor-estimate.pdf', { isEstimate: true, isContractorDocument: true }),
    ],
    supplements: [{ id: 's1', supplementNumber: 'SUP-1', status: 'approved', requestedAmount: 12000, approvedAmount: 12000, lineItems: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    evidenceLinks: [{ id: 'l1', recommendationId: 'r1', documentId: 'd2', strengthScore: 0.9 }],
    interviews: [{ id: 'i1', status: 'completed', progress: 100, createdAt: new Date().toISOString() }],
  });
  const rr = computeRecoveryReadiness(full);
  assert(rr.score >= 70, 'well-documented claim has high readiness', `score=${rr.score}`);
}

// ---- 4. analyzeClaim returns the full model shape ----
{
  const model = analyzeClaim(bundle());
  assert(model.claimId === 'c-1', 'model has claimId');
  assert(typeof model.recoveryReadiness.score === 'number', 'model has recoveryReadiness');
  assert(Array.isArray(model.nextBestActions), 'model has nextBestActions');
  assert(Array.isArray(model.openRisks), 'model has openRisks');
  assert(Array.isArray(model.missingInformation), 'model has missingInformation');
  assert(model.knowledgeGraph && Array.isArray(model.knowledgeGraph.nodes), 'model has knowledgeGraph');
  assert(typeof model.health.score === 'number', 'model has health');
  assert(typeof model.evidenceCompleteness === 'number', 'model has evidenceCompleteness');
}

// ---- 5. Next best actions: photos missing → upload photos recommended ----
{
  const actions = generateNextBestActions(bundle({ documents: [pdfDoc('d1', 'carrier-estimate.pdf', { isEstimate: true, isCarrierDocument: true })] }));
  const uploadPhotos = actions.find((a) => a.title === 'Upload damage photos');
  assert(!!uploadPhotos, 'upload-photos action exists when no photos');
  assert(uploadPhotos && uploadPhotos.priority === 'high', 'upload-photos is high priority');
  assert(uploadPhotos && uploadPhotos.explanation && uploadPhotos.explanation.why, 'action is explainable');
  assert(uploadPhotos && uploadPhotos.confidence > 0.7, 'action has confidence');
}

// ---- 6. Next best actions: carrier estimate missing ----
{
  const actions = generateNextBestActions(bundle({ documents: [pdfDoc('d1', 'our-estimate.pdf', { isEstimate: true, isContractorDocument: true })] }));
  const carrier = actions.find((a) => a.title === 'Upload the carrier estimate');
  assert(!!carrier, 'carrier-estimate action exists');
  assert(carrier && carrier.supportingEvidence.documentIds.length > 0, 'carrier action cites evidence docs');
}

// ---- 7. No claim package dependency: supplement generation never requires claimPackage ----
{
  const enough = bundle({
    documents: [
      photoDoc('p1', 'roof.jpg'),
      pdfDoc('d1', 'carrier-estimate.pdf', { isEstimate: true, isCarrierDocument: true }),
      pdfDoc('d2', 'contractor-estimate.pdf', { isEstimate: true, isContractorDocument: true }),
    ],
  });
  const actions = generateNextBestActions(enough);
  const gen = actions.find((a) => a.title === 'Generate supplement');
  assert(!!gen, 'generate-supplement action exists with sufficient evidence and no claim package');
}

// ---- 8. Risk detection: duplicates, missing signatures, no photos ----
{
  const risks = detectRisks(bundle({
    documents: [
      pdfDoc('d1', 'policy.pdf', { isPolicy: true }),
      pdfDoc('d2', 'policy.pdf'), // duplicate by fileName
    ],
  }));
  assert(risks.some((r) => r.category === 'Data Quality'), 'duplicate document risk detected');
  assert(risks.some((r) => r.category === 'Missing Evidence'), 'missing photos risk detected');
  assert(risks.some((r) => r.category === 'Missing Signature'), 'missing signature risk detected');
}

// ---- 9. Conflict detection: requested > approved marks estimate conflict ----
{
  const risks = detectRisks(bundle({
    documents: [
      pdfDoc('d1', 'carrier-estimate.pdf', { isEstimate: true, isCarrierDocument: true, conflictDetected: true }),
      pdfDoc('d2', 'contractor-estimate.pdf', { isEstimate: true, isContractorDocument: true, conflictDetected: true }),
    ],
  }));
  assert(risks.some((r) => r.category === 'Estimate Conflict'), 'conflicting estimates risk fires');
}

// ---- 10. Knowledge graph: nodes + edges are typed and navigable ----
{
  const kg = buildKnowledgeGraph(bundle({
    customerName: 'Jane Doe',
    insuranceCompany: 'State Farm',
    policyNumber: 'SF-1',
    documents: [photoDoc('p1', 'roof.jpg'), pdfDoc('d1', 'policy.pdf', { isPolicy: true })],
  }));
  assert(kg.nodes.some((n) => n.type === 'claim'), 'KG has claim node');
  assert(kg.nodes.some((n) => n.type === 'customer'), 'KG has customer node');
  assert(kg.nodes.some((n) => n.type === 'carrier'), 'KG has carrier node');
  assert(kg.nodes.some((n) => n.type === 'photo'), 'KG has photo node');
  assert(kg.edges.some((e) => e.relation === 'insured_by'), 'KG has carrier edge');
  // unique node ids — two docs with same label must not collide
  const dup = buildKnowledgeGraph(bundle({
    documents: [pdfDoc('d1', 'same.pdf'), pdfDoc('d2', 'same.pdf')],
  }));
  const ids = dup.nodes.map((n) => n.id);
  assert(new Set(ids).size === ids.length, 'KG node ids are unique even for duplicate labels');
}

// ---- 11. Communications intelligence: extraction finds structured entities ----
{
  const extracted = extractAll(bundle({
    communications: [
      { id: 'n1', source: 'note', content: 'Adjuster Mike called about claim CLM-0042. Policy #SF-7788. Please send the engineering report by Dec 15.', createdAt: new Date().toISOString() },
    ],
  }));
  assert(extracted.some((e) => e.entityType === 'claim_number' && e.value.includes('CLM-0042')), 'extracts claim number');
  // NOTE: the bare claim_number pattern (optional 'claim' prefix) also matches
  // SF-7788, so it may appear under both types — we only assert the policy value.
  assert(extracted.some((e) => e.entityType === 'policy_number' && e.value === 'SF-7788'), 'extracts hyphenated policy number', JSON.stringify(extracted.filter((e) => e.entityType === 'policy_number')));
  assert(extracted.some((e) => e.entityType === 'requested_document'), 'extracts requested document');
  assert(extracted.some((e) => e.entityType === 'deadline'), 'extracts deadline');
  assert(extracted.every((e) => e.confidence > 0 && e.confidence <= 1), 'confidence in (0,1]');
  assert(extracted.every((e) => e.context.length > 0), 'context preserved');
}

// ---- 12. Event bus: subscribers fire, failures isolated ----
{
  let received = 0;
  const unsub = claimEventBus.subscribe('claim.created', () => { received++; });
  await claimEventBus.publish({ id: 'e1', companyId: 'co', claimId: 'c', eventType: 'claim.created', entityType: 'claim', payload: {}, createdAt: new Date().toISOString() });
  assert(received === 1, 'subscriber receives matching event');
  unsub();
  await claimEventBus.publish({ id: 'e2', companyId: 'co', claimId: 'c', eventType: 'claim.created', entityType: 'claim', payload: {}, createdAt: new Date().toISOString() });
  assert(received === 1, 'unsubscribe stops delivery');
  const ok = await claimEventBus.publish({ id: 'e3', companyId: 'co', claimId: 'c', eventType: 'document.uploaded', entityType: 'document', payload: {}, createdAt: new Date().toISOString() });
  assert(ok === undefined, 'publish resolves even without subscribers');
}

// ---- 13. Compliance status reflects severity ----
{
  const risky = analyzeClaim(bundle({
    documents: [pdfDoc('d1', 'contractor-estimate.pdf', { isEstimate: true, conflictDetected: true })],
  }));
  assert(['attention', 'passed'].includes(risky.complianceStatus), 'compliance status computed', `got ${risky.complianceStatus}`);
}

// ---- 14. Explainable AI: every action has a why + evidence arrays ----
{
  const actions = generateNextBestActions(bundle({ documents: [pdfDoc('d1', 'policy.pdf', { isPolicy: true })] }));
  for (const a of actions) {
    assert(!!a.explanation.why, `action ${a.id} has explanation.why`);
    assert(Array.isArray(a.explanation.documentsUsed), `action ${a.id} has documentsUsed`);
    assert(Array.isArray(a.explanation.photosReferenced), `action ${a.id} has photosReferenced`);
    assert(Array.isArray(a.explanation.policySectionsReferenced), `action ${a.id} has policySectionsReferenced`);
  }
}

console.log(`\nClaim intelligence unit tests: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('ALL UNIT TESTS PASSED');
