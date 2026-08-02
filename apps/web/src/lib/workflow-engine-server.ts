// apps/web/src/lib/workflow-engine-server.ts
// Server-side mirror of the API workflow engine — builds the dynamic Claim
// Workspace state and AI-task readiness from live DB evidence.

import { eq, and } from 'drizzle-orm';
import { db } from './server-db';
import { claims, documents, supplements, interviews } from '@project-atlas/database';
import type { EntryPoint, WorkspaceState, TaskReadiness, WorkspaceSection } from './workflow-engine';
import { AI_TASK_LABELS, SECTION_LABELS } from './workflow-engine';

export type AITask =
  | 'generate_claim_package'
  | 'generate_supplement'
  | 'analyze_policy'
  | 'review_carrier_estimate'
  | 'generate_narrative'
  | 'generate_recommendations';

export const AI_TASKS: AITask[] = [
  'generate_claim_package',
  'generate_supplement',
  'analyze_policy',
  'review_carrier_estimate',
  'generate_narrative',
  'generate_recommendations',
];

export interface EvidenceContext {
  claim: boolean;
  customer: boolean;
  property: boolean;
  insurance: boolean;
  evidence: boolean;
  inspection: boolean;
  photos: boolean;
  documents: boolean;
  policy: boolean;
  carrierEstimate: boolean;
  contractorEstimate: boolean;
  existingSupplements: boolean;
  claimPackage: boolean;
  carrierResponse: boolean;
  interviews: boolean;
  aiAnalysis: boolean;
}

export function emptyEvidenceContext(): EvidenceContext {
  return {
    claim: false,
    customer: false,
    property: false,
    insurance: false,
    evidence: false,
    inspection: false,
    photos: false,
    documents: false,
    policy: false,
    carrierEstimate: false,
    contractorEstimate: false,
    existingSupplements: false,
    claimPackage: false,
    carrierResponse: false,
    interviews: false,
    aiAnalysis: false,
  };
}

interface TaskRequirement {
  key: keyof EvidenceContext;
  label: string;
  required: boolean;
}

export const TASK_REQUIREMENTS: Record<AITask, TaskRequirement[]> = {
  generate_claim_package: [
    { key: 'claim', label: 'Claim information', required: true },
    { key: 'customer', label: 'Customer information', required: true },
    { key: 'property', label: 'Property information', required: true },
    { key: 'documents', label: 'Supporting documents', required: true },
    { key: 'photos', label: 'Photos', required: false },
    { key: 'inspection', label: 'Inspection', required: false },
  ],
  generate_supplement: [
    { key: 'claim', label: 'Claim information', required: true },
    { key: 'carrierEstimate', label: 'Carrier estimate', required: false },
    { key: 'contractorEstimate', label: 'Contractor estimate', required: false },
    { key: 'photos', label: 'Photos', required: false },
    { key: 'documents', label: 'Supporting documents', required: false },
  ],
  analyze_policy: [{ key: 'policy', label: 'Policy document', required: true }],
  review_carrier_estimate: [
    { key: 'carrierEstimate', label: 'Carrier estimate', required: true },
    { key: 'claim', label: 'Claim information', required: false },
  ],
  generate_narrative: [
    { key: 'claim', label: 'Claim information', required: true },
    { key: 'documents', label: 'Supporting documents', required: false },
    { key: 'photos', label: 'Photos', required: false },
    { key: 'interviews', label: 'Interview responses', required: false },
  ],
  generate_recommendations: [
    { key: 'claim', label: 'Claim information', required: true },
    { key: 'documents', label: 'Supporting documents', required: false },
    { key: 'photos', label: 'Photos', required: false },
    { key: 'aiAnalysis', label: 'AI analysis', required: false },
  ],
};

export function evaluateTaskReadiness(task: AITask, ctx: EvidenceContext): TaskReadiness {
  const requirements = TASK_REQUIREMENTS[task];
  const missingRequired = requirements
    .filter((r) => r.required && !ctx[r.key])
    .map((r) => ({ key: r.key, label: r.label }));
  const missingOptional = requirements
    .filter((r) => !r.required && !ctx[r.key])
    .map((r) => ({ key: r.key, label: r.label }));
  const satisfied = requirements
    .filter((r) => ctx[r.key])
    .map((r) => ({ key: r.key, label: r.label }));

  return {
    task,
    label: AI_TASK_LABELS[task as keyof typeof AI_TASK_LABELS],
    ready: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    satisfied,
  };
}

const ENTRY_POINT_CORE: Record<EntryPoint, string[]> = {
  new_claim: ['customer', 'property', 'insurance'],
  existing_claim: ['insurance'],
  supplement_only: [],
  imported: [],
};

