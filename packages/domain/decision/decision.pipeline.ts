// ==========================================================
// Atlas
// decision.pipeline.ts
// DecisionPipeline — 8-stage reasoning orchestration layer
// ==========================================================
//
// Stages (DECISION-001 / DECISION_CONFIDENCE_ENGINE_SPEC):
//   1. Collect evidence
//   2. Validate evidence
//   3. Detect inconsistencies
//   4. Assess completeness
//   5. Calculate confidence
//   6. Generate recommendations
//   7. Evaluate compliance
//   8. Escalate / publish decision
//
// The pipeline is deterministic and pure — all external inputs
// (DB records, AI recommendations) arrive as a normalized
// DecisionPipelineInput, so it is fully unit-testable.

import { ConfidenceScorer } from "./decision.confidence";
import { EvidenceCollector } from "./decision.evidence";
import { RecommendationBuilder } from "./decision.recommendation";
import { RiskScorer } from "./decision.risk";
import { RecommendationValidator } from "./decision.validator";
import { RulesBasedComplianceGateway } from "./decision.compliance";
import type {
  ComplianceGateway,
  DecisionPipelineInput,
  DecisionPipelineResult,
  EvidenceInput,
  MissingEvidence,
  Recommendation,
  ReasoningTraceEntry,
} from "./decision.types";

//
// PIPELINE DEPENDENCIES
//

export interface DecisionPipelineDependencies {
  evidenceCollector?: EvidenceCollector;
  confidenceScorer?: ConfidenceScorer;
  riskScorer?: RiskScorer;
  recommendationBuilder?: RecommendationBuilder;
  validator?: RecommendationValidator;
  complianceGateway?: ComplianceGateway;
}

const MIN_EVIDENCE_FOR_DECISION = 2;
const CONFLICT_REVIEW_THRESHOLD = 0;

//
// DECISION PIPELINE
//

export class DecisionPipeline {
  private evidenceCollector: EvidenceCollector;
  private confidenceScorer: ConfidenceScorer;
  private riskScorer: RiskScorer;
  private recommendationBuilder: RecommendationBuilder;
  private validator: RecommendationValidator;
  private complianceGateway: ComplianceGateway;

  constructor(deps: DecisionPipelineDependencies = {}) {
    this.evidenceCollector = deps.evidenceCollector ?? new EvidenceCollector();
    this.confidenceScorer = deps.confidenceScorer ?? new ConfidenceScorer();
    this.riskScorer = deps.riskScorer ?? new RiskScorer();
    this.recommendationBuilder = deps.recommendationBuilder ?? new RecommendationBuilder();
    this.validator = deps.validator ?? new RecommendationValidator();
    this.complianceGateway = deps.complianceGateway ?? new RulesBasedComplianceGateway();
  }

