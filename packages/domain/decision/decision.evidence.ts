// ==========================================================
// Atlas
// decision.evidence.ts
// EvidenceCollector — evidence normalization & completeness
// ==========================================================
//
// Stage 2/3/4 of the Decision Pipeline:
//   - Collect evidence from claims, documents, interviews,
//     supplements, activity timeline, and AI recommendations.
//   - Normalize into EvidenceInput nodes.
//   - Evaluate completeness against required evidence types.
//   - Identify missing evidence.

import type {
  DecisionPipelineInput,
  EvidenceInput,
  EvidenceSummary,
  MissingEvidence,
} from "./decision.types";

//
// REQUIRED EVIDENCE TYPES
//
// Baseline evidence categories the pipeline expects for a decision.
// Evidence types map to document/claim/supplement categories.
//

export const REQUIRED_EVIDENCE_TYPES = [
  "POLICY",
  "ESTIMATE",
  "DOCUMENT",
  "PHOTO",
  "INTERVIEW",
];

//
// SOURCE CONFIDENCE DEFAULT
//

const DEFAULT_EVIDENCE_CONFIDENCE = 0.85;

//
// INPUT
//

export interface EvidenceCollectionResult {
  nodes: EvidenceInput[];
  summary: EvidenceSummary;
  missingEvidence: MissingEvidence[];
  contradictionCount: number;
}

//
// EVIDENCE COLLECTOR
//

export class EvidenceCollector {
  /**
   * Collect and normalize all evidence for a claim snapshot.
   */
  collect(input: DecisionPipelineInput): EvidenceCollectionResult {
    const nodes: EvidenceInput[] = [];

    // 1. Claim node — policy information
    if (input.claim.insuranceCompany || input.claim.policyNumber) {
      nodes.push({
        id: `claim-${input.claimId}`,
        nodeType: "CLAIM",
        sourceType: "SYSTEM",
        sourceId: input.claimId,
        title: `Claim ${input.claim.claimNumber}`,
        description: input.claim.description,
        confidenceScore: 1,
        metadata: {
          insuranceCompany: input.claim.insuranceCompany,
          policyNumber: input.claim.policyNumber,
          status: input.claim.status,
          causeOfLoss: input.claim.causeOfLoss,
          dateOfLoss: input.claim.dateOfLoss,
        },
      });
    }

    // 2. Documents -> DOCUMENT nodes
    for (const doc of input.documents) {
      nodes.push({
        id: `doc-${doc.id}`,
        nodeType: "DOCUMENT",
        sourceType: "DOCUMENT_AI",
        sourceId: doc.id,
        title: doc.name,
        confidenceScore: this.clamp01(doc.confidence ?? DEFAULT_EVIDENCE_CONFIDENCE),
        metadata: {
          mimeType: doc.mimeType,
          createdAt: doc.createdAt,
          category: doc.type,
        },
      });
    }

    // 3. Photos — documents with image mime types become PHOTO nodes
    const photos = input.documents.filter(
      (doc) =>
        doc.mimeType &&
        (doc.mimeType.startsWith("image/") ||
          doc.mimeType.includes("photo") ||
          doc.mimeType.includes("jpeg") ||
          doc.mimeType.includes("png") ||
          doc.type?.toUpperCase().includes("PHOTO"))
    );
    for (const photo of photos) {
      nodes.push({
        id: `photo-${photo.id}`,
        nodeType: "PHOTO",
        sourceType: "COMPUTER_VISION",
        sourceId: photo.id,
        title: photo.name,
        confidenceScore: this.clamp01(photo.confidence ?? 0.75),
      });
    }

    // 4. Supplements -> ESTIMATE_ITEM nodes (line items = estimate coverage)
    for (const supplement of input.supplements) {
      nodes.push({
        id: `estimate-${supplement.id}`,
        nodeType: "ESTIMATE_ITEM",
        sourceType: "USER",
        sourceId: supplement.id,
        title: `Supplement ${supplement.supplementNumber}`,
        description: `Status: ${supplement.status}; requested $${supplement.requestedAmount ?? 0}`,
        confidenceScore: 0.9,
        metadata: {
          status: supplement.status,
          requestedAmount: supplement.requestedAmount,
          approvedAmount: supplement.approvedAmount,
          lineItemCount: supplement.lineItems?.length ?? 0,
        },
      });
    }

    // 5. Interviews -> evidence of claim intelligence
    for (const interview of input.interviews) {
      nodes.push({
        id: `interview-${interview.id}`,
        nodeType: "DOCUMENT",
        sourceType: "USER",
        sourceId: interview.id,
        title: `Interview: ${interview.templateName || interview.status}`,
        description: `Status: ${interview.status}; progress: ${interview.progress ?? 0}%`,
        confidenceScore: interview.status === "completed" ? 0.95 : 0.5,
        metadata: {
          status: interview.status,
          progress: interview.progress,
          completedAt: interview.completedAt,
        },
      });
    }

    // 6. AI recommendations -> RECOMMENDATION nodes
    for (const rec of input.aiRecommendations ?? []) {
      nodes.push({
        id: `ai-rec-${rec.id}`,
        nodeType: "RECOMMENDATION",
        sourceType: "DOCUMENT_AI",
        sourceId: rec.id,
        title: rec.description,
        confidenceScore: this.clamp01(rec.confidence ?? 0.7),
        metadata: {
          category: rec.category,
          amount: rec.amount,
          evidence: rec.evidence,
        },
      });
    }

    // 7. Activity timeline -> relationship evidence (engagement signal)
    const meaningfulActivity = input.activity.filter((a) => a.type && a.description).length;
    if (meaningfulActivity > 0) {
      nodes.push({
        id: `activity-${input.claimId}`,
        nodeType: "DOCUMENT",
        sourceType: "SYSTEM",
        sourceId: input.claimId,
        title: `Activity Timeline (${meaningfulActivity} events)`,
        confidenceScore: 0.8,
        metadata: { eventCount: meaningfulActivity },
      });
    }

    return this.evaluate(nodes, input);
  }

