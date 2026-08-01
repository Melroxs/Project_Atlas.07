/**
 * Unified AI text-generation types.
 *
 * Atlas application code must only ever call `generateText()` from
 * `@project-atlas/ai` (re-exported at `apps/web/src/lib/ai`). No module
 * should import a provider directly.
 */

export type AIProviderName = "gemini" | "groq";

/** Request shape for the unified text-generation entry point. */
export interface AITextRequest {
  /** The user prompt / instruction to send to the model. */
  prompt: string;
  /** Optional system prompt. */
  systemPrompt?: string;
  /** Sampling temperature (0-1). Defaults to 0.7. */
  temperature?: number;
  /** Maximum output tokens. Defaults to provider default. */
  maxTokens?: number;
  /** Optional model override. Defaults to provider default. */
  model?: string;
}

/** Token usage (normalized across providers; may be absent). */
export interface AITokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Successful result. */
export interface AITextSuccess {
  success: true;
  provider: AIProviderName;
  model: string;
  text: string;
  latencyMs: number;
  usage?: AITokenUsage;
  /** True when Gemini failed and Groq was used as the fallback. */
  fallbackUsed: boolean;
}

/** Structured failure — never throws, always returns a shaped error. */
export interface AITextFailure {
  success: false;
  provider: AIProviderName;
  message: string;
  retryable: boolean;
  latencyMs: number;
}

export type AITextResult = AITextSuccess | AITextFailure;

/** Logged event emitted by the provider selection layer. */
export interface AIEvent {
  type: "request" | "success" | "failure" | "fallback" | "not-configured";
  provider: AIProviderName;
  model?: string;
  latencyMs?: number;
  usage?: AITokenUsage;
  message?: string;
  retryable?: boolean;
  /** Non-secret metadata (task label, call site). */
  meta?: Record<string, unknown>;
}

/** Optional logger injection point (defaults to console). */
export interface AILogger {
  (event: AIEvent): void;
}
