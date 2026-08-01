/**
 * Groq provider — re-exported from the shared package.
 * Web code should not call this directly; use `generateText` from `@/lib/ai`.
 */
export {
  generateWithGroq,
  isGroqConfigured,
  getGroqApiKey,
} from "@project-atlas/ai";
export type { GroqRequest, GroqResponse } from "@project-atlas/ai";
