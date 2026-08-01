// Unit tests for the Atlas Operations Intelligence Engine (Phase 3).
// Imports the compiled package from packages/claim-intelligence/dist/index.js.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ci = require('../packages/claim-intelligence/dist/index.js');

const {
  analyzeOperations,
  getLifecycle,
  determineLifecycleStage,
  computeFinancialIntelligence,
  detectRevenueOpportunities,
  generateOperationalRecommendations,
  runCaseManager,
  buildDigitalTwin,
  analyzePortfolio,
  LIFECYCLE_STAGES,
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
    estimatedValue: 25000,
    approvedValue: null,
    customerName: 'Jane Doe',
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

// ---- 1. Lifecycle: 12 stages, deterministic inference, entry points ----
{
  const t = new Date().toISOString();
  assert(LIFECYCLE_STAGES.length === 12, 'lifecycle has 12 stages', `got ${LIFECYCLE_STAGES.length}`);
  assert(LIFECYCLE_STAGES[0].stage === 'lead', 'starts at lead');
  assert(LIFECYCLE_STAGES[LIFECYCLE_STAGES.length - 1].stage === 'closed', 'ends at closed');

  assert(determineLifecycleStage(bundle()) === 'lead', 'empty claim is lead');
  assert(
    determineLifecycleStage(bundle({ entryPoint: 'supplement_only', documents: [pdfDoc('d1', 'contractor-estimate.pdf', { isEstimate: true })] })) === 'supplement_preparation',
    'supplement_only entry with estimate → supplement_preparation'
  );
  assert(
    determineLifecycleStage(bundle({ entryPoint: 'existing_claim', documents: [pdfDoc('d1', 'carrier-estimate.pdf', { isEstimate: true, isCarrierDocument: true })] })) === 'carrier_review',
    'existing_claim entry with carrier estimate → carrier_review'
  );
  assert(
    determineLifecycleStage(bundle({ status: 'approved' })) === 'approved',
    'approved status → approved'
  );
  assert(
    determineLifecycleStage(bundle({ status: 'closed', supplements: [{ id: 's1', supplementNumber: 'SUP-1', status: 'approved', requestedAmount: 100, approvedAmount: 100, createdAt: t, updatedAt: t }] })) === 'closed',
    'closed claim never regresses to final_payment even with approved supplements'
  );
  assert(
    determineLifecycleStage(bundle({ status: 'completed' })) === 'final_payment',
    'completed status → final_payment'
  );
  assert(
    determineLifecycleStage(bundle({
      status: 'new',
      supplements: [{ id: 's1', supplementNumber: 'SUP-1', status: 'submitted', requestedAmount: 100, createdAt: t, updatedAt: t }],
    })) === 'supplement_submitted',
    'submitted supplement → supplement_submitted'
  );
}

// ---- 2. Lifecycle info: progress, next stage, missing requirements ----
{
  const li = getLifecycle(bundle());
  assert(li.currentStage === 'lead', 'lifecycle current stage');
  assert(li.progressPct >= 0 && li.progressPct <= 100, 'lifecycle progress pct bounded', `got ${li.progressPct}`);
  assert(li.nextStage === 'inspection_scheduled', 'next stage after lead');
  assert(Array.isArray(li.stages) && li.stages.length === 12, 'stages array populated');
  assert(li.recommendedActions.length > 0, 'recommended actions present');
  const reachedCount = li.stages.filter((s) => s.reached).length;
  assert(reachedCount === li.currentIndex + 1, 'reached stages match current index');
}

// ---- 3. Financial: figures derived from real data, never fabricated ----
{
  const f = computeFinancialIntelligence(bundle());
  assert(f.originalEstimate === 25000, 'original estimate from claim', `got ${f.originalEstimate}`);
  assert(f.carrierApprovedAmount === null, 'carrier approved null when not provided');
  assert(f.supplementValue === 0, 'supplement value zero with no supplements');
  assert(f.estimatedRecoveryOpportunity === null, 'opportunity null when insufficient data');
  assert(f.figures.length >= 8, 'explainable figures present', `got ${f.figures.length}`);
  for (const fig of f.figures) {
    assert(typeof fig.source === 'string' && fig.source.length > 0, `figure ${fig.key} has source`);
    assert(fig.confidence >= 0 && fig.confidence <= 1, `figure ${fig.key} confidence in range`);
  }
}

// ---- 4. Financial: recovered + outstanding from supplements ----
{
  const f = computeFinancialIntelligence(bundle({
    supplements: [
      { id: 's1', supplementNumber: 'SUP-1', status: 'approved', requestedAmount: 5000, approvedAmount: 4000, lineItems: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ],
  }));
  assert(f.supplementValue === 5000, 'supplement value sums requested');
  assert(f.recoveredRevenue === 4000, 'recovered revenue sums approved');
  assert(f.outstandingRevenue === 1000, 'outstanding = requested − approved');
}

// ---- 5. Revenue opportunities: pricing discrepancy detected ----
{
  const opps = detectRevenueOpportunities(bundle({
    supplements: [
      { id: 's1', supplementNumber: 'SUP-1', status: 'approved', requestedAmount: 10000, approvedAmount: 7000, lineItems: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ],
    documents: [pdfDoc('d1', 'carrier-estimate.pdf', { isEstimate: true, isCarrierDocument: true })],
  }));
  const gap = opps.find((o) => o.type === 'pricing_discrepancy');
  assert(!!gap, 'pricing discrepancy opportunity detected');
  assert(gap && gap.estimatedValue === 3000, 'gap value correct', `got ${gap && gap.estimatedValue}`);
  for (const o of opps) {
    assert(typeof o.explanation.why === 'string' && o.explanation.why.length > 0, `opportunity ${o.type} explainable`);
    assert(Array.isArray(o.evidence), `opportunity ${o.type} has evidence`);
  }
}

// ---- 6. Operational recommendations: escalate overdue + follow up ----
{
  const past = new Date(Date.now() - 30 * 86400000).toISOString();
  const b = bundle({
    documents: [pdfDoc('d1', 'contractor-estimate.pdf', { isEstimate: true })],
    supplements: [
      { id: 's1', supplementNumber: 'SUP-1', status: 'submitted', requestedAmount: 5000, approvedAmount: null, lineItems: [], submissionDate: past, createdAt: past, updatedAt: past },
    ],
  });
  const model = ci.analyzeClaim(b);
  const recs = generateOperationalRecommendations(b, model);
  const escalate = recs.find((r) => r.title === 'Escalate overdue claim');
  assert(!!escalate, 'escalate overdue recommendation fires', JSON.stringify(recs.map((r) => r.title)));
  assert(escalate && escalate.priority === 'critical', 'escalation is critical priority');
  assert(escalate && escalate.estimatedBusinessImpact.length > 0, 'escalation has business impact');
  assert(escalate && escalate.requiredUserAction.length > 0, 'escalation has required action');
}

// ---- 7. Case manager: stalled detection + deadlines ----
{
  const past = new Date(Date.now() - 20 * 86400000).toISOString();
  const b = bundle({ updatedAt: past });
  const model = ci.analyzeClaim(b);
  const li = getLifecycle(b);
  const cm = runCaseManager(b, model, li);
  assert(cm.isStalled === true, 'claim stalled after 20 days with no activity', `daysSinceLastUpdate=${cm.daysSinceLastUpdate}`);
  assert(cm.stalledReason && cm.stalledReason.length > 0, 'stalled reason present');
  assert(['on_track', 'attention', 'stalled', 'blocked'].includes(cm.overallStatus), 'overall status valid', `got ${cm.overallStatus}`);
  assert(cm.priorityScore >= 0 && cm.priorityScore <= 100, 'priority score bounded');
  assert(cm.aiSummary.length > 0, 'AI summary generated');
}

// ---- 8. Case manager: not stalled with recent activity + deadlines from supplements ----
{
  const b = bundle({
    supplements: [
      { id: 's1', supplementNumber: 'SUP-1', status: 'submitted', requestedAmount: 1000, approvedAmount: null, lineItems: [], submissionDate: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ],
  });
  const model = ci.analyzeClaim(b);
  const li = getLifecycle(b);
  const cm = runCaseManager(b, model, li);
  assert(cm.isStalled === false, 'recently active claim not stalled');
  assert(cm.deadlines.some((d) => d.label.includes('SUP-1')), 'supplement response deadline created', JSON.stringify(cm.deadlines));
}

// ---- 9. Digital twin: aggregates everything ----
{
  const b = bundle({
    documents: [photoDoc('p1', 'roof.jpg'), pdfDoc('d1', 'policy-2024.pdf', { isPolicy: true }), pdfDoc('d2', 'contractor-estimate.pdf', { isEstimate: true })],
  });
  const model = ci.analyzeClaim(b);
  const li = getLifecycle(b);
  const f = computeFinancialIntelligence(b);
  const twin = buildDigitalTwin(b, model, li, f);
  assert(twin.claimNumber === 'CLM-001', 'twin has claim number');
  assert(twin.customer.name === 'Jane Doe', 'twin has customer');
  assert(twin.photos.count === 1, 'twin photo count', `got ${twin.photos.count}`);
  assert(twin.documents.count === 3, 'twin document count');
  assert(twin.policy.policyNumber === 'SF-9921', 'twin policy');
  assert(twin.knowledgeGraph && twin.knowledgeGraph.nodes.length > 0, 'twin embeds knowledge graph');
  assert(twin.aiInsights.healthScore === model.health.score, 'twin embeds AI insights');
}

// ---- 10. Operations orchestrator: full model shape ----
{
  const model = analyzeOperations(bundle({ documents: [pdfDoc('d1', 'contractor-estimate.pdf', { isEstimate: true })] }));
  assert(model.claimId === 'c-1', 'ops model claim id');
  assert(model.lifecycle.currentStage, 'ops model lifecycle');
  assert(model.financial.figures.length > 0, 'ops model financial');
  assert(Array.isArray(model.opportunities), 'ops model opportunities');
  assert(Array.isArray(model.recommendations), 'ops model recommendations');
  assert(model.caseManager.aiSummary.length > 0, 'ops model case manager');
  assert(model.digitalTwin.claimNumber === 'CLM-001', 'ops model twin');
}

// ---- 11. Portfolio: company-wide aggregates ----
{
  const makeClaim = (id, num, overrides = {}) => bundle({ claimId: id, claimNumber: num, ...overrides });
  const now = new Date().toISOString();
  const overview = analyzePortfolio({
    bundles: [
      makeClaim('c-1', 'CLM-001', {
        status: 'waiting_for_carrier',
        estimatedValue: 20000,
        approvedValue: 15000,
        supplements: [{ id: 's1', supplementNumber: 'SUP-1', status: 'submitted', requestedAmount: 5000, approvedAmount: null, lineItems: [], createdAt: now, updatedAt: now }],
        documents: [photoDoc('p1', 'roof.jpg'), pdfDoc('d1', 'carrier-estimate.pdf', { isEstimate: true, isCarrierDocument: true })],
      }),
      makeClaim('c-2', 'CLM-002', {
        status: 'new',
        estimatedValue: 10000,
        supplements: [],
        documents: [],
      }),
      makeClaim('c-3', 'CLM-003', {
        status: 'closed',
        estimatedValue: 30000,
        approvedValue: 30000,
        supplements: [{ id: 's2', supplementNumber: 'SUP-2', status: 'approved', requestedAmount: 8000, approvedAmount: 8000, lineItems: [], createdAt: now, updatedAt: now }],
        documents: [photoDoc('p2', 'roof.jpg'), pdfDoc('d2', 'contractor-estimate.pdf', { isEstimate: true })],
      }),
    ],
  });
  assert(overview.revenue.totalActiveClaims === 2, 'total active claims excludes closed', `got ${overview.revenue.totalActiveClaims}`);
  assert(overview.revenue.claimsAwaitingResponse >= 1, 'awaiting response counted');
  assert(overview.revenue.revenueAlreadyRecovered === 8000, 'recovered revenue aggregated', `got ${overview.revenue.revenueAlreadyRecovered}`);
  assert(overview.revenue.claimsMissingEvidence >= 1, 'missing evidence counted');
  assert(overview.executive.claimPipeline.length > 0, 'claim pipeline populated');
  assert(overview.executive.highRiskClaims.length >= 0, 'high risk claims list present');
  assert(overview.portfolio.supplementSuccessRates.total === 2, 'supplement success totals', `got ${overview.portfolio.supplementSuccessRates.total}`);
  assert(overview.portfolio.revenueConcentrationByCarrier.some((c) => c.carrier === 'State Farm'), 'carrier concentration');
  assert(overview.revenue.averageClaimHealth >= 0, 'average claim health computed');
  assert(overview.generatedAt.length > 0, 'overview generatedAt');
}

// ---- 12. Portfolio: revenue forecast + trends ----
{
  const now = new Date().toISOString();
  const overview = analyzePortfolio({
    bundles: [
      bundle({ claimId: 'c-1', claimNumber: 'CLM-001', supplements: [{ id: 's1', supplementNumber: 'SUP-1', status: 'approved', requestedAmount: 1000, approvedAmount: 1000, lineItems: [], createdAt: now, updatedAt: now }] }),
    ],
  });
  assert(overview.executive.revenueForecast.length === 3, 'revenue forecast buckets', `got ${overview.executive.revenueForecast.length}`);
  assert(overview.portfolio.trends.length >= 1, 'trends computed');
}

// ---- 13. Event bus reuse: operations modules do not break the bus ----
{
  let received = 0;
  const unsub = claimEventBus.subscribe('*', () => { received++; });
  await claimEventBus.publish({ id: 'e1', companyId: 'co', claimId: 'c', eventType: 'claim.updated', entityType: 'claim', payload: {}, createdAt: new Date().toISOString() });
  assert(received === 1, 'bus still delivers wildcard events');
  unsub();
}

// ---- 14. No fabrication: opportunity null when no data ----
{
  const opps = detectRevenueOpportunities(bundle());
  const supplementOpp = opps.find((o) => o.type === 'potential_supplement');
  assert(!supplementOpp, 'no fabricated supplement potential when carrier approved unknown', JSON.stringify(opps.map((o) => o.type)));
}

console.log(`\nOperations intelligence unit tests: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('ALL OPERATIONS UNIT TESTS PASSED');