  /**
   * Run the full decision pipeline for a claim snapshot.
   */
  async run(input: DecisionPipelineInput): Promise<DecisionPipelineResult> {
    const trace: ReasoningTraceEntry[] = [];

    // Stage 1 — Collect evidence
    const collected = this.evidenceCollector.collect(input);
    trace.push({ stage: "COLLECT_EVIDENCE", input, output: collected });

    // Stage 2 — Validate evidence
    const validationIssues = this.validateEvidence(collected.nodes);
    trace.push({ stage: "VALIDATE_EVIDENCE", input: collected.nodes, output: validationIssues });

    // Stage 3 — Detect inconsistencies
    const contradictionCount = collected.contradictionCount;
    trace.push({
      stage: "DETECT_INCONSISTENCIES",
      input: collected.nodes,
      output: { contradictionCount },
    });

    // Stage 4 — Assess completeness
    const missingEvidence = collected.missingEvidence;
    trace.push({ stage: "ASSESS_COMPLETENESS", input: collected.summary, output: missingEvidence });

    // Stage 5 — Calculate confidence
    const compliancePreview = await this.complianceGateway.evaluate({
      claimId: input.claimId,
      claimType: input.claim.causeOfLoss || "UNKNOWN",
      evidenceNodes: collected.nodes,
      documents: input.documents,
      decisions: [],
      workflowState: {},
    });
    const confidence = this.confidenceScorer.score({
      evidence: collected.nodes,
      coverage: collected.summary.coverage,
      complianceScore: compliancePreview.score,
      contradictionCount,
      aiConfidence: this.averageAiConfidence(collected.nodes),
    });
    trace.push({ stage: "CALCULATE_CONFIDENCE", input: collected.summary, output: confidence });

    // Stage 6 — Generate recommendations
    const risk = this.riskScorer.score({
      missingEvidence,
      contradictionCount,
      complianceViolations: compliancePreview.violations,
      estimatedValue: input.claim.estimatedValue,
      approvedValue: input.claim.approvedValue,
    });
    const rawRecommendations = this.recommendationBuilder.build({
      claimId: input.claimId,
      claimNumber: input.claim.claimNumber,
      evidence: collected.nodes,
      missingEvidence,
      aiRecommendations: input.aiRecommendations ?? [],
      contradictionCount,
      complianceViolations: compliancePreview.violations,
      confidenceValue: confidence.value,
      risk,
    });
    trace.push({ stage: "GENERATE_RECOMMENDATIONS", input: risk, output: rawRecommendations });

    // Stage 7 — Evaluate compliance with the final recommendations
    const compliance = await this.complianceGateway.evaluate({
      claimId: input.claimId,
      claimType: input.claim.causeOfLoss || "UNKNOWN",
      evidenceNodes: collected.nodes,
      documents: input.documents,
      decisions: rawRecommendations.map((r) => ({ id: r.id, confidenceScore: r.confidence })),
      workflowState: {},
    });
    trace.push({ stage: "EVALUATE_COMPLIANCE", input: rawRecommendations, output: compliance });

    // Stage 8 — Validate recommendations & publish
    const validation = this.validator.validate(rawRecommendations, collected.nodes, contradictionCount);
    const recommendations: Recommendation[] = validation.recommendations;
    const requiresHumanApproval =
      recommendations.some((r) => r.requiresHumanApproval) ||
      compliance.status !== "READY" ||
      contradictionCount > CONFLICT_REVIEW_THRESHOLD;

    const sufficientEvidence =
      collected.nodes.length >= MIN_EVIDENCE_FOR_DECISION &&
      collected.summary.coverage >= 0.4;

    // Publish-stage trace entry: a lightweight summary ONLY — never the
    // result object itself, which holds the trace (would create a circular
    // reference that breaks JSON.stringify when persisting the decision).
    trace.push({
      stage: "PUBLISH_DECISION",
      input: recommendations,
      output: {
        requiresHumanApproval,
        sufficientEvidence,
        recommendationCount: recommendations.length,
        complianceStatus: compliance.status,
        complianceScore: compliance.score,
      },
    });

    const result: DecisionPipelineResult = {
      claimId: input.claimId,
      organizationId: input.organizationId,
      generatedAt: new Date(),
      evidence: collected.summary,
      confidence,
      risk,
      recommendations,
      missingEvidence,
      compliance,
      sufficientEvidence,
      requiresHumanApproval,
      explanation: this.buildExplanation({
        input,
        evidenceCount: collected.nodes.length,
        missingEvidence,
        confidence: confidence.value,
        riskScore: risk.score,
        recommendations,
        compliance,
        sufficientEvidence,
      }),
      reasoningTrace: trace,
    };

    return result;
  }

  private validateEvidence(nodes: EvidenceInput[]): string[] {
    const issues: string[] = [];
    if (nodes.length === 0) {
      issues.push("No evidence collected for this claim.");
    }
    const lowConfidence = nodes.filter((n) => n.confidenceScore < 0.3);
    if (lowConfidence.length > 0) {
      issues.push(`${lowConfidence.length} evidence item(s) have very low confidence (< 0.3).`);
    }
    return issues;
  }

  private averageAiConfidence(nodes: EvidenceInput[]): number | undefined {
    const aiNodes = nodes.filter((n) => n.sourceType === "DOCUMENT_AI" || n.sourceType === "COMPUTER_VISION");
    if (aiNodes.length === 0) return undefined;
    return aiNodes.reduce((sum, n) => sum + n.confidenceScore, 0) / aiNodes.length;
  }

  private buildExplanation(params: {
    input: DecisionPipelineInput;
    evidenceCount: number;
    missingEvidence: MissingEvidence[];
    confidence: number;
    riskScore: number;
    recommendations: Recommendation[];
    compliance: { status: string; score: number };
    sufficientEvidence: boolean;
  }): string {
    const parts: string[] = [];
    parts.push(
      `Claim ${params.input.claim.claimNumber} analyzed with ${params.evidenceCount} evidence item(s).`
    );
    parts.push(
      `Confidence ${Math.round(params.confidence * 100)}%, risk ${params.riskScore}/100, compliance ${params.compliance.status} (${params.compliance.score}/100).`
    );
    if (params.sufficientEvidence) {
      parts.push("Sufficient evidence exists to support a recommendation.");
    } else {
      parts.push("Insufficient evidence — additional documentation is required before submission.");
    }
    if (params.missingEvidence.length > 0) {
      parts.push(`Missing: ${params.missingEvidence.map((m) => m.type).join(", ")}.`);
    }
    if (params.recommendations.length > 0) {
      parts.push(
        `Recommendations: ${params.recommendations.map((r) => r.title).join("; ")}.`
      );
    } else {
      parts.push("No recommendations generated at this confidence level.");
    }
    if (params.recommendations.some((r) => r.requiresHumanApproval)) {
      parts.push("Human approval required before action.");
    }
    return parts.join(" ");
  }
}
