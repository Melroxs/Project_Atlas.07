/**
 * Provider selection layer.
 *
 * Reads `AI_PROVIDER` (default "gemini"). Primary = Gemini; if Gemini is
 * unavailable or fails, falls back to Groq. Never throws to application
 * code — always returns a structured `AITextResult`.
 *
 * Future providers (OpenAI, Anthropic, OpenRouter, Ollama) can be added here
 * without changing application code.
 */

import {
  AITextRequest,
  AITextResult,
  AIProviderName,
  AIEvent,
  AILogger,
  AITokenUsage,
} from "./types";
import { GEMINI_DEFAULT_MODEL } from "./gemini";
import { GROQ_DEFAULT_MODEL } from "./groq";
import {
  generateWithGemini,
  isGeminiConfigured,
} from "./gemini";
import {
  generateWithGroq,
  isGroqConfigured,
} from "./groq";

/** Default logger: structured JSON lines to console. */
const defaultLogger: AILogger = (event: AIEvent) => {
  const line = `[atlas-ai] ${JSON.stringify(event)}`;
  if (event.type === "failure") {
    console.error(line);
  } else {
    console.log(line);
  }
};

let logger: AILogger = defaultLogger;

/** Override the logger (useful for tests or app-level loggers). */
export function setAILogger(next: AILogger): void {
  logger = next;
}

/** Resolve the configured provider from AI_PROVIDER (default "gemini"). */
export function getActiveProvider(): AIProviderName {
  const configured = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  return configured === "groq" ? "groq" : "gemini";
}

/** True if at least one free provider has a key configured. */
export function isAIConfigured(): boolean {
  return isGeminiConfigured() || isGroqConfigured();
}

/** Default model for the active provider (for logging/metadata). */
export function getActiveModel(): string {
  return getActiveProvider() === "groq" ? GROQ_DEFAULT_MODEL : GEMINI_DEFAULT_MODEL;
}

/** Wrap a provider call with timing + logging, returning raw text. */
async function callProvider(
  provider: AIProviderName,
  request: AITextRequest,
  meta: Record<string, unknown>
): Promise<{ text: string; model: string; usage?: AITokenUsage }> {
  const started = Date.now();
  if (provider === "gemini") {
    const r = await generateWithGemini(request);
    const latencyMs = Date.now() - started;
    logger({
      type: "success",
      provider: "gemini",
      model: r.model,
      latencyMs,
      usage: {
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        totalTokens: r.totalTokens,
      },
      meta,
    });
    return {
      text: r.text,
      model: r.model,
      usage: {
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        totalTokens: r.totalTokens,
      },
    };
  }
  const r = await generateWithGroq(request);
  const latencyMs = Date.now() - started;
  logger({
    type: "success",
    provider: "groq",
    model: r.model,
    latencyMs,
    usage: {
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
    },
    meta,
  });
  return {
    text: r.text,
    model: r.model,
    usage: {
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
    },
  };
}

/**
 * The ONLY entry point application code should call.
 *
 * Logic:
 *   if provider == gemini
 *       try Gemini
 *       if failure -> use Groq
 *   else
 *       use Groq
 */
export async function generateText(
  request: AITextRequest,
  meta: Record<string, unknown> = {}
): Promise<AITextResult> {
  const started = Date.now();
  const configured = getActiveProvider();

  if (!isAIConfigured()) {
    const latencyMs = Date.now() - started;
    logger({
      type: "not-configured",
      provider: configured,
      message: "No AI provider configured: set GOOGLE_API_KEY and/or GROQ_API_KEY",
      latencyMs,
      meta,
    });
    return {
      success: false,
      provider: configured,
      message: "No AI provider configured: set GOOGLE_API_KEY and/or GROQ_API_KEY",
      retryable: true,
      latencyMs,
    };
  }

  // --- Provider is Groq (no fallback needed) ---
  if (configured === "groq") {
    try {
      const r = await callProvider("groq", request, meta);
      return { success: true, provider: "groq", model: r.model, text: r.text, latencyMs: Date.now() - started, usage: r.usage, fallbackUsed: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger({ type: "failure", provider: "groq", message, retryable: true, latencyMs: Date.now() - started, meta });
      return { success: false, provider: "groq", message, retryable: true, latencyMs: Date.now() - started };
    }
  }

  // --- Provider is Gemini: try Gemini, fall back to Groq ---
  try {
    const r = await callProvider("gemini", request, meta);
    return { success: true, provider: "gemini", model: r.model, text: r.text, latencyMs: Date.now() - started, usage: r.usage, fallbackUsed: false };
  } catch (geminiError) {
    const geminiMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
    logger({
      type: "failure",
      provider: "gemini",
      message: geminiMessage,
      retryable: true,
      latencyMs: Date.now() - started,
      meta,
    });

    if (!isGroqConfigured()) {
      return {
        success: false,
        provider: "gemini",
        message: `Gemini failed and no fallback is configured: ${geminiMessage}`,
        retryable: true,
        latencyMs: Date.now() - started,
      };
    }

    logger({ type: "fallback", provider: "groq", message: "Falling back from Gemini to Groq", meta });
    try {
      const r = await callProvider("groq", request, meta);
      return { success: true, provider: "groq", model: r.model, text: r.text, latencyMs: Date.now() - started, usage: r.usage, fallbackUsed: true };
    } catch (groqError) {
      const groqMessage = groqError instanceof Error ? groqError.message : String(groqError);
      logger({ type: "failure", provider: "groq", message: groqMessage, retryable: true, latencyMs: Date.now() - started, meta });
      return {
        success: false,
        provider: "gemini",
        message: `Gemini and Groq both failed. Gemini: ${geminiMessage} | Groq: ${groqMessage}`,
        retryable: true,
        latencyMs: Date.now() - started,
      };
    }
  }
}
