// ==========================================================
// Atlas
// apps/api/src/lib/decision-learning.ts
// DecisionLearningService — continuous-learning feedback loop
// ==========================================================
//
// Phase 5: after claim completion, store:
//   - final approved supplement
//   - reviewer edits
//   - adjuster outcome
//   - amount approved / denied
//   - confidence accuracy
//   - evidence gaps
//   - time to approval
//
// Then compute analytics (confidence calibration, recommendation
// accuracy, evidence quality trends, human override frequency)
// via the shared pure computeLearningMetrics in the domain
// package — no DB needed for the math, fully unit-testable.
//
// ANALYTICS AND LEARNING ONLY. Human review remains mandatory.
// This service NEVER retrains models automatically.

import { DecisionRepository } from "../../../../packages/domain/decision";
import { computeLearningMetrics } from "../../../../packages/domain/decision";

export type { DecisionOutcomeInput, LearningMetrics } from "../../../../packages/domain/decision";

//
// LEARNING SERVICE
//

export class DecisionLearningService {
  constructor(private repository: DecisionRepository) {}

  /**
   * Record a claim-completion outcome for the feedback loop.
   */
  async recordOutcome(input: Parameters<DecisionRepository["recordOutcome"]>[0]) {
    return this.repository.recordOutcome(input);
  }

  /**
   * Compute learning metrics from recorded outcomes.
   */
  async getMetrics(organizationId: string) {
    const outcomes = await this.repository.listOutcomes(organizationId);
    return computeLearningMetrics(outcomes);
  }
}
