// ==========================================================
// Atlas
// decision.risk.ts
// RiskScorer — risk assessment from evidence gaps & compliance
// ==========================================================
//
// Implements the DECISION-004 risk framework:
//
//   Risk = SUM of risk factors
//     - Missing evidence          +20
//     - Conflicting evidence      +30
//     - Compliance gap            +40
//     - Revenue leakage exposure   capped by estimated value
//
//   Risk score: 0-100
//   Levels:     0-24 LOW, 25-49 MODERATE, 50-74 HIGH, 75-100 CRITICAL

import type {
  MissingEvidence,
  RiskAssessment,
  RiskFactor,
  RiskLevel,
  RiskType,
} from "./decision.types";

//
// INPUT
//

export interface RiskInput {
  missingEvidence: MissingEvidence[];
  contradictionCount: number;
  complianceViolations: string[];
  estimatedValue?: number;
  approvedValue?: number;
}

//
// RISK POINTS (DECISION-004)
//

const MISSING_EVIDENCE_POINTS: Record<string, number> = {
  CRITICAL: 25,
  HIGH: 20,
  MEDIUM: 12,
  LOW: 6,
};

const CONTRADICTION_POINTS = 30;
const COMPLIANCE_GAP_POINTS = 40;

//
// RISK LEVELS
//

function levelFor(score: number): RiskLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
}

function severityFor(score: number): RiskFactor["severity"] {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

//
// RISK SCORER
//

export class RiskScorer {
  /**
   * Calculate a risk assessment (0-100) from evidence gaps, contradictions,
   * compliance violations, and financial exposure.
   */
  score(input: RiskInput): RiskAssessment {
    const factors: RiskFactor[] = [];
    let score = 0;

    // 1. Missing evidence gaps
    for (const gap of input.missingEvidence) {
      const points = MISSING_EVIDENCE_POINTS[gap.severity] ?? MISSING_EVIDENCE_POINTS.MEDIUM;
      factors.push({
        type: "INSUFFICIENT_EVIDENCE",
        severity: gap.severity,
        description: gap.description,
        points,
        mitigation: gap.sourceHint || "Collect the missing supporting documentation.",
      });
      score += points;
    }

    // 2. Conflicting evidence
    if (input.contradictionCount > 0) {
      factors.push({
        type: "CONFLICTING_INFORMATION",
        severity: "HIGH",
        description: `${input.contradictionCount} conflicting evidence relationship(s) detected between sources.`,
        points: Math.min(input.contradictionCount * CONTRADICTION_POINTS, 60),
        mitigation: "Review conflicting sources and reconcile before submission.",
      });
      score += Math.min(input.contradictionCount * CONTRADICTION_POINTS, 60);
    }

    // 3. Compliance gaps
    if (input.complianceViolations.length > 0) {
      factors.push({
        type: "COMPLIANCE_FAILURE",
        severity: "CRITICAL",
        description: `${input.complianceViolations.length} compliance violation(s): ${input.complianceViolations.join("; ")}`,
        points: Math.min(input.complianceViolations.length * COMPLIANCE_GAP_POINTS, 80),
        mitigation: "Resolve compliance violations before package generation.",
      });
      score += Math.min(input.complianceViolations.length * COMPLIANCE_GAP_POINTS, 80);
    }

    // 4. Revenue leakage exposure (financial magnitude)
    const exposure = (input.estimatedValue || 0) - (input.approvedValue || 0);
    if (exposure > 0) {
      const points = exposure > 50000 ? 15 : exposure > 10000 ? 10 : 5;
      factors.push({
        type: "REVENUE_LEAKAGE",
        severity: severityFor(score + points),
        description: `Unrealized recovery exposure of $${exposure.toLocaleString()} identified on this claim.`,
        points,
        mitigation: "Review supplement opportunity to capture potential revenue.",
      });
      score += points;
    }

    const finalScore = Math.max(0, Math.min(100, score));

    return {
      score: finalScore,
      level: levelFor(finalScore),
      factors,
    };
  }
}
