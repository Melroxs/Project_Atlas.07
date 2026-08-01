// ==========================================================
// Atlas
// decision.engine.ts
// DecisionEngine — facade over the Decision Pipeline
// ==========================================================
//
// The DecisionEngine is the orchestration entry point used by
// services, routes, and the voice assistant. It:
//   - runs the DecisionPipeline on a normalized claim snapshot
//   - optionally persists the decision + scores + risks via a
//     DecisionRepository (clean interface — plug in the DB
//     implementation once decision tables exist)
//   - returns structured DecisionPipelineResult objects

import { DecisionPipeline } from "./decision.pipeline";
import type {
  DecisionPipelineInput,
  DecisionPipelineResult,
  DecisionRecord,
} from "./decision.types";

//
// STORE INTERFACE
//
// Clean persistence interface implemented by the drizzle-backed
// DecisionRepository. The engine persists every execution through
// this interface; version history is the repository's concern
// (never overwrite previous decisions).
//

export interface DecisionStore {
  saveDecision(
    input: DecisionPipelineInput,
    result: DecisionPipelineResult
  ): Promise<DecisionRecord>;
  getLatestDecision(
    claimId: string,
    organizationId: string
  ): Promise<DecisionRecord | null>;
  listDecisions(
    organizationId: string,
    limit?: number
  ): Promise<DecisionRecord[]>;
  updateHumanReviewStatus(
    decisionId: string,
    status: DecisionRecord["humanReviewStatus"],
    reviewerId?: string,
    comments?: string
  ): Promise<DecisionRecord | null>;
}

//
// ENGINE
//

export class DecisionEngine {
  private pipeline: DecisionPipeline;
  private store?: DecisionStore;

  constructor(pipeline?: DecisionPipeline, store?: DecisionStore) {
    this.pipeline = pipeline ?? new DecisionPipeline();
    this.store = store;
  }

  /**
   * Analyze a claim and return the structured decision result.
   */
  async analyze(input: DecisionPipelineInput): Promise<DecisionPipelineResult> {
    const result = await this.pipeline.run(input);
    if (this.store) {
      await this.store.saveDecision(input, result);
    }
    return result;
  }

  /**
   * Get the underlying pipeline (for advanced composition).
   */
  getPipeline(): DecisionPipeline {
    return this.pipeline;
  }
}
