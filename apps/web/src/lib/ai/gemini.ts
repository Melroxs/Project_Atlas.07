/**
 * Gemini provider — re-exported from the shared package.
 * Web code should not call this directly; use `generateText` from `@/lib/ai`.
 */
export {
  generateWithGemini,
  isGeminiConfigured,
  getGoogleApiKey,
} from "@project-atlas/ai";
export type { GeminiRequest, GeminiResponse } from "@project-atlas/ai";
