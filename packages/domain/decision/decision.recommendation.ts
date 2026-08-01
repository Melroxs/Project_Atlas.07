// ==========================================================
// Atlas
// decision.recommendation.ts
// RecommendationBuilder — decision rule engine (SUP-001..003)
// ==========================================================
//
// Implements DECISION-004 rules:
//   SUP-001  Missing scope detection
//   SUP-002  Evidence requirement (>= 2 supporting sources)
//   SUP-003  Confidence threshold (>= 0.70)
//   CMP-001  Missing required documentation -> COMPLIANCE_WARNING
//   CMP-002  Recommendations must have traceable sources
//   REV-001  Conflicting evidence -> CLAIM_REVIEW
//
// Priority: Revenue Impact + Risk Level + Deadline Sensitivity

import type {
  ActionType,
  DecisionPipelineInput,
  DecisionPriority,
  DecisionType,
  EvidenceInput,
  MissingEvidence,
  Recommendation,
  RiskAssessment,
} from "./decision.types";

type DecisionPipelineRecommendations = DecisionPipelineInput["aiRecommendations"];

//
// INPUT
//

export interface RecommendationInput {
  claimId: string;
  claimNumber: string;
  evidence: EvidenceInput[];
  missingEvidence: MissingEvidence[];
  aiRecommendations: NonNullable<DecisionPipelineRecommendations>;
  contradictionCount: number;
  complianceViolations: string[];
  confidenceValue: number;
  risk: RiskAssessment;
}

const SUPPLEMENT_CONFIDENCE_THRESHOLD = 0.7;
const MIN_SUPPORTING_EVIDENCE = 2;

//
// RECOMMENDATION BUILDER
//

export class RecommendationBuilder {
  /**
   * Build structured recommendations from collected evidence.
   */
  build(input: RecommendationInput): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // SUP-001 / AI-derived supplement opportunities
    for (const rec of input.aiRecommendations ?? []) {
      recommendations.push(this.buildSupplementRecommendation(rec, input));
    }

    // CMP-001 / missing evidence -> DOCUMENT_REQUEST
    for (const gap of input.missingEvidence) {
      recommendations.push(this.buildDocumentRequest(gap, input));
    }

    // CMP-001 / compliance violations -> COMPLIANCE_WARNING
    for (const violation of input.complianceViolations) {
      recommendations.push(this.buildComplianceWarning(violation, input));
    }

    // REV-001 / contradictions -> CLAIM_REVIEW
    if (input.contradictionCount > 0) {
      recommendations.push(this.buildClaimReview(input));
    }

    // Fallback: if no supplement opportunity exists but confidence supports one,
    // and evidence is strong, recommend claim review for revenue recovery.
    if (
      recommendations.filter((r) => r.type === "SUPPLEMENT_OPPORTUNITY").length === 0 &&
      input.confidenceValue >= SUPPLEMENT_CONFIDENCE_THRESHOLD &&
      input.evidence.length >= MIN_SUPPORTING_EVIDENCE
    ) {
      recommendations.push({
        id: `rec-rev-${input.claimId}`,
        type: "CLAIM_REVIEW",
        title: "Revenue Recovery Review",
        description: `Claim ${input.claimNumber} has sufficient evidence for a potential scope recovery review.`,
        confidence: input.confidenceValue,
        priority: "MEDIUM",
        supportingEvidenceIds: input.evidence.slice(0, 3).map((e) => e.id),
        missingEvidenceIds: input.missingEvidence.map((m) => m.type),
        suggestedActions: ["REVIEW", "UPDATE_ESTIMATE"],
        requiresHumanApproval: true,
        rulesApplied: ["REV-001", "SUP-003"],
      });
    }

