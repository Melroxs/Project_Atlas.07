/**
 * Reusable AI prompt templates — single source of truth in the shared package.
 *
 * Only the prompt builders (and their context types) are re-exported here so
 * this barrel stays a focused surface and does not leak the full package API.
 */
export {
  buildSupplementSystemPrompt,
  buildSupplementPrompt,
  buildPolicySystemPrompt,
  buildPolicyAnalysisPrompt,
  buildClaimSystemPrompt,
  buildClaimRecommendationPrompt,
  buildInterviewSystemPrompt,
  buildInterviewAnswerPrompt,
  buildSummarySystemPrompt,
  buildSummaryPrompt,
} from "@project-atlas/ai";
export type {
  SupplementPromptContext,
  PolicyAnalysisContext,
  ClaimRecommendationContext,
  InterviewPromptContext,
  SummaryPromptContext,
} from "@project-atlas/ai";
