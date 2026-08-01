// packages/claim-intelligence/src/revenue-opportunities.ts
import { ClaimBundle, RevenueOpportunity, RevenueOpportunityType } from './types';
import { computeFinancialIntelligence } from './financial';

let seq = 0;
const nextId = () => `opp-${++seq}`;

/**
 * Revenue Opportunity Detection.
 *
 * Automatically detects: missing estimate items, pricing discrepancies,
 * code-related opportunities, matching opportunities, overhead & profit
 * opportunities, documentation deficiencies, and potential supplement value.
 * Every opportunity exposes the estimated value, confidence, evidence, and
 * required action — no opaque financial recommendations.
 */
export function detectRevenueOpportunities(bundle: ClaimBundle): RevenueOpportunity[] {
  seq = 0;
  const opportunities: RevenueOpportunity[] = [];
  const financial = computeFinancialIntelligence(bundle);
  const docs = bundle.documents;
  const estimates = docs.filter((d) => d.isEstimate);
  const photos = docs.filter((d) => d.isPhoto);
  const sups = bundle.supplements;

  const allLineItems = sups.flatMap((s) => s.lineItems || []);
  const allItemText = allLineItems
    .map((li) => `${li.description || ''}`.toLowerCase())
    .filter(Boolean);

  // ---- 1. Missing estimate items -------------------------------------------
  if (estimates.length > 0 && allLineItems.length === 0) {
    opportunities.push({
      id: nextId(),
      type: 'missing_estimate_items',
      title: 'Estimates have no line items',
      detail: 'Estimate documents are on file but no line-item detail has been recorded. Recovery value cannot be itemized without line items.',
      estimatedValue: financial.potentialRecovery,
      confidence: 0.6,
      priority: 'high',
      evidence: estimates.map((d) => d.fileName),
      requiredAction: 'Import or record the line items from the estimate documents.',
      explanation: {
        why: 'Line items are the unit of recovery — carriers approve line items, not documents. Without them, no supplement can be priced.',
        documentsUsed: estimates.map((d) => d.fileName),
        estimateItemsContributed: [],
        policyReferencesUsed: [],
      },
    });
  }

  // ---- 2. Pricing discrepancy (requested vs approved) -----------------------
  const gaps = sups
    .filter((s) => {
      const req = Number(s.requestedAmount ?? 0);
      const app = Number(s.approvedAmount ?? 0);
      return req > app && app > 0;
    })
    .map((s) => ({
      supplement: s.supplementNumber,
      gap: Number(s.requestedAmount ?? 0) - Number(s.approvedAmount ?? 0),
    }));
  if (gaps.length > 0) {
    const totalGap = gaps.reduce((sum, g) => sum + g.gap, 0);
    opportunities.push({
      id: nextId(),
      type: 'pricing_discrepancy',
      title: 'Pricing discrepancy on approved supplements',
      detail: `${gaps.length} supplement(s) were approved below the requested amount (total shortfall $${totalGap.toLocaleString()}).`,
      estimatedValue: totalGap,
      confidence: 0.85,
      priority: 'high',
      evidence: gaps.map((g) => `${g.supplement} ($${g.gap.toLocaleString()})`),
      requiredAction: 'Review the denied or reduced line items and resubmit with supporting evidence.',
      explanation: {
        why: 'The approved amount falls short of the requested amount — the difference is recoverable when substantiated.',
        documentsUsed: [],
        estimateItemsContributed: gaps.map((g) => g.supplement),
        policyReferencesUsed: [],
      },
    });
  }

  // ---- 3. Code-related opportunities ----------------------------------------
  const codeMentioned = allItemText.some((t) => t.includes('code') || /xactimate|\bRCV\b|\bACV\b/.test(t));
  if (estimates.length > 0 && !codeMentioned && allLineItems.length > 0) {
    opportunities.push({
      id: nextId(),
      type: 'code_related',
      title: 'No code-change / line-code coverage identified',
      detail: 'Line items do not reference construction codes, Xactimate codes, RCV/ACV, or code-upgrade items. Code-related scope is a common recoverable line.',
      estimatedValue: financial.potentialRecovery != null ? Math.round(financial.potentialRecovery * 0.1) : null,
      confidence: 0.4,
      priority: 'medium',
      evidence: allLineItems.slice(0, 10).map((li) => li.description || 'line item'),
      requiredAction: 'Review the estimate for code upgrades, RCV/ACV differentials, and code-related line items.',
      explanation: {
        why: 'Code upgrades (e.g., building code compliance) are frequently approved by carriers when documented, and are commonly omitted.',
        documentsUsed: estimates.map((d) => d.fileName),
        estimateItemsContributed: allLineItems.slice(0, 10).map((li) => li.description || 'line item'),
        policyReferencesUsed: ['Ordinance or Law / Building Code coverage'],
      },
    });
  }

  // ---- 4. Matching opportunity (photos vs estimate) --------------------------
  if (estimates.length > 0 && photos.length > 0 && photos.length < 10) {
    opportunities.push({
      id: nextId(),
      type: 'matching_opportunity',
      title: 'Limited photo coverage for estimate scope',
      detail: `Only ${photos.length} photo(s) support ${estimates.length} estimate document(s). Sparse photo evidence weakens negotiation and can be rejected.`,
      estimatedValue: null,
      confidence: 0.5,
      priority: 'medium',
      evidence: photos.map((d) => d.fileName),
      requiredAction: 'Upload damage photos matching each estimate line item.',
      explanation: {
        why: 'Carriers discount or deny scope when photo evidence does not match the estimated damage.',
        documentsUsed: estimates.map((d) => d.fileName),
        estimateItemsContributed: [],
        policyReferencesUsed: ['Photo Documentation Requirements'],
      },
    });
  }

  // ---- 5. Overhead & profit opportunity -------------------------------------
  const hasOp = allItemText.some((t) => t.includes('overhead') || t.includes('profit') || t.includes('o&p') || t.includes('oop'));
  if (estimates.length > 0 && allLineItems.length > 0 && !hasOp) {
    const opValue = financial.contractorEstimate != null ? Math.round(financial.contractorEstimate * 0.1 * 100) / 100 : null;
    opportunities.push({
      id: nextId(),
      type: 'overhead_profit',
      title: 'Overhead & Profit not itemized',
      detail: 'No overhead & profit (O&P) line item found. O&P is a standard recoverable markup in restoration estimates.',
      estimatedValue: opValue,
      confidence: 0.55,
      priority: 'medium',
      evidence: allLineItems.slice(0, 10).map((li) => li.description || 'line item'),
      requiredAction: 'Add the O&P line item to the supplement if applicable per policy.',
      explanation: {
        why: 'O&P (typically 10% + 10%) applies when the contractor does not self-perform all trades; it is a routine recovery line.',
        documentsUsed: estimates.map((d) => d.fileName),
        estimateItemsContributed: allLineItems.slice(0, 10).map((li) => li.description || 'line item'),
        policyReferencesUsed: ['Overhead & Profit provisions'],
      },
    });
  }

  // ---- 6. Documentation deficiency ------------------------------------------
  const missing: string[] = [];
  if (!bundle.policyNumber && !docs.some((d) => d.isPolicy)) missing.push('Policy');
  if (!bundle.dateOfLoss) missing.push('Date of loss');
  if (!bundle.insuranceCompany) missing.push('Carrier');
  if (missing.length > 0) {
    opportunities.push({
      id: nextId(),
      type: 'documentation_deficiency',
      title: `Missing documentation: ${missing.join(', ')}`,
      detail: 'Recovery is delayed while required documentation is absent from the claim record.',
      estimatedValue: null,
      confidence: 0.9,
      priority: 'critical',
      evidence: missing,
      requiredAction: `Record the missing item(s): ${missing.join(', ')}.`,
      explanation: {
        why: 'Carriers will not adjudicate claims missing policy, loss date, or carrier identity — these block every downstream step.',
        documentsUsed: [],
        estimateItemsContributed: [],
        policyReferencesUsed: missing.includes('Policy') ? ['Policy document'] : [],
      },
    });
  }

  // ---- 7. Potential supplement -------------------------------------------------
  const carrierApproved = financial.carrierApprovedAmount;
  const potential = financial.potentialRecovery;
  const hasOpenSupplement = sups.some((s) => !['approved', 'denied', 'closed'].includes(s.status));
  if (potential != null && potential > 0 && !hasOpenSupplement) {
    opportunities.push({
      id: nextId(),
      type: 'potential_supplement',
      title: 'Unrealized supplement potential',
      detail: `Contractor scope exceeds carrier approval by $${potential.toLocaleString()} with no open supplement.`,
      estimatedValue: potential,
      confidence: 0.75,
      priority: 'high',
      evidence: [
        `Carrier approved: ${carrierApproved != null ? `$${carrierApproved.toLocaleString()}` : 'unknown'}`,
        `Contractor scope: $${financial.contractorEstimate?.toLocaleString() ?? 'unknown'}`,
      ],
      requiredAction: 'Generate a supplement to capture the difference before the claim closes.',
      explanation: {
        why: 'The difference between contractor scope and carrier approval is the core recoverable value of a supplement.',
        documentsUsed: estimates.map((d) => d.fileName),
        estimateItemsContributed: allLineItems.slice(0, 10).map((li) => li.description || 'line item'),
        policyReferencesUsed: ['Supplement / Additional Payment provisions'],
      },
    });
  }

  return opportunities.sort((a, b) => rank(a.priority) - rank(b.priority));
}

function rank(p: RevenueOpportunity['priority']): number {
  return p === 'critical' ? 0 : p === 'high' ? 1 : p === 'medium' ? 2 : 3;
}
