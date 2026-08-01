// ==========================================================
// Atlas
// decision.service.ts
// Decision Engine Intelligence Service Layer
// ==========================================================
//
// Orchestrates the DecisionPipeline + drizzle-backed
// DecisionRepository. The repository is wired as the engine's
// DecisionStore, so EVERY Decision Engine execution is persisted
// with version history (never overwrite previous decisions).
//
// Structured outputs (per the Decision Engine spec):
//   DecisionPipelineResult contains DecisionResult, EvidenceSummary,
//   Recommendation, RiskAssessment, ConfidenceScore, MissingEvidence.

import { DecisionEngine } from "./decision.engine";
import { DecisionPipeline } from "./decision.pipeline";
import { DecisionRepository } from "./decision.repository";
import type {
  CreateDecisionRequest,
  DecisionApproval,
  DecisionPipelineInput,
  DecisionPipelineResult,
  DecisionRecord,
} from "./decision.types";

//
// CONTEXT SOURCE INTERFACE
//
// Anything that can produce a normalized DecisionPipelineInput for
// a claim (e.g. the API's DecisionContextCollector which queries
// claims/documents/interviews/supplements/activity).
//

export interface DecisionContextSource {
  loadContext(claimId: string, organizationId: string): Promise<DecisionPipelineInput>;
}

export class DecisionService {
  private engine: DecisionEngine;

  constructor(
    private repository: DecisionRepository,
    private contextSource?: DecisionContextSource,
    pipeline?: DecisionPipeline
  ) {
    // The repository IS the store — every execution is persisted.
    this.engine = new DecisionEngine(
      pipeline ?? new DecisionPipeline(),
      repository
    );
  }

  //
  // CREATE DECISION
  //
  async createDecision(data: CreateDecisionRequest & { createdBy?: string }) {
    return this.repository.createDecision(data);
  }

  //
  // ANALYZE CLAIM
  //
  // Loads claim context (via the injected source) and runs the
  // full decision pipeline. The result is persisted by the store.
  //
  async analyzeClaim(claimId: string, organizationId: string): Promise<DecisionPipelineResult> {
    if (!this.contextSource) {
      throw new Error(
        "DecisionService.analyzeClaim requires a DecisionContextSource (inject one at construction)."
      );
    }
    const input = await this.contextSource.loadContext(claimId, organizationId);
    return this.evaluateContext(input);
  }

  //
  // EVALUATE DECISION CONTEXT
  //
  async evaluateContext(input: DecisionPipelineInput): Promise<DecisionPipelineResult> {
    return this.engine.analyze(input);
  }

  //
  // CREATE SUPPLEMENT DECISION
  //
  // Convenience wrapper: analyzes the claim and returns the top
  // supplement-opportunity recommendation. The pipeline result is
  // ALREADY persisted by the engine's store (saveDecision) — this
  // method must NOT insert a second decision row.
  //
  async createSupplementDecision(
    claimId: string,
    organizationId: string,
    _createdBy?: string
  ) {
    const result = await this.analyzeClaim(claimId, organizationId);
    const supplement = result.recommendations?.find(
      (r) => r.type === "SUPPLEMENT_OPPORTUNITY"
    );

    return {
      result,
      supplement: supplement ?? null,
      decision: await this.repository.getLatestDecision(claimId, organizationId),
    };
  }

  //
  // BUILD DECISION EXPLANATION
  //
  async explainDecision(decisionId: string, organizationId: string) {
    return this.repository.buildDecisionContext(decisionId, organizationId);
  }

  //
  // GET LATEST DECISION RECORD
  //
  async getLatestDecision(
    claimId: string,
    organizationId: string
  ): Promise<DecisionRecord | null> {
    return this.repository.getLatestDecision(claimId, organizationId);
  }

  //
  // LIST DECISIONS
  //
  async listDecisions(organizationId: string, limit = 50) {
    return this.repository.listDecisions(organizationId, limit);
  }

  //
  // HUMAN REVIEW — approve / reject / request changes / regenerate
  //
  async reviewDecision(
    decisionId: string,
    status: DecisionRecord["humanReviewStatus"],
    reviewerId: string,
    comments?: string
  ) {
    return this.repository.updateHumanReviewStatus(
      decisionId,
      status,
      reviewerId,
      comments
    );
  }

  //
  // APPROVE DECISION
  //
  async approveDecision(
    decisionId: string,
    reviewerId: string,
    comments?: string
  ): Promise<DecisionApproval | null> {
    await this.repository.updateDecisionStatus(decisionId, "APPROVED");
    return this.repository.createApproval({
      decisionId,
      reviewerId,
      approvalStatus: "APPROVED",
      comments,
    });
  }

  //
  // REJECT DECISION
  //
  async rejectDecision(
    decisionId: string,
    reviewerId: string,
    comments?: string
  ): Promise<DecisionApproval | null> {
    await this.repository.updateDecisionStatus(decisionId, "REJECTED");
    return this.repository.createApproval({
      decisionId,
      reviewerId,
      approvalStatus: "REJECTED",
      comments,
    });
  }
}
