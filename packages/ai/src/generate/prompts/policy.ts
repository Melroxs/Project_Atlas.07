/**
 * Policy analysis prompt templates — single source of truth.
 */

export interface PolicyAnalysisContext {
  policyText: string;
  question?: string;
}

/** System prompt for policy analysis. */
export function buildPolicySystemPrompt(): string {
  return `You are an expert insurance policy analyst. You read insurance policies and answer questions accurately, citing specific policy language. Be precise, conservative, and flag ambiguities.`;
}

/** Build a policy analysis user prompt. */
export function buildPolicyAnalysisPrompt(context: PolicyAnalysisContext): string {
  const lines: string[] = [];
  lines.push("Analyze the following insurance policy text.");
  if (context.question) {
    lines.push(`\nQuestion: ${context.question}`);
  } else {
    lines.push("\nProvide: coverage summary, key exclusions, limits, and any ambiguity that could affect a claim.");
  }
  lines.push(`\n--- POLICY TEXT ---\n${context.policyText}`);
  return lines.join("\n");
}
