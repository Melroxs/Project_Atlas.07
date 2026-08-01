// ==========================================================
// Atlas
// packages/domain/decision/voice/voice.types.ts
// Provider-agnostic Atlas Voice (Elemental Integration) types
// ==========================================================
//
// Design principle: the VoiceService builds a GROUNDED context
// exclusively from the Decision Repository, Evidence Graph,
// Decision Engine and Compliance Engine — never from the model's
// own knowledge. No hallucinated explanations.

import type {
  DecisionRecord,
  EvidenceInput,
  Recommendation,
} from "../decision.types";

//
// GROUNDED EXPLANATION CONTEXT
//
// Everything the voice layer needs to answer a question about a
// claim. Every fact is traceable back to a persisted decision.
//

export interface GroundedDecisionContext {
  claimId: string;
  claimNumber: string;
  decision: DecisionRecord;
  recommendations: Recommendation[];
  evidenceNodes: EvidenceInput[];
  evidenceSummary: DecisionRecord["evidenceSummary"];
  missingEvidence: DecisionRecord["missingEvidence"];
  compliance: {
    status?: string;
    score?: number;
  };
  reasoningStages: string[];
}

//
// VOICE PROVIDER INTERFACE
//
// Provider-agnostic: swap the adapter (e.g. Elemental) without
// touching the VoiceService.
//

export interface VoiceProvider {
  /**
   * Generate a conversational response grounded in the provided context.
   */
  generate(request: VoiceGenerationRequest): Promise<VoiceGenerationResponse>;

  /**
   * Whether the provider is configured (API key present).
   */
  isConfigured(): boolean;

  /**
   * Provider name (for logging/audit).
   */
  getProviderName(): string;
}

export interface VoiceGenerationRequest {
  question: string;
  systemPrompt: string;
  context: GroundedDecisionContext;
  temperature?: number;
  maxTokens?: number;
}

export interface VoiceGenerationResponse {
  answer: string;
  provider: string;
  grounded: boolean;
  trace: {
    decisionId: string;
    version: number;
    evidenceCount: number;
    reasoningStages: string[];
  };
}

//
// VOICE SERVICE OUTPUT
//

export interface VoiceExplanation {
  answer: string;
  provider: string;
  grounded: true;
  sources: {
    decisionId: string;
    version: number;
    claimId: string;
    confidence: number;
    risk: number;
    complianceStatus?: string;
    evidenceCount: number;
    reasoningStages: string[];
  };
}
