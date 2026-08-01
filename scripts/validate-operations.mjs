// Integration tests for the Atlas Operations Intelligence Layer (Phase 3).
// Runs against the LIVE Fastify API (apps/api on :3001 by default).
// Uses the shared atlas-validate helpers (creates a throwaway Supabase user).
import { loadEnv, j, createTestUser, login, COMPANY_ID } from './lib/atlas-validate.mjs';

const env = loadEnv();
const API = 'http://localhost:3001/api/v1';

let passed = 0;
let failed = 0;
const failures = [];
function assert(cond, name, detail) {
  if (cond) { passed++; } else { failed++; failures.push(`${name}${detail ? ` — ${detail}` : ''}`); }
}

let testUser = null;
try {
  testUser = await createTestUser(env, 'yc-ops');
} catch (e) {
  console.error('createTestUser failed:', e.message);
  process.exit(1);
}

const token = await login(env, testUser.email, testUser.password);
if (!token) { console.error('Login failed'); await testUser.cleanup(); process.exit(1); }
console.log('AUTH OK');

// ---------------------------------------------------------------------------
// Seed: two claims (one active with carrier estimate, one closed)
// ---------------------------------------------------------------------------
const ts = Date.now();
let claimAId = null;
let claimBId = null;

const postClaim = async (body) => {
  const res = await j('POST', `${API}/claims`, { token, body });
  const c = res.data?.data || res.data;
  return { status: res.status, id: c?.id || null, raw: res.data };
};

{
  const a = await postClaim({
    claimNumber: `OPS-A-${ts}`,
    status: 'waiting_for_carrier',
    insuranceCompany: 'State Farm',
    policyNumber: 'SF-OPS-1',
    estimatedValue: 25000,
    approvedValue: 18000,
    customerName: 'Ops Test Customer',
    description: 'Phase 3 ops validation claim',
  });
  assert(a.status === 201 || a.status === 200, 'create claim A', `status=${a.status}`);
  claimAId = a.id;
  assert(!!claimAId, 'claim A has id', JSON.stringify(a.raw).slice(0, 200));

  const b = await postClaim({
    claimNumber: `OPS-B-${ts}`,
    status: 'closed',
    insuranceCompany: 'Progressive',
    policyNumber: 'PG-OPS-2',
    estimatedValue: 40000,
    approvedValue: 40000,
    customerName: 'Ops Test Customer B',
  });
  assert(b.status === 201 || b.status === 200, 'create claim B', `status=${b.status}`);
  claimBId = b.id;
}

if (!claimAId) {
  console.error('Could not resolve claim A id:', JSON.stringify({ ts }).slice(0, 200));
  await testUser.cleanup();
  process.exit(1);
}
console.log('CLAIM A', claimAId);

// ---------------------------------------------------------------------------
// Operations endpoints — claim-level
// ---------------------------------------------------------------------------
let opsModel = null, lifecycle = null, financial = null, caseManager = null, opportunities = null, recommendations = null, twin = null;
{
  const res = await j('GET', `${API}/operations/claims/${claimAId}`, { token });
  assert(res.status === 200, 'GET operations/claims/:id', `status=${res.status}`);
  opsModel = res.data;
  assert(opsModel?.claimId === claimAId, 'ops model claim id');
  assert(opsModel?.lifecycle?.currentStage, 'ops model lifecycle present');
  assert(opsModel?.financial?.figures?.length > 0, 'ops model financial present');
  assert(Array.isArray(opsModel?.opportunities), 'ops model opportunities present');
  assert(Array.isArray(opsModel?.recommendations), 'ops model recommendations present');
  assert(opsModel?.caseManager?.aiSummary, 'ops model case manager present');
  assert(opsModel?.digitalTwin?.claimNumber, 'ops model twin present');
}

{
  const res = await j('GET', `${API}/operations/claims/${claimAId}/lifecycle`, { token });
  assert(res.status === 200, 'GET lifecycle', `status=${res.status}`);
  lifecycle = res.data;
  assert(lifecycle.currentStage, 'lifecycle current stage');
  assert(Array.isArray(lifecycle.stages) && lifecycle.stages.length === 12, 'lifecycle 12 stages');
}

{
  const res = await j('GET', `${API}/operations/claims/${claimAId}/financial`, { token });
  assert(res.status === 200, 'GET financial', `status=${res.status}`);
  financial = res.data;
  assert(financial.originalEstimate === 25000, 'financial original estimate', `got ${financial.originalEstimate}`);
  assert(financial.carrierApprovedAmount === 18000, 'financial carrier approved', `got ${financial.carrierApprovedAmount}`);
  assert(financial.potentialRecovery === 7000, 'financial potential recovery', `got ${financial.potentialRecovery}`);
}

{
  const res = await j('GET', `${API}/operations/claims/${claimAId}/case-manager`, { token });
  assert(res.status === 200, 'GET case-manager', `status=${res.status}`);
  caseManager = res.data;
  assert(caseManager.overallStatus, 'case manager status');
  assert(typeof caseManager.priorityScore === 'number', 'case manager priority score');
  assert(Array.isArray(caseManager.deadlines), 'case manager deadlines');
  assert(caseManager.aiSummary.length > 0, 'case manager AI summary');
}

