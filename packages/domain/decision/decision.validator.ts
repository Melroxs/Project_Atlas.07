// ==========================================================
// Atlas
// decision.validator.ts
// RecommendationValidator — validates recommendations before
// they are passed to compliance validation / human review.
// ==========================================================
//
// Implements DECISION-004 validation rules:
//   SUP-002  Every supplement recommendation requires
//            >= 2 supporting evidence sources.
//   SUP-003  Supplement recommendations require confidence >= 0.70.
//   CMP-002  Recommendations must have traceable evidence sources.
//   REV-001  Contradictions require review.

import type {
  EvidenceInput,
  Recommendation,
  RecommendationValidationResult,
} from "./decision.types";

export const SUPPLEMENT_CONFIDENCE_THRESHOLD = 0.7;
export const MIN_SUPPORTING_EVIDENCE = 2;

//
// VALIDATOR
//

export class RecommendationValidator {
  /**
   * Validate a set of recommendations.
   */
  validate(
    recommendations: Recommendation[],
    evidence: EvidenceInput[],
    contradictionCount: number
  ): RecommendationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validRecommendations: Recommendation[] = [];

    for (const rec of recommendations) {
      const supportedEvidence = evidence.filter((e) =>
        rec.supportingEvidenceIds.includes(e.id)
      );

      // SUP-003: confidence threshold for supplement recommendations
      if (rec.type === "SUPPLEMENT_OPPORTUNITY") {
        if (rec.confidence < SUPPLEMENT_CONFIDENCE_THRESHOLD) {
          warnings.push(
            `${rec.title}: confidence ${Math.round(rec.confidence * 100)}% is below the ${Math.round(SUPPLEMENT_CONFIDENCE_THRESHOLD * 100)}% threshold — treat as a suggestion, request more evidence.`
          );
        }
      }

      // SUP-002: minimum supporting evidence
      if (rec.type === "SUPPLEMENT_OPPORTUNITY" && supportedEvidence.length < MIN_SUPPORTING_EVIDENCE) {
        errors.push(
          `${rec.title}: supplement recommendations require at least ${MIN_SUPPORTING_EVIDENCE} supporting evidence sources (found ${supportedEvidence.length}).`
        );
        continue;
      }

      // CMP-002: traceable sources
      if (rec.type !== "DOCUMENT_REQUEST" && rec.supportingEvidenceIds.length === 0) {
        errors.push(`${rec.title}: recommendation must reference traceable evidence sources.`);
        continue;
      }

      // REV-001: contradictions block auto-approval
      if (contradictionCount > 0 && !rec.requiresHumanApproval) {
        rec.requiresHumanApproval = true;
        warnings.push(`${rec.title}: contradictions detected — flagged for human review.`);
      }

      validRecommendations.push(rec);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recommendations: validRecommendations,
    };
  }
}
