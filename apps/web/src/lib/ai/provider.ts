/**
 * Provider selection — re-exported from the shared package.
 * Prefer `generateText` from `@/lib/ai` in application code.
 */
export {
  generateText,
  getActiveProvider,
  isAIConfigured,
  setAILogger,
} from "@project-atlas/ai";