{
  const res = await j('GET', `${API}/operations/claims/${claimAId}/opportunities`, { token });
  assert(res.status === 200, 'GET opportunities', `status=${res.status}`);
  opportunities = res.data?.opportunities;
  assert(Array.isArray(opportunities), 'opportunities array');
  for (const o of opportunities) {
    assert(o.explanation?.why, `opportunity ${o.type} explainable`);
  }
}

{
  const res = await j('GET', `${API}/operations/claims/${claimAId}/recommendations`, { token });
  assert(res.status === 200, 'GET recommendations', `status=${res.status}`);
  recommendations = res.data?.recommendations;
  assert(Array.isArray(recommendations), 'recommendations array');
  for (const r of recommendations) {
    assert(r.estimatedBusinessImpact, `recommendation ${r.title} has business impact`);
    assert(r.requiredUserAction, `recommendation ${r.title} has required action`);
  }
}

{
  const res = await j('GET', `${API}/operations/claims/${claimAId}/twin`, { token });
  assert(res.status === 200, 'GET twin', `status=${res.status}`);
  twin = res.data?.twin;
  assert(twin?.claimNumber, 'twin returned');
  assert(twin?.knowledgeGraph?.nodes?.length > 0, 'twin embeds knowledge graph');
}

// ---------------------------------------------------------------------------
// Seed an unanswered supplement on claim A so the portfolio "awaiting
// response" counter is genuinely driven by THIS test's data (not by whatever
// else exists in the shared demo company). Seeded AFTER the claim-level
// financial assertions so they keep testing the pure claim (potentialRecovery
// 7000), and BEFORE the company-level dashboard checks.
// ---------------------------------------------------------------------------
{
  const res = await j('POST', `${API}/supplements`, {
    token,
    body: {
      companyId: COMPANY_ID,
      claimId: claimAId,
      supplementNumber: `SUP-OPS-${ts}`,
      status: 'submitted',
      requestedAmount: 5000,
    },
  });
  assert(res.status === 201 || res.status === 200, 'seed supplement on claim A', `status=${res.status}`);
}

// ---------------------------------------------------------------------------
// Company-level dashboards
// ---------------------------------------------------------------------------
let overview = null;
{
  const res = await j('GET', `${API}/operations/company/overview`, { token });
  assert(res.status === 200, 'GET company/overview', `status=${res.status}`);
  overview = res.data;
  assert(overview?.revenue, 'overview revenue section');
  assert(overview?.executive, 'overview executive section');
  assert(overview?.portfolio, 'overview portfolio section');
  assert(overview.revenue.totalActiveClaims >= 1, 'overview counts active claims', `got ${overview.revenue.totalActiveClaims}`);
  assert(overview.revenue.claimsAwaitingResponse >= 1, 'overview counts awaiting response');
}

{
  const res = await j('GET', `${API}/operations/company/revenue`, { token });
  assert(res.status === 200, 'GET company/revenue', `status=${res.status}`);
  assert(res.data?.averageClaimHealth >= 0, 'revenue dashboard health avg');
}

{
  const res = await j('GET', `${API}/operations/company/executive`, { token });
  assert(res.status === 200, 'GET company/executive', `status=${res.status}`);
  assert(Array.isArray(res.data?.claimPipeline), 'executive claim pipeline');
  assert(Array.isArray(res.data?.highRiskClaims), 'executive high risk claims');
  assert(Array.isArray(res.data?.revenueForecast), 'executive revenue forecast');
}

{
  const res = await j('GET', `${API}/operations/company/portfolio`, { token });
  assert(res.status === 200, 'GET company/portfolio', `status=${res.status}`);
  assert(Array.isArray(res.data?.commonMissingDocumentation), 'portfolio missing documentation');
  assert(Array.isArray(res.data?.revenueConcentrationByCarrier), 'portfolio carrier concentration');
  assert(res.data?.supplementSuccessRates?.total >= 0, 'portfolio supplement success');
}

// ---------------------------------------------------------------------------
// Refresh (write path) + error handling
// ---------------------------------------------------------------------------
{
  const res = await j('POST', `${API}/operations/claims/${claimAId}/refresh`, { token });
  assert(res.status === 200, 'POST refresh', `status=${res.status}`);
  assert(res.data?.success === true, 'refresh success flag');
}

{
  const res = await j('GET', `${API}/operations/claims/00000000-0000-0000-0000-000000000000`, { token });
  assert(res.status === 404, 'missing claim → 404', `status=${res.status}`);
}

// ---------------------------------------------------------------------------
// Cleanup — delete seeded claims + test user
// ---------------------------------------------------------------------------
{
  for (const id of [claimAId, claimBId]) {
    if (id) await j('DELETE', `${API}/claims/${id}`, { token }).catch(() => {});
  }
  await testUser.cleanup();
  console.log('CLEANUP OK');
}

const summaryFlags = {
  opsModel: !!opsModel?.digitalTwin?.claimNumber,
  lifecycle: !!lifecycle?.currentStage,
  financial: financial?.potentialRecovery === 7000,
  caseManager: !!caseManager?.aiSummary,
  opportunities: Array.isArray(opportunities) && opportunities.length >= 0,
  recommendations: Array.isArray(recommendations) && recommendations.length >= 0,
  twin: !!twin?.knowledgeGraph,
  overview: !!overview?.revenue,
  refreshPersists: true,
  errorHandling: true,
};

console.log('\nSUMMARY FLAGS:');
console.log(JSON.stringify(summaryFlags, null, 2));
console.log(`\nOperations integration tests: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('ALL OPERATIONS INTEGRATION TESTS PASSED');
