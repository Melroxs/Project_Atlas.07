// packages/claim-intelligence/src/scoring.ts
import {
  ClaimBundle,
  RecoveryReadiness,
  RecoveryFactor,
  FactorKey,
} from './types';

/**
 * Recovery Readiness weighting (from the spec):
 *   Evidence Quality          25%
 *   Documentation             20%
 *   Policy References         15%
 *   Carrier Response Coverage 15%
 *   Compliance                15%
 *   AI Confidence             10%
 */
export const RECOVERY_WEIGHTS: { key: FactorKey; label: string; weight: number }[] = [
  { key: 'evidenceQuality', label: 'Evidence Quality', weight: 25 },
  { key: 'documentation', label: 'Documentation', weight: 20 },
  { key: 'policyReferences', label: 'Policy References', weight: 15 },
  { key: 'carrierResponseCoverage', label: 'Carrier Response Coverage', weight: 15 },
  { key: 'compliance', label: 'Compliance', weight: 15 },
  { key: 'aiConfidence', label: 'AI Confidence', weight: 10 },
];

// ---------------------------------------------------------------------------
// Evidence quality — photos + documents + evidence links with strength.
// ---------------------------------------------------------------------------
export function scoreEvidenceQuality(bundle: ClaimBundle): RecoveryFactor {
  const { documents, evidenceLinks } = bundle;
  const photos = documents.filter((d) => d.isPhoto);
  const nonPhoto = documents.filter((d) => !d.isPhoto);

  let score = 0;
  const reasons: string[] = [];

  if (photos.length === 0) {
    reasons.push('No photos uploaded');
  } else {
    score += Math.min(30, photos.length * 10);
    reasons.push(`${photos.length} photo(s)`);
  }
  if (nonPhoto.length === 0) {
    reasons.push('No supporting documents');
  } else {
    score += Math.min(30, nonPhoto.length * 6);
    reasons.push(`${nonPhoto.length} document(s)`);
  }
  if (evidenceLinks.length === 0) {
    reasons.push('No evidence graph links');
  } else {
    const strong = evidenceLinks.filter((l) => Number(l.strengthScore ?? 0) >= 0.7).length;
    score += Math.min(30, evidenceLinks.length * 6 + strong * 4);
    reasons.push(`${evidenceLinks.length} evidence link(s)`);
  }
  if (bundle.interviews.some((i) => i.status === 'completed')) {
    score += 10;
    reasons.push('Completed interview');
  }

  return factor('evidenceQuality', 'Evidence Quality', 25, clamp(score), reasons.join('; ') || 'No evidence yet');
}

// ---------------------------------------------------------------------------
// Documentation — coverage of the key document types.
// ---------------------------------------------------------------------------
export function scoreDocumentation(bundle: ClaimBundle): RecoveryFactor {
  const docs = bundle.documents;
  const hasPolicy = docs.some((d) => d.isPolicy);
  const hasEstimate = docs.some((d) => d.isEstimate);
  const hasSigned = docs.some((d) => d.isSigned);
  const count = docs.length;

  let score = 0;
  const reasons: string[] = [];
  if (count === 0) {
    reasons.push('No documents');
  } else {
    score += Math.min(20, count * 4);
    reasons.push(`${count} document(s)`);
  }
  if (hasPolicy) {
    score += 25;
    reasons.push('Policy on file');
  } else {
    reasons.push('Policy missing');
  }
  if (hasEstimate) {
    score += 25;
    reasons.push('Estimate on file');
  } else {
    reasons.push('Estimate missing');
  }
  if (hasSigned) {
    score += 15;
    reasons.push('Signed document');
  } else {
    reasons.push('No signed documents');
  }
  if (bundle.communications.length > 0) {
    score += 15;
    reasons.push(`${bundle.communications.length} communication(s)`);
  }

  return factor('documentation', 'Documentation', 20, clamp(score), reasons.join('; '));
}

// ---------------------------------------------------------------------------
// Policy references — policy present + evidence linking back to it.
// ---------------------------------------------------------------------------
export function scorePolicyReferences(bundle: ClaimBundle): RecoveryFactor {
  const hasPolicy = bundle.documents.some((d) => d.isPolicy);
  const policyNumber = bundle.policyNumber;
  let score = 0;
  const reasons: string[] = [];

  if (policyNumber) {
    score += 40;
    reasons.push(`Policy #${policyNumber}`);
  } else {
    reasons.push('No policy number on claim');
  }
  if (hasPolicy) {
    score += 40;
    reasons.push('Policy document uploaded');
  } else {
    reasons.push('Policy document not uploaded');
  }
  if (bundle.documents.some((d) => d.isPolicy && d.isSigned)) {
    score += 20;
    reasons.push('Policy referenced in signed doc');
  } else {
    reasons.push('No signed policy reference');
  }

  return factor('policyReferences', 'Policy References', 15, clamp(score), reasons.join('; '));
}

// ---------------------------------------------------------------------------
// Carrier response coverage — supplements with a response or terminal status.
// ---------------------------------------------------------------------------
const TERMINAL_STATUSES = ['approved', 'denied', 'partially_approved', 'needs_revision', 'closed'];

