// ==========================================================
// Atlas
// decision.confidence.ts
// ConfidenceScorer — weighted confidence calculation
// ==========================================================
//
// Implements the DECISION-004 scoring framework:
//
//   Evidence Confidence = 0.30*sourceReliability
//                       + 0.25*evidenceCompleteness
//                       + 0.25*evidenceConsistency
//                       + 0.20*aiConfidence
//
//   Decision Confidence = Evidence Confidence
//                       + complianceAlignment
//                       - contradictionPenalty
//
// Confidence matrix (DECISION-004):
//   0.90 - 1.00  Strong recommendation        (VERY_HIGH)
//   0.70 - 0.89  Recommendation w/ review     (HIGH)
//   0.50 - 0.69  Request more evidence        (MODERATE/LOW)
//   < 0.50       No recommendation           (VERY_LOW)

import type {
  ConfidenceFactor,
  ConfidenceLabel,
  ConfidenceScore,
  EvidenceInput,
} from "./decision.types";

//
// DEFAULT WEIGHTS (DECISION-004)
//

export interface ConfidenceWeights {
  sourceReliability: number; // 0.30
  evidenceCompleteness: number; // 0.25
  evidenceConsistency: number; // 0.25
  aiConfidence: number; // 0.20
}

export const DEFAULT_CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  sourceReliability: 0.3,
  evidenceCompleteness: 0.25,
  evidenceConsistency: 0.25,
  aiConfidence: 0.2,
};

//
// SOURCE RELIABILITY MAP (0-1)
//

const SOURCE_RELIABILITY: Record<string, number> = {
  USER: 0.95,
  SYSTEM: 0.9,
  DOCUMENT_AI: 0.85,
  COMPUTER_VISION: 0.8,
  EXTERNAL_IMPORT: 0.6,
};

const DEFAULT_SOURCE_RELIABILITY = 0.7;

//
// CONFIDENCE MATRIX
//

function labelFor(value: number): ConfidenceLabel {
  if (value >= 0.9) return "VERY_HIGH";
  if (value >= 0.7) return "HIGH";
  if (value >= 0.5) return "MODERATE";
  return "VERY_LOW";
}

//
// INPUT
//

export interface ConfidenceInput {
  evidence: EvidenceInput[];
  coverage: number; // 0-1 fraction of required evidence present
  complianceScore: number; // 0-100 from compliance gateway
  contradictionCount: number; // number of CONTRADICTS relationships
  aiConfidence?: number; // optional AI model confidence
  weights?: Partial<ConfidenceWeights>;
}

//
// CONFIDENCE SCORER
//

export class ConfidenceScorer {
  private weights: ConfidenceWeights;

  constructor(weights?: Partial<ConfidenceWeights>) {
    this.weights = { ...DEFAULT_CONFIDENCE_WEIGHTS, ...(weights || {}) };
  }

  /**
   * Calculate a confidence score from evidence + compliance inputs.
   */
  score(input: ConfidenceInput): ConfidenceScore {
    const factors: ConfidenceFactor[] = [];

    // 1. Source reliability — average reliability of evidence sources
    const sourceScore = this.calculateSourceReliability(input.evidence);
    factors.push(this.factor("sourceReliability", sourceScore, this.weights.sourceReliability));

    // 2. Evidence completeness — coverage of required evidence
    const completenessScore = input.coverage;
    factors.push(this.factor("evidenceCompleteness", completenessScore, this.weights.evidenceCompleteness));

    // 3. Evidence consistency — 1 minus contradiction ratio
    const consistencyScore = this.calculateConsistency(input.evidence, input.contradictionCount);
    factors.push(this.factor("evidenceConsistency", consistencyScore, this.weights.evidenceConsistency));

    // 4. AI confidence — model certainty (defaults to 0.5 when unavailable,
    //    but 0 when there is no evidence to base any confidence on)
    const aiScore = this.clamp01(
      input.evidence.length === 0 ? 0 : input.aiConfidence ?? 0.5
    );
    factors.push(this.factor("aiConfidence", aiScore, this.weights.aiConfidence));

    // Weighted evidence confidence
    const evidenceConfidence = factors.reduce((sum, f) => sum + f.contribution, 0);

    // Compliance alignment: normalize compliance score 0-100 -> 0-1
    const complianceAlignment = this.clamp01(input.complianceScore / 100);

    // Contradiction penalty: each contradiction removes up to 0.1, max 0.3
    const contradictionPenalty = Math.min(input.contradictionCount * 0.1, 0.3);

    const value = this.clamp01(
      evidenceConfidence + complianceAlignment * 0.1 - contradictionPenalty
    );

    return {
      value,
      label: labelFor(value),
      factors,
      details: {
        evidenceConfidence: round(evidenceConfidence),
        complianceAlignment: round(complianceAlignment),
        contradictionPenalty: round(contradictionPenalty),
        coverage: round(input.coverage),
        contradictionCount: input.contradictionCount,
      },
    };
  }

  private calculateSourceReliability(evidence: EvidenceInput[]): number {
    if (evidence.length === 0) return 0;
    const total = evidence.reduce(
      (sum, node) => sum + (SOURCE_RELIABILITY[node.sourceType] ?? DEFAULT_SOURCE_RELIABILITY),
      0
    );
    return this.clamp01(total / evidence.length);
  }

  private calculateConsistency(evidence: EvidenceInput[], contradictionCount: number): number {
    if (evidence.length === 0) return 0;
    const contradictionRatio = Math.min(contradictionCount / evidence.length, 1);
    return this.clamp01(1 - contradictionRatio);
  }

  private factor(name: string, score: number, weight: number): ConfidenceFactor {
    const clampedScore = this.clamp01(score);
    return {
      name,
      weight,
      score: round(clampedScore),
      contribution: round(clampedScore * weight),
    };
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
