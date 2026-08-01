/**
 * AI Supplement Generation Engine Types
 * 
 * This module defines the core interfaces for the AI-powered supplement generation system.
 * The architecture is designed to be provider-agnostic, allowing easy swapping of AI providers.
 */

// ============================================================================
// AI Provider Interface
// ============================================================================

export interface AIProvider {
  /**
   * Generate a completion from the AI provider
   */
  generateCompletion(request: AICompletionRequest): Promise<AICompletionResponse>;
  
  /**
   * Check if the provider is available and configured
   */
  isAvailable(): boolean;
  
  /**
   * Get the provider name
   */
  getProviderName(): string;
}

export interface AICompletionRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  context?: Record<string, any>;
}

export interface AICompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
}

// ============================================================================
// Prompt Builder Interface
// ============================================================================

export interface PromptBuilder {
  /**
   * Build a prompt for supplement generation
   */
  buildSupplementPrompt(context: SupplementGenerationContext): string;
  
  /**
   * Build a system prompt for the AI
   */
  buildSystemPrompt(): string;
}

export interface SupplementGenerationContext {
  claim: ClaimContext;
  property?: PropertyContext;
  customer?: CustomerContext;
  interviewResponses?: InterviewResponseContext;
  adjuster?: AdjusterContext;
  documents?: DocumentContext[];
  photos?: PhotoContext[];
  existingSupplements?: SupplementContext[];
  activityTimeline?: ActivityContext[];
}

export interface ClaimContext {
  id?: string;
  claimNumber: string;
  insuranceCompany: string;
  policyNumber?: string;
  dateOfLoss: string;
  causeOfLoss?: string;
  description: string;
  status: string;
  deductible?: number;
  estimatedValue?: number;
  approvedValue?: number;
}

export interface PropertyContext {
  id?: string;
  address: string;
  type?: string;
  yearBuilt?: number;
  squareFootage?: number;
  occupancy?: string;
}

export interface CustomerContext {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface InterviewResponseContext {
  interviewId?: string;
  interviewNumber?: string;
  templateName?: string;
  responses?: Record<string, any>;
  completedAt?: string;
}

export interface AdjusterContext {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
}

export interface DocumentContext {
  id?: string;
  type?: string;
  name: string;
  uploadedAt?: string;
  url?: string;
  content?: string;
}

export interface PhotoContext {
  id?: string;
  description?: string;
  url: string;
  uploadedAt?: string;
  location?: string;
}

export interface SupplementContext {
  id?: string;
  supplementNumber: string;
  status: string;
  requestedAmount: number;
  approvedAmount: number;
  lineItems?: SupplementLineItem[];
  createdAt?: string;
  submittedAt?: string;
  responseDate?: string;
}

export interface SupplementLineItem {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  category?: string;
}

export interface ActivityContext {
  id?: string;
  type?: string;
  description?: string;
  createdAt?: string;
  userId?: string;
  userName?: string;
}

// ============================================================================
// Result Parser Interface
// ============================================================================

export interface ResultParser {
  /**
   * Parse AI response into structured supplement recommendations
   */
  parseSupplementRecommendations(
    aiResponse: string,
    context: SupplementGenerationContext
  ): SupplementRecommendations;
  
  /**
   * Validate parsed results
   */
  validateRecommendations(recommendations: SupplementRecommendations): ValidationResult;
}

export interface SupplementRecommendations {
  version: number;
  generatedAt: string;
  confidenceScore: number;
  riskScore: number;
  missingDamageObservations: DamageObservation[];
  recommendedLineItems: RecommendedLineItem[];
  suggestedQuantities: QuantitySuggestion[];
  suggestedPricing: PricingSuggestion[];
  supportingJustification: string;
  documentationChecklist: DocumentationChecklistItem[];
  missingInformation: MissingInformationItem[];
  questionsForEstimator: string[];
  warnings: string[];
  evidenceLinks: EvidenceLink[];
  aiExplanation: AIExplanation;
}

export interface DamageObservation {
  id: string;
  location: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  evidence: string[];
  interviewAnswers: string[];
}

export interface RecommendedLineItem {
  id: string;
  description: string;
  category: string;
  suggestedQuantity: number;
  suggestedUnit: string;
  suggestedUnitPrice: number;
  suggestedTotalPrice: number;
  confidence: number;
  justification: string;
  evidence: string[];
  interviewAnswers: string[];
  documents: string[];
}

export interface QuantitySuggestion {
  lineItemId: string;
  currentQuantity: number;
  suggestedQuantity: number;
  reason: string;
  confidence: number;
}

export interface PricingSuggestion {
  lineItemId: string;
  currentUnitPrice: number;
  suggestedUnitPrice: number;
  reason: string;
  confidence: number;
  marketData?: string;
}

export interface DocumentationChecklistItem {
  id: string;
  description: string;
  type: 'photo' | 'document' | 'estimate' | 'report';
  status: 'required' | 'recommended' | 'optional';
  reason: string;
}

export interface MissingInformationItem {
  id: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  source: string;
}

export interface EvidenceLink {
  recommendationId: string;
  documentId: string;
  documentType: string;
  relevance: 'high' | 'medium' | 'low';
  description: string;
}

export interface AIExplanation {
  overallApproach: string;
  dataSourcesAnalyzed: string[];
  confidenceFactors: string[];
  limitations: string[];
  recommendations: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Validation Service Interface
// ============================================================================

export interface ValidationService {
  /**
   * Validate supplement recommendations before presentation
   */
  validateRecommendations(
    recommendations: SupplementRecommendations,
    context: SupplementGenerationContext
  ): ValidationResult;
  
  /**
   * Check for potential issues or conflicts
   */
  checkForIssues(
    recommendations: SupplementRecommendations,
    context: SupplementGenerationContext
  ): Issue[];
}

export interface Issue {
  id: string;
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high';
  message: string;
  recommendation?: string;
}

// ============================================================================
// AI Service Configuration
// ============================================================================

export interface AIServiceConfig {
  /**
   * AI provider to use (e.g., 'openai', 'anthropic')
   */
  provider?: string;
  
  /**
   * Model to use for AI generation
   */
  model?: string;
  
  /**
   * API key for the AI provider
   */
  apiKey?: string;
  
  /**
   * Temperature for AI generation (0-1)
   */
  temperature?: number;
  
  /**
   * Maximum tokens for AI generation
   */
  maxTokens?: number;
}

// ============================================================================
// Recommendation Engine Interface
// ============================================================================

export interface RecommendationEngine {
  /**
   * Generate supplement recommendations
   */
  generateRecommendations(
    context: SupplementGenerationContext
  ): Promise<SupplementRecommendations>;
  
  /**
   * Compare two versions of recommendations
   */
  compareVersions(
    version1: SupplementRecommendations,
    version2: SupplementRecommendations
  ): VersionComparison;
}

export interface VersionComparison {
  version1: number;
  version2: number;
  changes: VersionChange[];
  summary: string;
}

export interface VersionChange {
  type: 'added' | 'removed' | 'modified';
  category: string;
  description: string;
  oldValue?: any;
  newValue?: any;
  impact: 'low' | 'medium' | 'high';
}