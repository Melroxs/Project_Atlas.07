// ==========================================================
// Atlas
// packages/domain/decision/voice/voice-service.ts
// VoiceService — Atlas Voice orchestration layer
// ==========================================================
//
// Provider-agnostic: the service builds a GROUNDED context from
// the Decision Repository + Evidence Graph + Compliance Engine and
// hands it to a VoiceProvider (default: ElementalVoiceProvider).
// Swap the provider without touching this service.
//
// Capabilities:
//   - Explain why a recommendation was made
//   - Explain supporting evidence
//   - Explain confidence score
//   - Explain compliance findings
//   - Answer natural-language questions about a claim
//
// No hallucinated explanations: the model answers ONLY from the
// grounded context serialized into the prompt.

import type { DecisionStore } from "../decision.engine";
import type { DecisionRecord, EvidenceInput } from "../decision.types";
import {
  type GroundedDecisionContext,
  type VoiceExplanation,
  type VoiceGenerationRequest,
  type VoiceGenerationResponse,
  type VoiceProvider,
} from "./voice.types";
import { ElementalVoiceProvider } from "./providers/elemental";
import { GroundedTextProvider } from "./providers/grounded";

const SYSTEM_PROMPT = `You are Atlas, the explainable AI decision assistant for insurance restoration.
Answer ONLY using the facts provided in the grounded context (JSON below).
Never invent evidence, documents, amounts, or reasoning that is not present in the context.
If the context does not contain the answer, say so and list the missing information.
Keep answers concise, professional, and traceable. Reference evidence IDs and the decision version where relevant.`;

//
// VOICE SERVICE
//

export class VoiceService {
  private provider: VoiceProvider;
  private fallback: VoiceProvider;

  /**
   * Provider-agnostic: pass a VoiceProvider explicitly, or let the
   * service pick Elemental when an API key is configured and fall
   * back to the grounded text provider otherwise. If a provider is
   * passed but fails at call time, the grounded fallback is used
   * automatically — no thrown errors reach the caller.
   */
  constructor(provider?: VoiceProvider) {
    const configured =
      provider ?? (ElementalVoiceProvider.isConfiguredGlobal()
        ? new ElementalVoiceProvider()
        : new GroundedTextProvider());
    this.provider = configured.isConfigured() ? configured : new GroundedTextProvider();
    this.fallback = new GroundedTextProvider();
  }

  /**
   * Run the provider, falling back to the grounded text generator
   * on any error (unconfigured key, timeout, upstream failure).
   */
  private async generateSafely(
    request: VoiceGenerationRequest
  ): Promise<VoiceGenerationResponse> {
    try {
      return await this.provider.generate(request);
    } catch (error) {
      console.warn(
        `Voice provider ${this.provider.getProviderName()} failed (${error instanceof Error ? error.message : "unknown error"}). Using grounded text fallback.`
      );
      return this.fallback.generate(request);
    }
  }

  /**
   * Answer a natural-language question about a claim using the
   * latest persisted decision as the sole source of truth.
   */
  async ask(
    claimId: string,
    organizationId: string,
    question: string,
    store: DecisionStore
  ): Promise<VoiceExplanation> {
    const decision = await store.getLatestDecision(claimId, organizationId);
    if (!decision) {
      return {
        answer:
          "No decision has been generated for this claim yet. Run the Decision Engine first.",
        provider: this.provider.getProviderName(),
        grounded: true,
        sources: {
          decisionId: "none",
          version: 0,
          claimId,
          confidence: 0,
          risk: 0,
          evidenceCount: 0,
          reasoningStages: [],
        },
      };
    }

    const context = this.buildGroundedContext(decision, claimId);
    const response = await this.generateSafely({
      question,
      systemPrompt: SYSTEM_PROMPT,
      context,
      temperature: 0.3,
      maxTokens: 600,
    });

    return {
      answer: response.answer,
      provider: response.provider,
      grounded: true,
      sources: {
        decisionId: decision.id,
        version: decision.version,
        claimId,
        confidence: decision.confidenceScore,
        risk: decision.riskScore,
        complianceStatus: decision.complianceStatus,
        evidenceCount: decision.evidenceNodes?.length ?? 0,
        reasoningStages: decision.reasoningTrace?.map((t) => t.stage) ?? [],
      },
    };
  }

