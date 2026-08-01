/**
 * Unified AI text generation — public API.
 *
 * Application code should only import from this module (via `@project-atlas/ai`
 * or the `apps/web/src/lib/ai` re-export shim):
 *
 *   import { generateText } from "@/lib/ai";
 */

export * from "./types";
export {
  generateText,
  getActiveProvider,
  getActiveModel,
  isAIConfigured,
  setAILogger,
} from "./provider";
export {
  generateWithGemini,
  isGeminiConfigured,
  getGoogleApiKey,
} from "./gemini";
export type { GeminiRequest, GeminiResponse } from "./gemini";
export {
  generateWithGroq,
  isGroqConfigured,
  getGroqApiKey,
} from "./groq";
export type { GroqRequest, GroqResponse } from "./groq";
// Reusable prompt templates — single source of truth
export * from "./prompts";
