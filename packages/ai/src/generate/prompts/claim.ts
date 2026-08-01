/**
 * Claim recommendation prompt templates — single source of truth.
 */

export interface ClaimRecommendationContext {
  claim: Record<string, unknown>;
  evidence?: Array<Record<string, unknown>>;
}

/** System prompt for claim recommendations. */
export function buildClaimSystemPrompt(): string {
  return `You are an expert insurance restoration claim analyst. You evaluate claim information and evidence to produce actionable, conservative, evidence-backed recommendations. Never invent facts not present in the input.`;
}

/** Build a claim recommendation user prompt. */
export function buildClaimRecommendationPrompt(
  context: ClaimRecommendationContext
): string {
  const lines: string[] = [];
  lines.push("Evaluate the following claim and produce recommendations.");
  lines.push("For each recommendation include: title, description, suggested action, estimated impact, business rationale, supporting evidence, confidence score (0-1).");
  lines.push("");
  lines.push("--- CLAIM ---");
  lines.push(JSON.stringify(context.claim, null, 2));
  if (context.evidence && context.evidence.length > 0) {
    lines.push("");
    lines.push("--- EVIDENCE ---");
    lines.push(JSON.stringify(context.evidence, null, 2));
  }
  return lines.join("\n");
}