const OPTIONAL_MESSAGES: Record<string, { message: string; action: string }> = {
  claim_package: { message: 'Claim Package not yet generated.', action: 'Generate Claim Package (Optional)' },
  supplements: { message: 'No supplements yet.', action: 'Generate Supplement (Optional)' },
  carrier_responses: { message: 'No carrier responses yet.', action: 'Check Carrier' },
  compliance: { message: 'Compliance check not yet run.', action: 'Run Compliance Check (Optional)' },
  communications: { message: 'No communications recorded.', action: 'Add Communication' },
  ai_insights: { message: 'AI analysis not yet run.', action: 'Run AI Analysis (Optional)' },
  evidence: { message: 'No evidence links yet.', action: 'Build Evidence Graph' },
  timeline: { message: 'No timeline events yet.', action: 'View Activity' },
  customer: { message: 'Customer intake not completed.', action: 'Add Customer' },
  property: { message: 'Property information not set.', action: 'Add Property' },
  insurance: { message: 'Insurance details not set.', action: 'Add Insurance' },
  documents: { message: 'No documents uploaded.', action: 'Upload Documents' },
  photos: { message: 'No photos uploaded.', action: 'Upload Photos' },
  estimates: { message: 'No estimates uploaded.', action: 'Upload Estimate' },
};

export function getWorkspaceState(
  entryPoint: EntryPoint,
  ctx: EvidenceContext,
): WorkspaceState {
  const coreRequired = ENTRY_POINT_CORE[entryPoint] || [];
  const hasEvidence = (key: keyof EvidenceContext) => ctx[key];

  const sectionDefs: { id: string; key?: keyof EvidenceContext; optional?: boolean }[] = [
    { id: 'customer', key: 'customer' },
    { id: 'property', key: 'property' },
    { id: 'insurance', key: 'insurance' },
    { id: 'timeline' },
    { id: 'communications', optional: true },
    { id: 'documents', key: 'documents' },
    { id: 'photos', key: 'photos' },
    { id: 'estimates', key: 'carrierEstimate' },
    { id: 'evidence', key: 'evidence' },
    { id: 'ai_insights', key: 'aiAnalysis', optional: true },
    { id: 'claim_package', key: 'claimPackage', optional: true },
    { id: 'supplements', key: 'existingSupplements', optional: true },
    { id: 'carrier_responses', key: 'carrierResponse', optional: true },
    { id: 'compliance', key: 'aiAnalysis', optional: true },
  ];

  const sections: WorkspaceSection[] = sectionDefs.map((def) => {
    const hasData = def.key ? hasEvidence(def.key) : false;
    const optional = def.optional === true;
    let state: 'ready' | 'inactive' | 'optional' | 'pending';
    if (hasData) {
      state = 'ready';
    } else if (optional) {
      state = 'optional';
    } else if (coreRequired.includes(def.id)) {
      state = 'pending';
    } else {
      state = 'inactive';
    }
    const msg = OPTIONAL_MESSAGES[def.id];
    return {
      id: def.id as WorkspaceSection['id'],
      label: SECTION_LABELS[def.id as keyof typeof SECTION_LABELS] || def.id,
      state,
      hasData,
      ...(state === 'optional' ? { message: msg?.message, action: msg?.action } : {}),
    };
  });

  const aiTasks = AI_TASKS.map((task) => evaluateTaskReadiness(task, ctx));
  const readyTaskCount = aiTasks.filter((t) => t.ready).length;

  return { entryPoint, sections, aiTasks, readyTaskCount };
}

/**
 * Build the evidence context for a claim from live DB data.
 * Missing optional modules are recorded as absent — never a blocker.
 */
export async function buildEvidenceContext(
  claimId: string,
  companyId: string,
): Promise<EvidenceContext> {
  const [claim] = await db
    .select()
    .from(claims)
    .where(and(eq(claims.id, claimId), eq(claims.companyId, companyId)))
    .limit(1);

  if (!claim) {
    throw new Error('Claim not found');
  }

  const [docs, sups, ivs] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(and(eq(documents.claimId, claimId), eq(documents.companyId, companyId))),
    db
      .select()
      .from(supplements)
      .where(and(eq(supplements.claimId, claimId), eq(supplements.companyId, companyId))),
    db
      .select()
      .from(interviews)
      .where(and(eq(interviews.claimId, claimId), eq(interviews.companyId, companyId))),
  ]);

  const hasPhotos = docs.some((d) => (d.mimeType || '').startsWith('image/'));
  const hasCarrierEstimate =
    sups.some((s) => s.approvedAmount) ||
    docs.some((d) => /estimate|carrier|xactimate|adjuster/i.test(d.fileName || ''));
  const hasCarrierResponse = sups.some(
    (s) => !!s.responseDate || ['approved', 'denied', 'partially_approved', 'needs_revision'].includes(s.status),
  );

  return {
    ...emptyEvidenceContext(),
    claim: true,
    customer: !!claim.customerName || !!claim.customerEmail,
    property: !!claim.propertyId,
    insurance: !!claim.insuranceCompany || !!claim.policyNumber,
    inspection: ivs.length > 0 && ivs.some((i) => i.status === 'completed'),
    photos: hasPhotos,
    documents: docs.length > 0,
    policy: !!claim.policyNumber || docs.some((d) => /policy/i.test(d.fileName || '')),
    carrierEstimate: hasCarrierEstimate,
    contractorEstimate: docs.some((d) => /contractor|our|own estimate/i.test(d.fileName || '')) || sups.length > 0,
    existingSupplements: sups.length > 0,
    claimPackage: false,
    carrierResponse: hasCarrierResponse,
    interviews: ivs.length > 0,
    aiAnalysis: false,
    evidence: docs.length > 0 || hasPhotos,
  };
}
