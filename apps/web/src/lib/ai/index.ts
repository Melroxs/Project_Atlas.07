/**
 * Atlas unified AI layer for the web app.
 *
 * Application code must call only `generateText()`:
 *
 *   import { generateText } from "@/lib/ai";
 *
 * The implementation lives in the shared `@project-atlas/ai` package
 * (Gemini primary, Groq fallback). These files re-export it so web code uses
 * the `@/lib/ai` path and never imports a provider directly.
 */
export {
  generateText,
  getActiveProvider,
  isAIConfigured,
  setAILogger,
} from "@project-atlas/ai";
export type {
  AIProviderName,
  AITextRequest,
  AITokenUsage,
  AITextSuccess,
  AITextFailure,
  AITextResult,
  AIEvent,
  AILogger,
} from "@project-atlas/ai";
