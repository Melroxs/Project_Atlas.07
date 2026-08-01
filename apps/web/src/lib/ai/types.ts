/**
 * AI types — re-exported from the shared @project-atlas/ai package so web
 * code imports them via `@/lib/ai` without knowing the provider.
 */
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
