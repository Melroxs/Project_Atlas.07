// Unit tests for the Atlas Multi-Entry Workflow Engine (pure, dependency-free).
// Imports the compiled engine from apps/api/dist/lib/workflow-engine.js.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const engine = require('../apps/api/dist/lib/workflow-engine.js');

const {
  ENTRY_POINTS,
  AI_TASKS,
  AI_TASK_LABELS,
  TASK_REQUIREMENTS,
  evaluateTaskReadiness,
  getWorkspaceState,
  emptyEvidenceContext,
} = engine;

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

function ctx(overrides = {}) {
  return { ...emptyEvidenceContext(), ...overrides };
}

// ---- 1. Requirement: Claim Package is NEVER required for Supplement Generation
{
  const reqs = TASK_REQUIREMENTS.generate_supplement;
  assert(
    !reqs.some((r) => r.key === 'claimPackage'),
    'generate_supplement requirements do not include claimPackage',
    JSON.stringify(reqs.map((r) => r.key))
  );
  const r = evaluateTaskReadiness('generate_supplement', ctx({ claim: true, carrierEstimate: true }));
  assert(r.ready, 'supplement ready with claim + carrier estimate, no claim package');
  assert(
    r.missingRequired.length === 0,
    'no missing required when claim present'
  );
}

// ---- 2. Supplement blocked when required evidence missing
{
  const r = evaluateTaskReadiness('generate_supplement', ctx({}));
  assert(!r.ready, 'supplement NOT ready with no claim');
  assert(
    r.missingRequired.some((m) => m.key === 'claim'),
    'missingRequired includes claim'
  );
}

// ---- 3. Claim Package generation does NOT require a carrier response
{
  const r = evaluateTaskReadiness('generate_claim_package', ctx({
    claim: true, customer: true, property: true, documents: true,
  }));
  assert(r.ready, 'claim package ready without carrier response');
  assert(
    !r.missingRequired.some((m) => m.key === 'carrierResponse'),
    'carrierResponse never a requirement for generate_claim_package'
  );
}

// ---- 4. Policy analysis requires ONLY a policy, never a supplement
{
  const reqs = TASK_REQUIREMENTS.analyze_policy;
  assert(
    !reqs.some((r) => r.key === 'existingSupplements' || r.key === 'claimPackage'),
    'analyze_policy has no supplement/claim-package dependency'
  );
  const r = evaluateTaskReadiness('analyze_policy', ctx({ policy: true }));
  assert(r.ready, 'policy analysis ready with just a policy document');
}

// ---- 5. Workspace: supplement_only project never shows customer/property as pending
{
  const ws = getWorkspaceState('supplement_only', ctx({ claim: true }));
  const pending = ws.sections.filter((s) => s.state === 'pending').map((s) => s.id);
  assert(
    !pending.includes('customer') && !pending.includes('property'),
    'supplement_only workspace has no pending customer/property',
    `pending=${JSON.stringify(pending)}`
  );
  const claimPkg = ws.sections.find((s) => s.id === 'claim_package');
  assert(
    claimPkg && claimPkg.state === 'optional',
    'claim_package section is optional (informational) for supplement_only',
    `state=${claimPkg && claimPkg.state}`
  );
  assert(
    claimPkg && /not yet generated/i.test(claimPkg.message || ''),
    'optional message says "Claim Package not yet generated."',
    claimPkg && claimPkg.message
  );
}

// ---- 6. Workspace: new_claim project requires customer/property/insurance
{
  const ws = getWorkspaceState('new_claim', ctx({ claim: true }));
  const pending = ws.sections.filter((s) => s.state === 'pending').map((s) => s.id);
  assert(
    ['customer', 'property', 'insurance'].every((id) => pending.includes(id)),
    'new_claim workspace marks customer/property/insurance pending',
    JSON.stringify(pending)
  );
}

// ---- 7. Workspace: imported project with evidence lights up sections as ready
{
  const ws = getWorkspaceState('imported', ctx({
    claim: true, customer: true, property: true, insurance: true,
    documents: true, photos: true, evidence: true, carrierEstimate: true,
    existingSupplements: true,
  }));
  const ready = ws.sections.filter((s) => s.state === 'ready').map((s) => s.id);
  assert(
    ['documents', 'photos', 'estimates', 'evidence', 'supplements'].every((id) => ready.includes(id)),
    'imported workspace marks documents/photos/estimates/evidence/supplements ready',
    JSON.stringify(ready)
  );
  assert(
    !ws.sections.find((s) => s.id === 'supplements').message,
    'ready supplements section has no warning message'
  );
}

// ---- 8. AI task list covers all six required tasks
{
  assert(AI_TASKS.length === 6, 'six AI tasks defined', `got ${AI_TASKS.length}`);
  assert(
    ['generate_claim_package', 'generate_supplement', 'analyze_policy', 'review_carrier_estimate', 'generate_narrative', 'generate_recommendations']
      .every((t) => AI_TASKS.includes(t)),
    'all six task ids present'
  );
  assert(AI_TASK_LABELS.generate_supplement === 'Generate Supplement', 'task label maps');
}

// ---- 9. Entry points: all four present with icons
{
  assert(
    ['new_claim', 'existing_claim', 'supplement_only', 'imported'].every((e) => ENTRY_POINTS[e]),
    'all four entry points defined'
  );
  assert(ENTRY_POINTS.supplement_only.icon === '⚡', 'supplement-only has lightning icon');
  assert(ENTRY_POINTS.imported.icon === '📥', 'import has inbox icon');
}

// ---- 10. Ready task count aggregates correctly
{
  const ws = getWorkspaceState('supplement_only', ctx({
    claim: true, carrierEstimate: true, policy: true, documents: true,
  }));
  // ready tasks: generate_supplement, analyze_policy, review_carrier_estimate,
  // generate_narrative, generate_recommendations = 5 (claim package needs customer+property)
  assert(
    ws.readyTaskCount >= 5,
    'readyTaskCount reflects evidence-driven readiness',
    `count=${ws.readyTaskCount}`
  );
}

console.log(`\nWorkflow engine unit tests: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('ALL UNIT TESTS PASSED');
