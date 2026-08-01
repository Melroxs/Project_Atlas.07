/**
 * UnifiedAIProvider — bridges the existing supplement-engine `AIProvider`
 * interface to the unified `generateText()` layer.
 *
 * The supplement engine keeps its interface; the provider behind it is now
 * provider-agnostic (Gemini primary, Groq fallback).
 */

import { AIProvider, AICompletionRequest, AICompletionResponse } from "./types";
import { generateText, getActiveProvider, isAIConfigured } from "./generate";

export class UnifiedAIProvider implements AIProvider {
  private model: string;

  constructor(options: { model?: string } = {}) {
    this.model = options.model || "";
  }

  isAvailable(): boolean {
    return isAIConfigured();
  }

  getProviderName(): string {
    return getActiveProvider();
  }

  getModel(): string {
    return this.model;
  }

  async generateCompletion(request: AICompletionRequest): Promise<AICompletionResponse> {
    const result = await generateText({
      prompt: request.prompt,
      systemPrompt: request.systemPrompt,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      model: request.model || this.model || undefined,
    });

    if (!result.success) {
      throw new Error(`AI provider error: ${result.message}`);
    }

    return {
      content: result.text,
      model: result.model,
      usage: result.usage
        ? {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined,
      metadata: {
        provider: result.provider,
        fallbackUsed: result.fallbackUsed,
        latencyMs: result.latencyMs,
        ...request.context,
      },
    };
  }
}