  /**
   * Evaluate completeness of collected evidence.
   */
  evaluate(nodes: EvidenceInput[], input: DecisionPipelineInput): EvidenceCollectionResult {
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let confidenceTotal = 0;

    for (const node of nodes) {
      byType[node.nodeType] = (byType[node.nodeType] || 0) + 1;
      bySource[node.sourceType] = (bySource[node.sourceType] || 0) + 1;
      confidenceTotal += node.confidenceScore;
    }

    const presentTypes = Object.keys(byType).filter((t) => byType[t] > 0);

    // Map present node types onto required evidence categories
    const presentCoverage = new Set<string>();
    for (const type of presentTypes) {
      switch (type) {
        case "CLAIM":
        case "POLICY_REQUIREMENT":
          presentCoverage.add("POLICY");
          break;
        case "ESTIMATE_ITEM":
          presentCoverage.add("ESTIMATE");
          break;
        case "DOCUMENT":
          presentCoverage.add("DOCUMENT");
          break;
        case "PHOTO":
          presentCoverage.add("PHOTO");
          break;
        default:
          break;
      }
    }
    if (nodes.some((n) => n.title.startsWith("Interview"))) {
      presentCoverage.add("INTERVIEW");
    }

    const missingTypes = REQUIRED_EVIDENCE_TYPES.filter((t) => !presentCoverage.has(t));
    const coverage = REQUIRED_EVIDENCE_TYPES.length
      ? presentCoverage.size / REQUIRED_EVIDENCE_TYPES.length
      : 0;

    const summary: EvidenceSummary = {
      totalEvidence: nodes.length,
      byType,
      bySource,
      averageConfidence: nodes.length ? confidenceTotal / nodes.length : 0,
      coverage: Math.round(coverage * 1000) / 1000,
      requiredTypes: REQUIRED_EVIDENCE_TYPES,
      presentTypes: [...presentCoverage],
      missingTypes,
    };

    const missingEvidence: MissingEvidence[] = missingTypes.map((type) =>
      this.describeMissing(type, input)
    );

    // Contradictions: metadata-driven conflict detection (0 by default)
    const contradictionCount = input.documents.filter(
      (doc) => (doc as any).hasConflict === true || (doc as any).conflict === true
    ).length;

    return { nodes, summary, missingEvidence, contradictionCount };
  }

  private describeMissing(type: string, input: DecisionPipelineInput): MissingEvidence {
    switch (type) {
      case "POLICY":
        return {
          type,
          description: "Policy information (insurance company / policy number) is missing from the claim.",
          severity: "HIGH",
          impact: "HIGH",
          sourceHint: "Add policy declaration page or carrier policy number.",
        };
      case "ESTIMATE":
        return {
          type,
          description: "No estimate or supplement line items found for this claim.",
          severity: "HIGH",
          impact: "HIGH",
          sourceHint: "Upload Xactimate estimate or create a supplement.",
        };
      case "DOCUMENT":
        return {
          type,
          description: "No supporting documents have been uploaded for this claim.",
          severity: "MEDIUM",
          impact: "MEDIUM",
          sourceHint: "Upload contracts, invoices, or reports.",
        };
      case "PHOTO":
        return {
          type,
          description: "No photo evidence detected. Photos are required to substantiate damage.",
          severity: "HIGH",
          impact: "HIGH",
          sourceHint: "Add damage photos with metadata.",
        };
      case "INTERVIEW":
        return {
          type,
          description: "No completed interview found. Interview responses strengthen claim context.",
          severity: "MEDIUM",
          impact: "MEDIUM",
          sourceHint: "Complete the FNOL / damage interview.",
        };
      default:
        return {
          type,
          description: `Missing required evidence: ${type}`,
          severity: "MEDIUM",
          impact: "MEDIUM",
        };
    }
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
