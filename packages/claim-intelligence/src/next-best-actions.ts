// packages/claim-intelligence/src/next-best-actions.ts
import { ClaimBundle, NextBestAction } from './types';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

/**
 * Next Best Action engine.
 *
 * Instead of only asking "is this task possible?", it determines what the user
 * should do NEXT, with priority, reason, supporting evidence (documents,
 * photos, policy sections, estimate line items), confidence, and a full
 * explanation — every recommendation is explainable by traversing evidence.
 */
export function generateNextBestActions(bundle: ClaimBundle): NextBestAction[] {
  seq = 0; // deterministic ids per call
  const actions: NextBestAction[] = [];
  const docs = bundle.documents;
  const photos = docs.filter((d) => d.isPhoto);
  const policyDoc = docs.find((d) => d.isPolicy);
  const estimates = docs.filter((d) => d.isEstimate);
  const sups = bundle.supplements;
  const openSups = sups.filter((s) => !['approved', 'denied', 'closed'].includes(s.status));
  // Line items contributed to recovery (from supplements' lineItems, the real source)
  const supplementLineItems = sups.flatMap((s) =>
    (s.lineItems || []).map((li) => li.description || `line item`)
  );

  const evidenceFor = (ids: string[]) =>
    ids.map((id) => docs.find((d) => d.id === id)?.fileName || id);

  // ---- 1. No photos → upload roof/damage photos (spec example) ----
  if (photos.length === 0) {
    actions.push({
      id: nextId('nba'),
      priority: 'high',
      title: 'Upload damage photos',
      reason: 'No photos are attached to this claim. Carriers require photo documentation to support estimates.',
      requiredAction: 'Upload roof/interior damage photos showing the reported loss.',
      confidence: 0.95,
      supportingEvidence: { documentIds: [], photoIds: [], policySections: ['Photo Documentation Requirements'], estimateLineItems: [] },
      relatedSection: 'photos',
      explanation: {
        why: 'Photos are the primary evidence carriers use to verify a loss. A claim with zero photos has the weakest evidence position.',
        evidenceUsed: [],
        documentsUsed: [],
        photosReferenced: [],
        policySectionsReferenced: ['Photo Documentation Requirements'],
        lineItemsContributed: [],
      },
    });
  }

  // ---- 2. Carrier estimate missing (spec example) ----
  const carrierEstimate = estimates.find((d) => d.isCarrierDocument);
  if (!carrierEstimate && estimates.length > 0) {
    actions.push({
      id: nextId('nba'),
      priority: 'high',
      title: 'Upload the carrier estimate',
      reason: 'Only contractor estimates are on file. The carrier estimate is required to compute the difference and build a supplement.',
      requiredAction: 'Upload the adjuster/Xactimate estimate from the carrier.',
      confidence: 0.9,
      supportingEvidence: {
        documentIds: estimates.map((d) => d.id),
        photoIds: photos.map((d) => d.id),
        policySections: ['Estimate Comparison'],
        estimateLineItems: [],
      },
      relatedSection: 'estimates',
      explanation: {
        why: 'A supplement is the difference between what the carrier approved and what the contractor requires. Without the carrier estimate the difference is unknown.',
        evidenceUsed: evidenceFor(estimates.map((d) => d.id)),
        documentsUsed: estimates.map((d) => d.fileName),
        photosReferenced: photos.map((d) => d.fileName),
        policySectionsReferenced: ['Estimate Comparison'],
        lineItemsContributed: [],
      },
    });
  } else if (estimates.length === 0) {
    actions.push({
      id: nextId('nba'),
      priority: 'high',
      title: 'Upload estimates',
      reason: 'No estimates are on file. Recovery value cannot be assessed without an approved carrier estimate.',
      requiredAction: 'Upload the carrier estimate and the contractor estimate.',
      confidence: 0.9,
      supportingEvidence: { documentIds: [], photoIds: photos.map((d) => d.id), policySections: ['Estimate Requirements'], estimateLineItems: [] },
      relatedSection: 'estimates',
      explanation: {
        why: 'Estimates are the financial core of the claim. Without them, no recovery amount can be computed.',
        evidenceUsed: [],
        documentsUsed: [],
        photosReferenced: photos.map((d) => d.fileName),
        policySectionsReferenced: ['Estimate Requirements'],
        lineItemsContributed: [],
      },
    });
  }

  // ---- 3. Policy not uploaded (spec example) ----
  if (!policyDoc && !bundle.policyNumber) {
    actions.push({
      id: nextId('nba'),
      priority: 'medium',
      title: 'Upload the policy',
      reason: 'The policy has not been uploaded. Policy analysis and coverage verification cannot run.',
      requiredAction: 'Upload the policy document (or add the policy number).',
      confidence: 0.85,
      supportingEvidence: { documentIds: [], photoIds: [], policySections: [], estimateLineItems: [] },
      relatedSection: 'insurance',
      explanation: {
        why: 'Policy intelligence is only possible when the policy document is available for analysis.',
        evidenceUsed: [],
        documentsUsed: [],
        photosReferenced: [],
        policySectionsReferenced: [],
        lineItemsContributed: [],
      },
    });
  }

  // ---- 4. Engineering report recommended (spec example) ----
  if (bundle.estimatedValue && Number(bundle.estimatedValue) >= 10000 && !docs.some((d) => /engineer|structural/i.test(d.fileName))) {
    actions.push({
      id: nextId('nba'),
      priority: 'medium',
      title: 'Obtain an engineering report',
      reason: `Estimated value is ${bundle.estimatedValue}. High-value claims often require an engineer's report to substantiate structural damage.`,
      requiredAction: 'Schedule an engineering inspection and upload the report.',
      confidence: 0.7,
      supportingEvidence: { documentIds: estimates.map((d) => d.id), photoIds: photos.map((d) => d.id), policySections: ['Engineering Requirements'], estimateLineItems: [] },
      relatedSection: 'inspection',
      explanation: {
        why: 'Above the coverage threshold, carriers routinely request an engineering opinion before approving structural line items.',
        evidenceUsed: evidenceFor(estimates.map((d) => d.id)),
        documentsUsed: estimates.map((d) => d.fileName),
        photosReferenced: photos.map((d) => d.fileName),
        policySectionsReferenced: ['Engineering Requirements'],
        lineItemsContributed: [],
      },
    });
  }

  // ---- 5. No carrier response on open supplements → follow up (spec example) ----
  const waiting = openSups.filter((s) => !s.responseDate);
  if (waiting.length > 0) {
    const oldest = waiting.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    actions.push({
      id: nextId('nba'),
      priority: 'high',
      title: 'Follow up on carrier response',
      reason: `${oldest.supplementNumber} has no carrier response. Delays on open supplements stall recovery.`,
      requiredAction: 'Contact the adjuster for a status update on ' + oldest.supplementNumber + '.',
      confidence: 0.8,
      supportingEvidence: { documentIds: estimates.map((d) => d.id), photoIds: photos.map((d) => d.id), policySections: [], estimateLineItems: [] },
      relatedSection: 'carrier_responses',
      explanation: {
        why: 'Supplement recovery only completes when the carrier responds. Unanswered submissions are the #1 source of recovery delay.',
        evidenceUsed: [`${oldest.supplementNumber} (${oldest.status})`],
        documentsUsed: estimates.map((d) => d.fileName),
        photosReferenced: photos.map((d) => d.fileName),
        policySectionsReferenced: [],
        lineItemsContributed: [],
      },
    });
  }

  // ---- 6. Generate supplement (spec example) — enough evidence, no existing supplement ----
  const enoughForSupplement =
    (carrierEstimate || estimates.length > 0) && photos.length > 0 && docs.length >= 2;
  if (enoughForSupplement && openSups.length === 0) {
    actions.push({
      id: nextId('nba'),
      priority: 'medium',
      title: 'Generate supplement',
      reason: 'Evidence is sufficient (estimates + photos + documents) and no open supplement exists. Recovery value is unrealized.',
      requiredAction: 'Run the supplement generation workflow to capture the difference.',
      confidence: 0.85,
      supportingEvidence: { documentIds: estimates.map((d) => d.id), photoIds: photos.map((d) => d.id), policySections: ['Supplement Requirements'], estimateLineItems: supplementLineItems },
      relatedSection: 'supplements',
      explanation: {
        why: 'When the contractor estimate exceeds the carrier estimate, the difference is recoverable through a supplement.',
        evidenceUsed: evidenceFor(estimates.map((d) => d.id)),
        documentsUsed: estimates.map((d) => d.fileName),
        photosReferenced: photos.map((d) => d.fileName),
        policySectionsReferenced: ['Supplement Requirements'],
        lineItemsContributed: supplementLineItems,
      },
    });
  }

  // ---- 7. Schedule reinspection (spec example) ----
  if (bundle.interviews.length > 0 && bundle.interviews.every((i) => i.status !== 'completed') && photos.length === 0) {
    actions.push({
      id: nextId('nba'),
      priority: 'low',
      title: 'Schedule a reinspection',
      reason: 'The inspection is incomplete and no photos exist, so damage scope is unverified.',
      requiredAction: 'Schedule a reinspection to capture damage scope and photos.',
      confidence: 0.6,
      supportingEvidence: { documentIds: [], photoIds: [], policySections: ['Inspection Requirements'], estimateLineItems: [] },
      relatedSection: 'inspection',
      explanation: {
        why: 'An incomplete inspection with no photo evidence leaves the damage scope unverified, blocking accurate estimates.',
        evidenceUsed: [],
        documentsUsed: [],
        photosReferenced: [],
        policySectionsReferenced: ['Inspection Requirements'],
        lineItemsContributed: [],
      },
    });
  }

  // ---- 8. Missing signatures → block submission (health-critical) ----
  if (!docs.some((d) => d.isSigned) && (carrierEstimate || estimates.length > 0)) {
    actions.push({
      id: nextId('nba'),
      priority: 'critical',
      title: 'Obtain signed documents',
      reason: 'No signed documents are on file. Carriers reject unsigned estimates and supplements.',
      requiredAction: 'Collect signatures on the estimate and contract documents.',
      confidence: 0.9,
      supportingEvidence: { documentIds: estimates.map((d) => d.id), photoIds: [], policySections: ['Signature Requirements'], estimateLineItems: [] },
      relatedSection: 'documents',
      explanation: {
        why: 'Unsigned submissions are rejected outright by carriers, causing rework and delay.',
        evidenceUsed: evidenceFor(estimates.map((d) => d.id)),
        documentsUsed: estimates.map((d) => d.fileName),
        photosReferenced: [],
        policySectionsReferenced: ['Signature Requirements'],
        lineItemsContributed: [],
      },
    });
  }

  return actions.sort((a, b) => rank(a.priority) - rank(b.priority));
}

function rank(p: NextBestAction['priority']): number {
  return p === 'critical' ? 0 : p === 'high' ? 1 : p === 'medium' ? 2 : 3;
}
