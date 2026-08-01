// packages/claim-intelligence/src/engine.ts
import { ClaimBundle, ClaimIntelligenceModel } from './types';
import {
  computeRecoveryReadiness,
  computeEvidenceCompleteness,
  computeDocumentationCompleteness,
  computeClaimHealth,
} from './scoring';
import { generateNextBestActions } from './next-best-actions';
import { detectRisks, detectMissingInformation } from './health-monitor';
import { buildKnowledgeGraph } from './knowledge-graph';
import { extractAll } from './communications';

/**
 * The Claim Intelligence Engine.
 *
 * Continuously analyzes a claim from its data bundle and maintains a live
 * intelligence model. It is pure and synchronous — callers (API or dashboard)
 * supply a ClaimBundle and receive the full model. Re-running after any change
 * yields fresh scores, actions, and graph with no manual refresh.
 */
export function analyzeClaim(bundle: ClaimBundle): ClaimIntelligenceModel {
  const recoveryReadiness = computeRecoveryReadiness(bundle);
  const health = computeClaimHealth(bundle);
  const evidenceCompleteness = computeEvidenceCompleteness(bundle);
  const documentationCompleteness = computeDocumentationCompleteness(bundle);

  const hasPolicyDoc = bundle.documents.some((d) => d.isPolicy);
  const policyAnalysisStatus =
    hasPolicyDoc || bundle.policyNumber
      ? bundle.documents.filter((d) => d.isPolicy).length > 0
        ? 'analyzed'
        : 'partial'
      : 'not_applicable';

  const risks = detectRisks(bundle);
  const hasCritical = risks.some((r) => r.severity === 'critical');
  const complianceStatus = hasCritical
    ? 'attention'
    : risks.some((r) => r.severity === 'high')
      ? 'attention'
      : 'passed';

  const nextBestActions = generateNextBestActions(bundle);
  const knowledgeGraph = buildKnowledgeGraph(bundle);

  // AI confidence: average of evidence-linked confidence signals, surfaced
  // as 0-100 and reused in the readiness factor.
  const strongLinks = bundle.evidenceLinks.filter((l) => Number(l.strengthScore ?? 0) >= 0.7).length;
  const aiConfidence = Math.max(
    30,
    Math.min(95, 30 + strongLinks * 12 + (bundle.interviews.some((i) => i.status === 'completed') ? 15 : 0))
  );

  return {
    claimId: bundle.claimId,
    claimNumber: bundle.claimNumber,
    analyzedAt: new Date().toISOString(),
    health,
    recoveryReadiness,
    evidenceCompleteness,
    documentationCompleteness,
    policyAnalysisStatus,
    complianceStatus,
    aiConfidence,
    missingInformation: detectMissingInformation(bundle),
    openRisks: risks,
    nextBestActions,
    knowledgeGraph,
  };
}

// Re-export extraction for convenience (Communications Intelligence).
export { extractAll as extractCommunicationsIntelligence };
