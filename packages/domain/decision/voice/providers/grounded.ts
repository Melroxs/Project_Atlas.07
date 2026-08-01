// ==========================================================
// Atlas
// packages/domain/decision/voice/providers/grounded.ts
// GroundedTextProvider — deterministic fallback voice provider
// ==========================================================
//
// When no voice API key is configured (ELEMENTAL_API_KEY /
// OPENAI_API_KEY), the VoiceService falls back to this provider.
// It builds the explanation EXCLUSIVELY from the grounded
// decision context (Decision Repository + Evidence Graph +
// Compliance Engine) — every fact references stored evidence.
// No LLM call, no hallucinated explanations, always available.

import type {
  GroundedDecisionContext,
  VoiceGenerationRequest,
  VoiceGenerationResponse,
  VoiceProvider,
} from "../voice.types";

function formatPercent(value?: number): string {
  return value == null ? "n/a" : `${Math.round(value * 100)}%`;
}

/**
 * Detect what the question is asking about and answer from the
 * grounded context only.
 */
function buildAnswer(request: VoiceGenerationRequest): string {
  const { question, context } = request;
  const q = question.toLowerCase();
  const d = context.decision;
  const recs = context.recommendations ?? [];

  const parts: string[] = [];

  if (q.includes("confidence") || q.includes("sure") || q.includes("certain")) {
    parts.push(
      `The confidence score for this decision is ${formatPercent(d.confidenceScore)}. ` +
        `The evidence set has ${context.evidenceNodes.length} item(s) with an average confidence of ` +
        `${context.evidenceSummary ? formatPercent(context.evidenceSummary.averageConfidence) : "n/a"} ` +
        `and ${context.evidenceSummary ? Math.round(context.evidenceSummary.coverage * 100) : 0}% coverage of required evidence types. ` +
        `Confidence would increase by resolving the missing evidence: ` +
        `${
          (context.missingEvidence ?? []).length > 0
            ? (context.missingEvidence ?? []).map((m) => m.type.replace(/_/g, " ")).join(", ")
            : "none — the claim is complete"
        }.`
    );
  }

  if (q.includes("risk")) {
    const riskFactors = context.decision.riskFactors ?? [];
    parts.push(
      `The risk score for this decision is ${Math.round(d.riskScore ?? 0)}/100. ` +
        `Risk factors: ${
          riskFactors.length > 0
            ? riskFactors.map((r) => r.type.replace(/_/g, " ")).join(", ")
            : "identified during scoring (missing evidence, conflicting information, compliance gaps)"
        }.`
    );
  }

  if (q.includes("complian") || q.includes("complied") || q.includes("valid")) {
    const status = context.compliance.status ?? "UNKNOWN";
    parts.push(
      `Compliance validation status is ${status} with a compliance score of ${
        context.compliance.score != null ? Math.round(context.compliance.score) : "n/a"
      }/100. ` +
        `The recommendation must pass compliance rules before submission; ` +
        `${status === "READY" ? "no violations were detected." : status === "NEEDS_REVIEW" ? "the claim needs review before it is ready." : "the claim is missing required information."}`
    );
  }

  if (q.includes("evidence") || q.includes("support") || q.includes("why")) {
    const evidenceLines =
      context.evidenceNodes.length > 0
        ? context.evidenceNodes
            .slice(0, 8)
            .map(
              (e) =>
                `  - ${e.title} (${e.nodeType.replace(/_/g, " ").toLowerCase()}, id ${e.id.slice(0, 8)})`
            )
            .join("\n")
        : "  - no evidence items are recorded on this decision";
    parts.push(
      `This decision is grounded in the following stored evidence:\n${evidenceLines}`
    );
  }

  if (recs.length > 0) {
    const top = recs[0];
    parts.push(
      `Recommendation "${top.title}" (priority ${top.priority}, confidence ${formatPercent(top.confidence)}) was generated. ` +
        `Rules applied: ${top.rulesApplied.join(", ")}. ` +
        `Supporting evidence ids: ${
          top.supportingEvidenceIds.length > 0
            ? top.supportingEvidenceIds.map((id) => id.slice(0, 8)).join(", ")
            : "none"
        }. ` +
        `${
          top.requiresHumanApproval
            ? "It requires human approval before becoming final."
            : ""
        }`
    );
  }

  parts.push(
    `This explanation is grounded in decision v${d.version} (${d.id.slice(0, 8)}). ` +
      `If the answer you need is not here, request the specific evidence item or ask about confidence, risk, compliance, or evidence.`
  );

  return parts.join("\n\n");
}

/**
 * Grounded fallback provider — always configured, deterministic,
 * zero network calls.
 */
export class GroundedTextProvider implements VoiceProvider {
  async generate(
    request: VoiceGenerationRequest
  ): Promise<VoiceGenerationResponse> {
    const answer = buildAnswer(request);
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
  }

  isConfigured(): boolean {
    return true;
  }

  getProviderName(): string {
    return "grounded-text";
  }
}

export function buildGroundedContextSummary(
  context: GroundedDecisionContext
): string {
  // Reuse the answer builder for one-off grounded summaries.
  return buildAnswer({
    question: "evidence and recommendation",
    systemPrompt: "",
    context,
  });
}