export function scoreCarrierResponseCoverage(bundle: ClaimBundle): RecoveryFactor {
  const sups = bundle.supplements;
  let score = 0;
  const reasons: string[] = [];

  if (sups.length === 0) {
    reasons.push('No supplements created');
  } else {
    score += Math.min(25, sups.length * 8);
    reasons.push(`${sups.length} supplement(s)`);
  }
  const responded = sups.filter((s) => s.responseDate || TERMINAL_STATUSES.includes(s.status));
  if (responded.length === 0) {
    reasons.push('No carrier response yet');
  } else {
    score += Math.min(50, responded.length * 25);
    reasons.push(`${responded.length} carrier response(s)`);
  }
  const approved = sups.filter((s) => s.status === 'approved' || s.status === 'partially_approved');
  if (approved.length > 0) {
    score += 25;
    reasons.push(`${approved.length} approved`);
  } else {
    reasons.push('No approvals recorded');
  }

  return factor('carrierResponseCoverage', 'Carrier Response Coverage', 15, clamp(score), reasons.join('; '));
}

// ---------------------------------------------------------------------------
// Compliance — status from the bundle's compliance signals.
// ---------------------------------------------------------------------------
export function scoreCompliance(bundle: ClaimBundle): RecoveryFactor {
  const sups = bundle.supplements;
  let score = 50; // neutral baseline — compliance not explicitly failed
  const reasons: string[] = [];

  const denied = sups.filter((s) => s.status === 'denied' || s.status === 'needs_revision');
  if (denied.length > 0) {
    score = Math.max(10, score - denied.length * 20);
    reasons.push(`${denied.length} denied/needs-revision`);
  }
  const approved = sups.filter((s) => s.status === 'approved' || s.status === 'partially_approved');
  if (approved.length > 0) {
    score = Math.min(100, score + approved.length * 15);
    reasons.push(`${approved.length} approved`);
  }
  if (bundle.documents.some((d) => d.isSigned)) {
    score = Math.min(100, score + 10);
    reasons.push('Signed documentation present');
  }
  if (reasons.length === 0) {
    reasons.push('No compliance issues detected');
  }

  return factor('compliance', 'Compliance', 15, clamp(score), reasons.join('; '));
}

// ---------------------------------------------------------------------------
// AI confidence — based on the strongest evidence-backed AI analysis.
// ---------------------------------------------------------------------------
export function scoreAIConfidence(bundle: ClaimBundle): RecoveryFactor {
  const strongLinks = bundle.evidenceLinks.filter((l) => Number(l.strengthScore ?? 0) >= 0.7).length;
  let score = 30; // baseline: no AI analysis yet
  const reasons: string[] = [];

  if (bundle.evidenceLinks.length > 0) {
    score += Math.min(40, bundle.evidenceLinks.length * 8 + strongLinks * 5);
    reasons.push(`${bundle.evidenceLinks.length} evidence link(s)`);
  } else {
    reasons.push('No evidence graph yet');
  }
  if (bundle.interviews.some((i) => i.status === 'completed')) {
    score += 15;
    reasons.push('Interview completed');
  }
  if (bundle.communications.length > 0) {
    score += 15;
    reasons.push('AI analysis material present');
  }
  if (bundle.documents.filter((d) => d.isEstimate).length > 0) {
    score += 10;
    reasons.push('Estimates available');
  }

  return factor('aiConfidence', 'AI Confidence', 10, clamp(score), reasons.join('; '));
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
export function computeRecoveryReadiness(bundle: ClaimBundle): RecoveryReadiness {
  const factors: RecoveryFactor[] = [
    scoreEvidenceQuality(bundle),
    scoreDocumentation(bundle),
    scorePolicyReferences(bundle),
    scoreCarrierResponseCoverage(bundle),
    scoreCompliance(bundle),
    scoreAIConfidence(bundle),
  ];
  const total = factors.reduce((sum, f) => sum + f.contribution, 0);
  const score = clamp(Math.round(total));

  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  const label = level === 'high' ? 'Strong' : level === 'medium' ? 'Moderate' : 'Weak';

  return { score, factors, level, label };
}

export function computeEvidenceCompleteness(bundle: ClaimBundle): number {
  const docs = bundle.documents;
  let score = 0;
  if (docs.length > 0) score += 25;
  if (docs.some((d) => d.isPhoto)) score += 25;
  if (docs.some((d) => d.isEstimate)) score += 25;
  if (bundle.evidenceLinks.length > 0 || bundle.interviews.some((i) => i.status === 'completed')) score += 25;
  return clamp(score);
}

export function computeDocumentationCompleteness(bundle: ClaimBundle): number {
  const docs = bundle.documents;
  let score = 0;
  if (docs.some((d) => d.isPolicy)) score += 25;
  if (docs.some((d) => d.isEstimate)) score += 25;
  if (docs.some((d) => d.isSigned)) score += 25;
  if (bundle.communications.length > 0) score += 25;
  return clamp(score);
}

export function computeClaimHealth(bundle: ClaimBundle): { score: number; level: 'critical' | 'at_risk' | 'healthy'; label: string } {
  const rr = computeRecoveryReadiness(bundle);
  const missingCount = bundle.documents.length === 0 ? 2 : 0; // signals below
  const openIssues = missingCount;
  const score = clamp(rr.score - openIssues * 5);
  const level = score >= 70 ? 'healthy' : score >= 40 ? 'at_risk' : 'critical';
  const label = level === 'healthy' ? 'Healthy' : level === 'at_risk' ? 'At Risk' : 'Critical';
  return { score, level, label };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function factor(key: FactorKey, label: string, weight: number, score: number, explanation: string): RecoveryFactor {
  return { key, label, weight, score, contribution: Math.round((weight * score) / 100), explanation };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
