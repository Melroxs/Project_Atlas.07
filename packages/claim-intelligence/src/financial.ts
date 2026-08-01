// packages/claim-intelligence/src/financial.ts
import { ClaimBundle, FinancialIntelligence, FinancialFigure, ClaimBundleDocument } from './types';

/**
 * Financial Intelligence Engine.
 *
 * Tracks: original estimate, carrier approved amount, contractor estimate,
 * supplement value, recovered revenue, outstanding revenue, potential
 * recovery, estimated recovery opportunity, and a confidence score.
 *
 * NEVER fabricates values — every figure is derived from real claim data and
 * carries its source + evidence so the projection is explainable.
 */

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function figure(key: string, label: string, value: number | null, source: string, evidence: string[], confidence: number): FinancialFigure {
  return { key, label, value, source, evidence, confidence };
}

export function computeFinancialIntelligence(bundle: ClaimBundle): FinancialIntelligence {
  const claim = bundle;
  const originalEstimate = num(claim.estimatedValue);
  const approvedOnClaim = num(claim.approvedValue);

  const sups = bundle.supplements;
  const supplementValue = sups.reduce((sum, s) => sum + (num(s.requestedAmount) ?? 0), 0);
  const recoveredFromSups = sups.reduce((sum, s) => sum + (num(s.approvedAmount) ?? 0), 0);

  // Carrier approved: prefer the claim-level approved value; otherwise sum of
  // supplement approvals.
  const carrierApprovedAmount =
    approvedOnClaim != null ? approvedOnClaim : recoveredFromSups > 0 ? recoveredFromSups : null;

  // Contractor estimate (total scope): the initial estimate plus the REQUESTED
  // supplement value. Using requested (not approved) scope avoids double
  // counting — approved amounts already live in carrierApprovedAmount and
  // recoveredRevenue, and approvedValue may already include supplement
  // approvals.
  const contractorEstimate =
    originalEstimate != null ? originalEstimate + supplementValue : supplementValue > 0 ? supplementValue : null;

  const recoveredRevenue = recoveredFromSups;
  const outstandingRevenue = Math.max(0, supplementValue - recoveredRevenue);

  // Potential recovery: contractor scope minus what the carrier approved.
  const potentialRecovery =
    contractorEstimate != null && carrierApprovedAmount != null
      ? Math.max(0, contractorEstimate - carrierApprovedAmount)
      : null;

  // Confidence: how much of the picture is backed by real numbers.
  let confidenceSignals = 0;
  let confidenceTotal = 0;
  const consider = (present: boolean) => {
    confidenceTotal += 1;
    if (present) confidenceSignals += 1;
  };
  consider(originalEstimate != null);
  consider(carrierApprovedAmount != null);
  consider(sups.length > 0);
  consider(bundle.documents.some((d) => d.isEstimate));
  consider(recoveredFromSups > 0);
  const confidenceScore = Math.round((confidenceSignals / Math.max(1, confidenceTotal)) * 100);

  const estimatedRecoveryOpportunity =
    potentialRecovery != null ? Math.round(potentialRecovery * (confidenceScore / 100) * 100) / 100 : null;

  const evidenceFor = (pred: (d: ClaimBundleDocument) => boolean) =>
    bundle.documents.filter((d) => !!pred(d)).map((d) => d.fileName);

  const figures: FinancialFigure[] = [
    figure(
      'originalEstimate',
      'Original Estimate',
      originalEstimate,
      originalEstimate != null ? 'claim.estimated_value' : 'not provided',
      evidenceFor((d) => !!d.isEstimate),
      originalEstimate != null ? 1 : 0
    ),
    figure(
      'carrierApprovedAmount',
      'Carrier Approved Amount',
      carrierApprovedAmount,
      approvedOnClaim != null
        ? 'claim.approved_value'
        : recoveredFromSups > 0
          ? 'sum of supplement.approved_amount'
          : 'not provided',
      sups.filter((s) => num(s.approvedAmount) != null).map((s) => s.supplementNumber),
      carrierApprovedAmount != null ? 0.95 : 0
    ),
    figure(
      'contractorEstimate',
      'Contractor Estimate (Total Scope)',
      contractorEstimate,
      'derived: claim.estimated_value + requested supplements',
      evidenceFor((d) => !!d.isEstimate),
      contractorEstimate != null ? 0.9 : 0
    ),
    figure(
      'supplementValue',
      'Supplement Value (Requested)',
      supplementValue,
      'sum of supplement.requested_amount',
      sups.map((s) => s.supplementNumber),
      sups.length > 0 ? 1 : 0
    ),
    figure(
      'recoveredRevenue',
      'Recovered Revenue',
      recoveredRevenue,
      'sum of supplement.approved_amount',
      sups.filter((s) => num(s.approvedAmount) != null).map((s) => s.supplementNumber),
      recoveredRevenue > 0 ? 1 : 0
    ),
    figure(
      'outstandingRevenue',
      'Outstanding Revenue',
      outstandingRevenue,
      'derived: supplement value − recovered revenue',
      sups.filter((s) => num(s.requestedAmount) != null).map((s) => s.supplementNumber),
      supplementValue > 0 ? 0.9 : 0
    ),
    figure(
      'potentialRecovery',
      'Potential Recovery',
      potentialRecovery,
      potentialRecovery != null ? 'derived: contractor scope − carrier approved' : 'insufficient data',
      evidenceFor((d) => !!d.isEstimate),
      potentialRecovery != null ? confidenceScore / 100 : 0
    ),
    figure(
      'estimatedRecoveryOpportunity',
      'Estimated Recovery Opportunity',
      estimatedRecoveryOpportunity,
      'derived: potential recovery × confidence',
      [],
      confidenceScore / 100
    ),
  ];

  return {
    originalEstimate,
    carrierApprovedAmount,
    contractorEstimate,
    supplementValue,
    recoveredRevenue,
    outstandingRevenue,
    potentialRecovery,
    estimatedRecoveryOpportunity,
    confidenceScore,
    figures,
  };
}
