// packages/claim-intelligence/src/lifecycle.ts
import { ClaimBundle, LifecycleStage, LifecycleInfo, LifecycleStageDef } from './types';
import { detectMissingInformation } from './health-monitor';

/**
 * Claim Lifecycle Engine — standardized lifecycle for every claim.
 *
 *   Lead → Inspection Scheduled → Inspection Complete → Claim Created →
 *   Carrier Review → Documentation Requested → Supplement Preparation →
 *   Supplement Submitted → Negotiation → Approved → Final Payment → Closed
 *
 * Claims may enter the lifecycle at ANY stage depending on their entry point
 * (new_claim / existing_claim / supplement_only / imported). The engine
 * infers the current stage from claim status + data signals, then determines
 * the next stage, missing requirements, blocking issues, and actions.
 */

export const LIFECYCLE_STAGES: { stage: LifecycleStage; label: string }[] = [
  { stage: 'lead', label: 'Lead' },
  { stage: 'inspection_scheduled', label: 'Inspection Scheduled' },
  { stage: 'inspection_complete', label: 'Inspection Complete' },
  { stage: 'claim_created', label: 'Claim Created' },
  { stage: 'carrier_review', label: 'Carrier Review' },
  { stage: 'documentation_requested', label: 'Documentation Requested' },
  { stage: 'supplement_preparation', label: 'Supplement Preparation' },
  { stage: 'supplement_submitted', label: 'Supplement Submitted' },
  { stage: 'negotiation', label: 'Negotiation' },
  { stage: 'approved', label: 'Approved' },
  { stage: 'final_payment', label: 'Final Payment' },
  { stage: 'closed', label: 'Closed' },
];

const STATUS_TO_STAGE: Record<string, LifecycleStage> = {
  new: 'lead',
  inspection_scheduled: 'inspection_scheduled',
  inspection_complete: 'inspection_complete',
  estimate_submitted: 'carrier_review',
  supplement_required: 'supplement_preparation',
  supplement_submitted: 'supplement_submitted',
  waiting_for_carrier: 'carrier_review',
  approved: 'approved',
  denied: 'negotiation',
  work_in_progress: 'negotiation',
  completed: 'final_payment',
  closed: 'closed',
};

function stageIndex(stage: LifecycleStage): number {
  return LIFECYCLE_STAGES.findIndex((s) => s.stage === stage);
}

/** Infer the current lifecycle stage from a claim bundle (deterministic). */
export function determineLifecycleStage(bundle: ClaimBundle): LifecycleStage {
  const statusStage = STATUS_TO_STAGE[bundle.status];

  // Data signals that override the raw status for accuracy:
  const hasDocs = bundle.documents.length > 0;
  const hasPhotos = bundle.documents.some((d) => d.isPhoto);
  const hasEstimate = bundle.documents.some((d) => d.isEstimate);
  const hasCarrierDoc = bundle.documents.some((d) => d.isCarrierDocument);
  const hasPolicy = bundle.documents.some((d) => d.isPolicy) || !!bundle.policyNumber;
  const interviewScheduled = bundle.interviews.length > 0;
  const interviewComplete = bundle.interviews.some((i) => i.status === 'completed');
  const sups = bundle.supplements;
  const hasSupplement = sups.length > 0;
  const anySubmitted = sups.some((s) =>
    ['submitted', 'pending', 'awaiting_response', 'waiting_for_carrier'].includes(s.status)
  );
  const anyApproved = sups.some((s) => s.status === 'approved' || s.status === 'partially_approved');
  const anyResponded = sups.some((s) => s.responseDate != null);
  const entryPoint = bundle.entryPoint || 'new_claim';

  // Terminal states take priority — a closed claim is ALWAYS closed (it must
  // never regress to final_payment even if supplements were approved earlier).
  if (bundle.status === 'closed') return 'closed';
  if (bundle.status === 'completed') return 'final_payment';
  if (bundle.status === 'approved' || anyApproved) return 'approved';

  // Negotiation: a carrier response exists but not approved (denied / partial / counter).
  if (anyResponded && sups.length > 0 && !anyApproved) return 'negotiation';

  // Supplement submitted
  if (bundle.status === 'supplement_submitted' || anySubmitted) return 'supplement_submitted';

  // Supplement-only entry: contractor joins to build a supplement → prepare.
  if (entryPoint === 'supplement_only') {
    return anySubmitted ? 'supplement_submitted' : hasEstimate ? 'supplement_preparation' : 'documentation_requested';
  }

  // Imported / existing claims with carrier docs are already under carrier review.
  if (entryPoint === 'imported' || entryPoint === 'existing_claim') {
    if (anySubmitted) return 'supplement_submitted';
    if (hasCarrierDoc || hasEstimate) return 'carrier_review';
    return hasDocs ? 'claim_created' : 'lead';
  }

  if (statusStage) {
    // Enrich raw status with data signals where meaningful.
    if (statusStage === 'lead' && hasEstimate) return 'carrier_review';
    if (statusStage === 'lead' && hasDocs) return 'claim_created';
    if (statusStage === 'carrier_review' && hasSupplement && !anySubmitted && !anyResponded) {
      return 'supplement_preparation';
    }
    if (statusStage === 'carrier_review' && hasCarrierDoc && hasEstimate && hasSupplement) {
      return 'supplement_preparation';
    }
    return statusStage;
  }

  // Fallback inference from data alone:
  if (interviewScheduled && !interviewComplete) return 'inspection_scheduled';
  if (interviewComplete && !hasEstimate) return 'inspection_complete';
  if (hasEstimate && !hasCarrierDoc) return 'carrier_review';
  if (hasEstimate && hasCarrierDoc && !hasSupplement) return 'supplement_preparation';
  if (hasSupplement && !anySubmitted) return 'supplement_preparation';
  if (hasDocs && !hasEstimate) return 'claim_created';
  if (!hasDocs && !hasPhotos && !hasPolicy) return 'lead';
  return 'claim_created';
}

