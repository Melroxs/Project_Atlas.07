// apps/web/src/lib/decision-learning.ts
// DecisionLearningService — continuous-learning feedback loop (Phase 5).
// Mirrors apps/api/src/lib/decision-learning.ts using the shared
// DecisionRepository and the pure computeLearningMetrics from the
// domain package. Analytics and learning only — never retrains
// models automatically; human review remains mandatory.

import { DecisionRepository, computeLearningMetrics } from '@project-atlas/decision';

export type { DecisionOutcomeInput, LearningMetrics } from '@project-atlas/decision';

export class DecisionLearningService {
  constructor(private repository: DecisionRepository) {}

  async recordOutcome(input: Parameters<DecisionRepository['recordOutcome']>[0]) {
    return this.repository.recordOutcome(input);
  }

  async getMetrics(organizationId: string) {
    const outcomes = await this.repository.listOutcomes(organizationId);
    return computeLearningMetrics(outcomes);
  }
}