    return recommendations;
  }

  private buildSupplementRecommendation(
    rec: NonNullable<RecommendationInput["aiRecommendations"]>[number],
    input: RecommendationInput
  ): Recommendation {
    const supporting = input.evidence
      .filter((e) => e.id !== `ai-rec-${rec.id}` && e.confidenceScore >= 0.6)
      .map((e) => e.id);

    const amount = rec.amount ?? 0;
    const confidence = Math.min(input.confidenceValue, rec.confidence ?? input.confidenceValue);

    return {
      id: `rec-sup-${rec.id}`,
      type: "SUPPLEMENT_OPPORTUNITY",
      title: rec.description,
      description: `${rec.description}${amount ? ` — estimated value $${amount.toLocaleString()}` : ""}. ${rec.evidence?.length ? "Based on supporting evidence." : ""}`,
      confidence,
      priority: this.calculatePriority(amount, confidence, input.risk.score),
      supportingEvidenceIds: supporting,
      missingEvidenceIds: input.missingEvidence.map((m) => m.type),
      suggestedActions: this.suggestedActions(confidence, supporting.length),
      requiresHumanApproval: true, // financial recommendations always require approval
      rulesApplied: ["SUP-001", "SUP-002", "SUP-003"],
    };
  }

  private buildDocumentRequest(
    gap: MissingEvidence,
    input: RecommendationInput
  ): Recommendation {
    return {
      id: `rec-doc-${gap.type}-${input.claimId}`,
      type: "DOCUMENT_REQUEST",
      title: `Missing: ${gap.type} Evidence`,
      description: gap.description,
      confidence: input.confidenceValue,
      priority: "MEDIUM",
      supportingEvidenceIds: [],
      missingEvidenceIds: [gap.type],
      suggestedActions: ["REQUEST_DOCUMENT"],
      requiresHumanApproval: false,
      rulesApplied: ["CMP-001"],
    };
  }

  private buildComplianceWarning(
    violation: string,
    input: RecommendationInput
  ): Recommendation {
    return {
      id: `rec-cmp-${input.claimId}-${this.slug(violation)}`,
      type: "COMPLIANCE_WARNING",
      title: "Compliance Review Required",
      description: violation,
      confidence: input.confidenceValue,
      priority: this.compliancePriority(input.risk.score),
      supportingEvidenceIds: [],
      missingEvidenceIds: input.missingEvidence.map((m) => m.type),
      suggestedActions: ["REVIEW"],
      requiresHumanApproval: true,
      rulesApplied: ["CMP-001"],
    };
  }

  private buildClaimReview(input: RecommendationInput): Recommendation {
    return {
      id: `rec-rev-conflict-${input.claimId}`,
      type: "CLAIM_REVIEW",
      title: "Conflicting Evidence Detected",
      description: `${input.contradictionCount} source(s) disagree. Manual review required before any action.`,
      confidence: Math.max(0, input.confidenceValue - 0.2),
      priority: "HIGH",
      supportingEvidenceIds: input.evidence.map((e) => e.id),
      missingEvidenceIds: [],
      suggestedActions: ["REVIEW", "CONTACT_ADJUSTER"],
      requiresHumanApproval: true,
      rulesApplied: ["REV-001"],
    };
  }

  private calculatePriority(
    amount: number,
    confidence: number,
    riskScore: number
  ): DecisionPriority {
    if (amount > 25000 || (amount > 10000 && confidence >= 0.8)) return "HIGH";
    if (amount > 5000 || riskScore >= 50) return "MEDIUM";
    return "LOW";
  }

  private compliancePriority(riskScore: number): DecisionPriority {
    if (riskScore >= 75) return "CRITICAL";
    if (riskScore >= 50) return "HIGH";
    return "MEDIUM";
  }

  private suggestedActions(confidence: number, evidenceCount: number): ActionType[] {
    const actions: ActionType[] = ["REVIEW"];
    if (confidence >= SUPPLEMENT_CONFIDENCE_THRESHOLD && evidenceCount >= MIN_SUPPORTING_EVIDENCE) {
      actions.push("SUBMIT_SUPPLEMENT");
    } else {
      actions.push("REQUEST_DOCUMENT");
    }
    return actions;
  }

  private slug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24);
  }
}
