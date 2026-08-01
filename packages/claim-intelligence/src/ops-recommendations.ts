// packages/claim-intelligence/src/ops-recommendations.ts
import {
  ClaimBundle,
  OperationalRecommendation,
  ClaimIntelligenceModel,
} from './types';
import { computeFinancialIntelligence } from './financial';

let seq = 0;
const nextId = () => `ops-${++seq}`;

/**
 * Operational Recommendation Engine.
 *
 * Generates proactive, business-oriented recommendations — schedule
 * reinspection, upload roof photos, request engineering report, await carrier
 * estimate, generate supplement, escalate overdue claim, follow up with
 * adjuster, prepare final invoice. Every recommendation includes priority,
 * reason, supporting evidence, confidence, estimated business impact, and the
 * required user action.
 */
export function generateOperationalRecommendations(
  bundle: ClaimBundle,
  model: ClaimIntelligenceModel
): OperationalRecommendation[] {
  seq = 0;
  const recs: OperationalRecommendation[] = [];
  const docs = bundle.documents;
  const photos = docs.filter((d) => d.isPhoto);
  const estimates = docs.filter((d) => d.isEstimate);
  const financial = computeFinancialIntelligence(bundle);
  const sups = bundle.supplements;
  const openSups = sups.filter((s) => !['approved', 'denied', 'closed'].includes(s.status));
  const now = Date.now();
  const money = (v: number | null) => (v != null ? `$${Math.round(v).toLocaleString()}` : 'unknown');

  const push = (
    title: string,
    reason: string,
    category: OperationalRecommendation['category'],
    priority: OperationalRecommendation['priority'],
    confidence: number,
    estimatedBusinessImpact: string,
    requiredUserAction: string,
    supportingEvidence: string[]
  ) => {
    recs.push({
      id: nextId(),
      priority,
      category,
      title,
      reason,
      supportingEvidence,
      confidence,
      estimatedBusinessImpact,
      requiredUserAction,
    });
  };

  // ---- Schedule reinspection (spec example) --------------------------------
  if (bundle.interviews.length > 0 && bundle.interviews.every((i) => i.status !== 'completed') && photos.length === 0) {
    push(
      'Schedule a reinspection',
      'The inspection is incomplete and no photos exist, so damage scope is unverified and the claim cannot progress.',
      'inspection',
      'high',
      0.7,
      'Unblocks estimate development and recovery of ' + money(financial.potentialRecovery),
      'Schedule a reinspection to capture damage scope and photos.',
      model.nextBestActions.find((a) => a.title === 'Schedule a reinspection')?.supportingEvidence.photoIds || []
    );
  }

  // ---- Upload additional roof photos ----------------------------------------
  if (photos.length > 0 && photos.length < 5) {
    push(
      'Upload additional damage photos',
      `Only ${photos.length} photo(s) on file — carriers routinely reject supplements with sparse photo coverage.`,
      'evidence',
      'medium',
      0.65,
      `Strengthens negotiation position on ${money(financial.potentialRecovery)} of potential recovery`,
      'Upload roof/interior damage photos matching each estimate line item.',
      photos.map((d) => d.fileName)
    );
  } else if (photos.length === 0) {
    push(
      'Upload damage photos',
      'No photos are attached to this claim. Photo evidence is the foundation of every estimate and supplement.',
      'evidence',
      'high',
      0.95,
      `Enables supplement generation on ${money(financial.potentialRecovery)} of potential recovery`,
      'Upload roof/interior damage photos showing the reported loss.',
      []
    );
  }

  // ---- Request engineering report --------------------------------------------
  if (
    bundle.estimatedValue &&
    Number(bundle.estimatedValue) >= 10000 &&
    !docs.some((d) => /engineer|structural/i.test(d.fileName))
  ) {
    push(
      'Request an engineering report',
      'High-value claims routinely require an engineer\'s opinion to substantiate structural damage before approval.',
      'documentation',
      'medium',
      0.7,
      `Protects ${money(financial.potentialRecovery)} of structural scope from being denied`,
      'Schedule an engineering inspection and upload the report.',
      estimates.map((d) => d.fileName)
    );
  }

  // ---- Await carrier estimate ------------------------------------------------
  const carrierEstimate = estimates.find((d) => d.isCarrierDocument);
  if (!carrierEstimate && estimates.length > 0) {
    push(
      'Await / obtain the carrier estimate',
      'Only contractor estimates are on file. The carrier estimate is required to compute the supplement difference.',
      'carrier',
      'high',
      0.9,
      `Defines the recoverable difference on ${money(financial.potentialRecovery)}`,
      'Upload the adjuster/Xactimate estimate from the carrier, or request it from the adjuster.',
      estimates.map((d) => d.fileName)
    );
  }

  // ---- Generate supplement ----------------------------------------------------
  const enoughForSupplement = (carrierEstimate || estimates.length > 0) && photos.length > 0 && docs.length >= 2;
  const hasOpenSupplement = openSups.length > 0;
  if (enoughForSupplement && !hasOpenSupplement) {
    push(
      'Generate supplement',
      'Evidence is sufficient (estimates + photos + documents) and no open supplement exists. Recovery value is unrealized.',
      'supplement',
      'high',
      0.85,
      `Captures ${money(financial.estimatedRecoveryOpportunity)} of estimated recovery opportunity`,
      'Run the supplement generation workflow to capture the difference.',
      estimates.map((d) => d.fileName)
    );
  }

  // ---- Escalate overdue claim ------------------------------------------------
  const staleOpen = openSups.filter((s) => {
    if (!s.submissionDate) return false;
    return (now - new Date(s.submissionDate).getTime()) / 86400000 > 21;
  });
  if (staleOpen.length > 0) {
    push(
      'Escalate overdue claim',
      `${staleOpen.length} supplement(s) submitted over 21 days ago with no carrier response.`,
      'escalation',
      'critical',
      0.9,
      `Recovers ${money(financial.outstandingRevenue)} in outstanding supplement value`,
      'Escalate to management / carrier supervisor and request a decision date.',
      staleOpen.map((s) => s.supplementNumber)
    );
  }

  // ---- Follow up with adjuster -------------------------------------------------
  const unanswered = openSups.filter((s) => !s.responseDate);
  if (unanswered.length > 0) {
    push(
      'Follow up with the adjuster',
      `${unanswered.length} open supplement(s) have no carrier response yet. Delays on open supplements stall recovery.`,
      'carrier',
      'medium',
      0.8,
      `Unblocks ${money(financial.outstandingRevenue)} in outstanding supplement value`,
      'Contact the adjuster for a status update on the submitted supplements.',
      unanswered.map((s) => s.supplementNumber)
    );
  }

  // ---- Prepare final invoice ----------------------------------------------------
  const anyApproved = sups.some((s) => s.status === 'approved' || s.status === 'partially_approved');
  const noInvoice = !docs.some((d) => /invoice|final.?bill/i.test(d.fileName));
  if (anyApproved && noInvoice && (bundle.status === 'approved' || bundle.status === 'work_in_progress')) {
    push(
      'Prepare the final invoice',
      'Approved coverage exists but no final invoice is on file — payment is not collectable until invoiced.',
      'invoice',
      'medium',
      0.75,
      `Collects ${money(financial.recoveredRevenue)} in approved revenue`,
      'Prepare and submit the final invoice for the approved amount.',
      sups.filter((s) => s.status === 'approved').map((s) => s.supplementNumber)
    );
  }

  return recs.sort((a, b) => rank(a.priority) - rank(b.priority));
}

function rank(p: OperationalRecommendation['priority']): number {
  return p === 'critical' ? 0 : p === 'high' ? 1 : p === 'medium' ? 2 : 3;
}