/** Build the full lifecycle view for a claim. */
export function getLifecycle(bundle: ClaimBundle): LifecycleInfo {
  const currentStage = determineLifecycleStage(bundle);
  const currentIndex = stageIndex(currentStage);
  const totalStages = LIFECYCLE_STAGES.length;

  // Reached = every stage at or before the current one.
  const stages: LifecycleStageDef[] = LIFECYCLE_STAGES.map((def, i) => ({
    ...def,
    index: i,
    reached: i <= currentIndex,
    evidence: [],
  }));

  const missingRequirements = detectMissingInformation(bundle);
  const blockingIssues = missingRequirements.map((m) => ({
    id: `block-${m.id}`,
    severity: 'medium' as const,
    category: 'Missing Requirement',
    title: m.label,
    detail: m.detail,
  }));

  const nextStage = currentIndex + 1 < totalStages ? LIFECYCLE_STAGES[currentIndex + 1].stage : null;

  const recommendedActions: string[] = [];
  if (currentStage === 'lead') {
    recommendedActions.push('Record the customer and property details to convert this lead into a claim.');
  }
  if (currentStage === 'inspection_scheduled') {
    recommendedActions.push('Complete the inspection interview and capture damage photos.');
  }
  if (currentStage === 'inspection_complete') {
    recommendedActions.push('Upload the estimates so the claim can move to carrier review.');
  }
  if (currentStage === 'carrier_review') {
    recommendedActions.push('Upload the carrier estimate and any carrier communications.');
  }
  if (currentStage === 'documentation_requested') {
    recommendedActions.push('Collect and upload the documents requested by the carrier.');
  }
  if (currentStage === 'supplement_preparation') {
    recommendedActions.push('Generate the supplement from the estimate difference.');
  }
  if (currentStage === 'supplement_submitted') {
    recommendedActions.push('Follow up with the adjuster until the carrier responds.');
  }
  if (currentStage === 'negotiation') {
    recommendedActions.push('Respond to the carrier\'s counter with supporting evidence and resubmit.');
  }
  if (currentStage === 'approved') {
    recommendedActions.push('Schedule the work and prepare the final invoice.');
  }
  if (currentStage === 'final_payment') {
    recommendedActions.push('Confirm final payment and close the claim.');
  }
  missingRequirements.forEach((m) => recommendedActions.push(`${m.label} is missing: ${m.detail}`));

  return {
    currentStage,
    currentIndex,
    totalStages,
    progressPct: Math.round(((currentIndex + 1) / totalStages) * 100),
    nextStage,
    missingRequirements,
    blockingIssues,
    recommendedActions,
    stages,
  };
}
