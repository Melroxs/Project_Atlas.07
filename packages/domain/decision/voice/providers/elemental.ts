// ==========================================================
// Atlas
// packages/domain/decision/voice/providers/elemental.ts
// ElementalVoiceProvider — adapter for Elemental AI
// ==========================================================
//
// Provider-agnostic design: this is the ONLY file that changes if
// the voice backend changes. The VoiceService speaks to the
// VoiceProvider interface defined in voice.types.ts.
//
// Elemental is configured via environment variables:
//   ELEMENTAL_API_KEY   — API key
//   ELEMENTAL_BASE_URL  — base URL (default https://api.elemental.ai/v1)
//   ELEMENTAL_MODEL     — model id (default elemental-voice-1)

import type {
  GroundedDecisionContext,
  VoiceGenerationRequest,
  VoiceGenerationResponse,
  VoiceProvider,
} from "../voice.types";

const DEFAULT_BASE_URL = "https://api.elemental.ai/v1";
const DEFAULT_MODEL = "elemental-voice-1";

export interface ElementalVoiceConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

//
// ADAPTER
//

export class ElementalVoiceProvider implements VoiceProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private timeoutMs: number;

  constructor(config: ElementalVoiceConfig = {}) {
    // Only an explicit Elemental configuration enables live voice.
    // Unrelated keys (e.g. OPENAI_API_KEY) must never be silently used
    // against the Elemental endpoint — VoiceService falls back to the
    // grounded provider when Elemental is not configured.
    this.apiKey = config.apiKey || process.env.ELEMENTAL_API_KEY || "";
    this.baseUrl = config.baseUrl || process.env.ELEMENTAL_BASE_URL || DEFAULT_BASE_URL;
    this.model = config.model || process.env.ELEMENTAL_MODEL || DEFAULT_MODEL;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  /**
   * True only when an Elemental API key is present in the environment.
   */
  static isConfiguredGlobal(): boolean {
    return Boolean(process.env.ELEMENTAL_API_KEY);
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  getProviderName(): string {
    return "elemental";
  }

  /**
   * Call the Elemental chat-completions endpoint with the grounded
   * context. The context is factual data from the Decision
   * Repository — the model is instructed to answer ONLY from it.
   */
  async generate(
    request: VoiceGenerationRequest
  ): Promise<VoiceGenerationResponse> {
    if (!this.isConfigured()) {
      throw new Error(
        "Elemental voice provider is not configured. Set ELEMENTAL_API_KEY (or OPENAI_API_KEY)."
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 600,
          messages: [
            { role: "system", content: request.systemPrompt },
            {
              role: "user",
              content: this.serializeContext(request.context),
            },
            { role: "user", content: request.question },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Elemental voice provider error (${res.status}): ${body.slice(0, 300)}`
        );
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const answer: string =
        data?.choices?.[0]?.message?.content ?? "No answer generated.";

      return {
        answer,
        provider: this.getProviderName(),
        grounded: true,
        trace: {
          decisionId: request.context.decision.id,
          version: request.context.decision.version,
          evidenceCount: request.context.evidenceNodes.length,
          reasoningStages: request.context.reasoningStages,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Serialize the grounded context as strict factual JSON so the
   * model cannot invent facts outside the decision record.
   */
  private serializeContext(context: GroundedDecisionContext): string {
    return JSON.stringify(
      {
        claim: {
          claimNumber: context.claimNumber,
          claimId: context.claimId,
        },
        decision: {
          id: context.decision.id,
          version: context.decision.version,
          title: context.decision.title,
          recommendation: context.decision.recommendation,
          confidenceScore: context.decision.confidenceScore,
          riskScore: context.decision.riskScore,
          priority: context.decision.priority,
          complianceStatus: context.decision.complianceStatus,
          complianceScore: context.decision.complianceScore,
        },
        recommendations: context.recommendations.map((r) => ({
          title: r.title,
          description: r.description,
          confidence: r.confidence,
          priority: r.priority,
          supportingEvidenceIds: r.supportingEvidenceIds,
          requiresHumanApproval: r.requiresHumanApproval,
        })),
        evidence: context.evidenceNodes.map((e) => ({
          id: e.id,
          nodeType: e.nodeType,
          sourceType: e.sourceType,
          title: e.title,
          confidenceScore: e.confidenceScore,
        })),
        evidenceSummary: context.evidenceSummary,
        missingEvidence: context.missingEvidence?.map((m) => ({
          type: m.type,
          description: m.description,
          severity: m.severity,
        })),
        riskFactors: context.decision.riskFactors?.map((r) => ({
          type: r.type,
          severity: r.severity,
          description: r.description,
          mitigation: r.mitigation,
        })),
        reasoningStages: context.reasoningStages,
      },
      null,
      2
    );
  }
}
