/**
 * Project Atlas AI Services
 *
 * This package provides AI functionality for supplement generation and other
 * AI-powered features with a provider-agnostic architecture.
 *
 * Application code should call `generateText()` (re-exported below and via
 * `apps/web/src/lib/ai`) and never import a provider directly.
 */

// Unified free-AI layer (Gemini primary, Groq fallback)
export * from "./generate";

// Provider adapter that bridges the engine interface to generateText()
export { UnifiedAIProvider } from "./unified-provider";

// Legacy exports retained for backward compatibility
export * from "./types";
export { SupplementPromptBuilder } from "./prompt-builder";
export { OpenAIProvider } from "./providers/openai";
export { SupplementResultParser } from "./result-parser";
export { SupplementValidationService } from "./validation";
export { SupplementRecommendationEngine } from "./engine";

import { SupplementRecommendationEngine } from "./engine";
import { SupplementPromptBuilder } from "./prompt-builder";
import { UnifiedAIProvider } from "./unified-provider";
import { SupplementResultParser } from "./result-parser";
import { SupplementValidationService } from "./validation";
import { AIServiceConfig } from "./types";
import { isAIConfigured } from "./generate";

export interface AISupplementRequest {
  claimId: string;
  supplementId: string;
  context: {
    claim: any;
    property?: any;
    documents?: any[];
    interviewResponses?: any;
  };
}

export interface AISupplementResponse {
  supplementId: string;
  recommendations: any;
  confidence: number;
  generatedAt: string;
}

export interface AIConfig extends AIServiceConfig {
  openaiApiKey?: string;
  model?: string;
}

/**
 * AI Supplement Service - Simplified interface for Route Handlers
 *
 * Thin wrapper around the modular engine; the AI provider is the unified
 * free-AI layer (Gemini → Groq), never a paid provider by default.
 */
export class AISupplementService {
  private engine: SupplementRecommendationEngine;
  private config: AIConfig;

  constructor(config: AIConfig = {}) {
    this.config = {
      ...config,
    };

    // Initialize the modular components with the unified free-AI provider
    const promptBuilder = new SupplementPromptBuilder();
    const aiProvider = new UnifiedAIProvider({ model: this.config.model });
    const resultParser = new SupplementResultParser();
    const validationService = new SupplementValidationService();

    this.engine = new SupplementRecommendationEngine(
      promptBuilder,
      aiProvider,
      resultParser,
      validationService
    );
  }

  /**
   * Check if the AI service is properly configured (any free provider key set)
   */
  isConfigured(): boolean {
    return isAIConfigured();
  }

  /**
   * Generate supplement recommendations using AI (thin wrapper around modular engine)
   */
  async generateSupplementRecommendations(
    request: AISupplementRequest
  ): Promise<AISupplementResponse> {
    if (!this.isConfigured()) {
      throw new Error(
        'AI service is not configured. Please set GOOGLE_API_KEY or GROQ_API_KEY.'
      );
    }

    try {
      const context = {
        claim: request.context.claim,
        property: request.context.property,
        documents: request.context.documents,
        interviewResponses: request.context.interviewResponses ? {
          responses: request.context.interviewResponses
        } : undefined,
      };

      const recommendations = await this.engine.generateRecommendations(context);

      return {
        supplementId: request.supplementId,
        recommendations,
        confidence: recommendations.confidenceScore,
        generatedAt: recommendations.generatedAt,
      };
    } catch (error) {
      console.error('AI supplement generation error:', error);
      throw new Error(`Failed to generate AI supplement recommendations: ${error}`);
    }
  }

  /**
   * Get the underlying engine for advanced usage
   */
  getEngine(): SupplementRecommendationEngine {
    return this.engine;
  }
}

/**
 * Create a configured AI service instance
 */
export function createAIService(config?: AIConfig): AISupplementService {
  return new AISupplementService(config);
}

/**
 * Create a modular AI engine instance for advanced usage
 */
export function createAIEngine(config?: AIConfig): SupplementRecommendationEngine {
  const promptBuilder = new SupplementPromptBuilder();
  const aiProvider = new UnifiedAIProvider({ model: config?.model });
  const resultParser = new SupplementResultParser();
  const validationService = new SupplementValidationService();

  return new SupplementRecommendationEngine(
    promptBuilder,
    aiProvider,
    resultParser,
    validationService
  );
}
