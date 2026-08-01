// packages/claim-intelligence/src/digital-twin.ts
import {
  ClaimBundle,
  DigitalTwin,
  ClaimIntelligenceModel,
  LifecycleInfo,
  FinancialIntelligence,
} from './types';
import { buildKnowledgeGraph } from './knowledge-graph';

/**
 * Claim Digital Twin — the persistent digital representation of a claim.
 *
 * Aggregates customer, property, policy, carrier, timeline, communications,
 * photos, documents, inspections, estimates, evidence graph, knowledge graph,
 * AI insights, compliance, financial metrics, recommendations, supplements,
 * and carrier responses into ONE object that AI decisions operate on.
 */
export function buildDigitalTwin(
  bundle: ClaimBundle,
  model: ClaimIntelligenceModel,
  lifecycle: LifecycleInfo,
  financial: FinancialIntelligence
): DigitalTwin {
  const docs = bundle.documents;
  const photos = docs.filter((d) => d.isPhoto);
  const estimates = docs.filter((d) => d.isEstimate);
  const sups = bundle.supplements;
  const responded = sups.filter((s) => s.responseDate);

  const byType: Record<string, number> = {};
  for (const d of docs) {
    const key = d.isPhoto ? 'photo' : d.isPolicy ? 'policy' : d.isEstimate ? 'estimate' : 'document';
    byType[key] = (byType[key] || 0) + 1;
  }

  const reviewDays = sups
    .filter((s) => s.submissionDate && s.responseDate)
    .map((s) => ({
      supplement: s.supplementNumber,
      days: Math.max(
        0,
        Math.round(
          (new Date(s.responseDate!).getTime() - new Date(s.submissionDate!).getTime()) / 86400000
        )
      ),
    }));

  const comms = bundle.communications;
  const firstComm = comms.length > 0 ? comms[0].createdAt : null;
  const lastComm = comms.length > 0 ? comms[comms.length - 1].createdAt : null;

  return {
    claimId: bundle.claimId,
    claimNumber: bundle.claimNumber,
    generatedAt: new Date().toISOString(),
    customer: {
      name: bundle.customerName ?? null,
      email: bundle.customerEmail ?? null,
      phone: bundle.customerPhone ?? null,
    },
    property: bundle.property
      ? {
          address: bundle.property.address ?? null,
          city: bundle.property.city ?? null,
          state: bundle.property.state ?? null,
          zip: bundle.property.zip ?? null,
        }
      : null,
    policy: {
      policyNumber: bundle.policyNumber ?? null,
      deductible: bundle.deductible ?? null,
      analysisStatus: model.policyAnalysisStatus,
      documents: docs.filter((d) => d.isPolicy).length,
    },
    carrier: {
      name: bundle.insuranceCompany ?? null,
      responses: responded.length,
      latestResponseAt: responded.length > 0 ? (responded[responded.length - 1].responseDate ?? null) : null,
      reviewDays,
    },
    claim: {
      entryPoint: bundle.entryPoint ?? 'new_claim',
      status: bundle.status,
      dateOfLoss: bundle.dateOfLoss ?? null,
      dateReported: bundle.dateReported ?? null,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
      description: bundle.description ?? null,
    },
    timeline: {
      communications: comms.length,
      events: comms.length + lifecycle.recommendedActions.length,
      first: firstComm,
      last: lastComm,
    },
    photos: { count: photos.length, ids: photos.map((d) => d.id) },
    documents: { count: docs.length, byType },
    inspections: {
      count: bundle.interviews.length,
      completed: bundle.interviews.filter((i) => i.status === 'completed').length,
    },
    estimates: { count: estimates.length, names: estimates.map((d) => d.fileName) },
    evidenceGraph: {
      links: bundle.evidenceLinks.length,
      strongLinks: bundle.evidenceLinks.filter((l) => Number(l.strengthScore ?? 0) >= 0.7).length,
    },
    knowledgeGraph: buildKnowledgeGraph(bundle),
    aiInsights: {
      healthScore: model.health.score,
      healthLevel: model.health.level,
      recoveryReadiness: model.recoveryReadiness.score,
      aiConfidence: model.aiConfidence,
      complianceStatus: model.complianceStatus,
      openRisks: model.openRisks,
      missingInformation: model.missingInformation,
    },
    financial,
    supplements: {
      count: sups.length,
      submitted: sups.filter((s) => s.status === 'submitted').length,
      approved: sups.filter((s) => s.status === 'approved' || s.status === 'partially_approved').length,
      totalRequested: sups.reduce((sum, s) => sum + Number(s.requestedAmount ?? 0), 0),
      totalApproved: sups.reduce((sum, s) => sum + Number(s.approvedAmount ?? 0), 0),
    },
    carrierResponses: {
      count: responded.length,
      latest: responded.length > 0 ? (responded[responded.length - 1].responseDate ?? null) : null,
    },
    recommendations: {
      nextBestActions: model.nextBestActions.length,
      operational: 0, // filled by the orchestrator (needs ops model)
    },
  };
}