  /**
   * Explain why a specific recommendation was made.
   */
  async explainRecommendation(
    claimId: string,
    organizationId: string,
    recommendationTitle: string,
    store: DecisionStore
  ): Promise<VoiceExplanation> {
    const decision = await store.getLatestDecision(claimId, organizationId);
    if (!decision) {
      return this.noDecision(claimId, store);
    }
    const recommendation = decision.recommendations?.find(
      (r) => r.title.toLowerCase().includes(recommendationTitle.toLowerCase())
    );

    const context = this.buildGroundedContext(decision, claimId);
    const question = recommendation
      ? `Why did Atlas recommend "${recommendation.title}"? Explain the supporting evidence, the confidence score, and the rules applied.`
      : `No recommendation matching "${recommendationTitle}" exists in the decision record. Summarize the recommendations that DO exist and the supporting evidence for each.`;

    const response = await this.generateSafely({
      question,
      systemPrompt: SYSTEM_PROMPT,
      context,
      temperature: 0.3,
      maxTokens: 500,
    });

    return this.toExplanation(response.answer, response.provider, decision, claimId);
  }

  /**
   * Explain the evidence supporting a decision.
   */
  async explainEvidence(
    claimId: string,
    organizationId: string,
    store: DecisionStore
  ): Promise<VoiceExplanation> {
    const decision = await store.getLatestDecision(claimId, organizationId);
    if (!decision) return this.noDecision(claimId, store);

    const question =
      "Explain the supporting evidence for this decision. List each evidence item, its type, source, confidence, and how it supports the recommendations.";
    const response = await this.generateSafely({
      question,
      systemPrompt: SYSTEM_PROMPT,
      context: this.buildGroundedContext(decision, claimId),
      temperature: 0.3,
      maxTokens: 500,
    });
    return this.toExplanation(response.answer, response.provider, decision, claimId);
  }

  /**
   * Explain the confidence score.
   */
  async explainConfidence(
    claimId: string,
    organizationId: string,
    store: DecisionStore
  ): Promise<VoiceExplanation> {
    const decision = await store.getLatestDecision(claimId, organizationId);
    if (!decision) return this.noDecision(claimId, store);

    const question = `Explain the confidence score of ${Math.round(decision.confidenceScore * 100)}% for this decision. Which factors contributed, and what would increase confidence?`;
    const response = await this.generateSafely({
      question,
      systemPrompt: SYSTEM_PROMPT,
      context: this.buildGroundedContext(decision, claimId),
      temperature: 0.3,
      maxTokens: 400,
    });
    return this.toExplanation(response.answer, response.provider, decision, claimId);
  }

  /**
   * Explain compliance findings.
   */
  async explainCompliance(
    claimId: string,
    organizationId: string,
    store: DecisionStore
  ): Promise<VoiceExplanation> {
    const decision = await store.getLatestDecision(claimId, organizationId);
    if (!decision) return this.noDecision(claimId, store);

    const question = `Explain the compliance status (${decision.complianceStatus ?? "UNKNOWN"}) for this decision. List each compliance rule result, violations, and what needs to be resolved before submission.`;
    const response = await this.generateSafely({
      question,
      systemPrompt: SYSTEM_PROMPT,
      context: this.buildGroundedContext(decision, claimId),
      temperature: 0.3,
      maxTokens: 500,
    });
    return this.toExplanation(response.answer, response.provider, decision, claimId);
  }

  /**
   * Build the grounded context from a persisted decision record.
   * Evidence Graph = stored evidence nodes + summary + missing evidence.
   */
  private buildGroundedContext(
    decision: DecisionRecord,
    claimId: string
  ): GroundedDecisionContext {
    const evidenceNodes: EvidenceInput[] = (decision.evidenceNodes as any) ?? [];
    return {
      claimId,
      claimNumber: decision.claimNumber ?? "UNKNOWN",
      decision,
      recommendations: decision.recommendations ?? [],
      evidenceNodes,
      evidenceSummary: decision.evidenceSummary,
      missingEvidence: decision.missingEvidence,
      compliance: {
        status: decision.complianceStatus,
        score: decision.complianceScore,
      },
      reasoningStages: decision.reasoningTrace?.map((t) => t.stage) ?? [],
    };
  }

  private toExplanation(
    answer: string,
    provider: string,
    decision: DecisionRecord,
    claimId: string
  ): VoiceExplanation {
    return {
      answer,
      provider,
      grounded: true,
      sources: {
        decisionId: decision.id,
        version: decision.version,
        claimId,
        confidence: decision.confidenceScore,
        risk: decision.riskScore,
        complianceStatus: decision.complianceStatus,
        evidenceCount: decision.evidenceNodes?.length ?? 0,
        reasoningStages: decision.reasoningTrace?.map((t) => t.stage) ?? [],
      },
    };
  }

  private async noDecision(claimId: string, store: DecisionStore): Promise<VoiceExplanation> {
    void store;
    return {
      answer:
        "No decision has been generated for this claim yet. Run the Decision Engine first.",
      provider: this.provider.getProviderName(),
      grounded: true,
      sources: {
        decisionId: "none",
        version: 0,
        claimId,
        confidence: 0,
        risk: 0,
        evidenceCount: 0,
        reasoningStages: [],
      },
    };
  }
}
