// ==========================================================
// Atlas
// packages/domain/decision — barrel exports
// ==========================================================

export * from "./decision.types";

// Engine components
export { DecisionEngine, type DecisionStore } from "./decision.engine";
export { DecisionPipeline, type DecisionPipelineDependencies } from "./decision.pipeline";
export { ConfidenceScorer, DEFAULT_CONFIDENCE_WEIGHTS, type ConfidenceWeights } from "./decision.confidence";
export { RiskScorer } from "./decision.risk";
export { EvidenceCollector, REQUIRED_EVIDENCE_TYPES } from "./decision.evidence";
export { RecommendationBuilder } from "./decision.recommendation";
export { RecommendationValidator, SUPPLEMENT_CONFIDENCE_THRESHOLD, MIN_SUPPORTING_EVIDENCE } from "./decision.validator";
export {
  RulesBasedComplianceGateway,
  DEFAULT_COMPLIANCE_RULES,
} from "./decision.compliance";

// Service + repository
export { DecisionService, type DecisionContextSource } from "./decision.service";
export {
  DecisionRepository,
  toDecisionRecord,
  mapScoreRow,
  evidenceNodesFromInput,
  mapStageToReasoningType,
} from "./decision.repository";

// Continuous learning (pure analytics — never retrains models)
export {
  computeLearningMetrics,
  type DecisionOutcomeInput,
  type LearningMetrics,
  type LearningOutcomeRow,
} from "./decision.learning";

// Export package builder
export {
  buildExportPackage,
  exportPackageToMarkdown,
  type ExportPackage,
  type DecisionContextPayload,
} from "./decision.export";

// Voice layer (provider-agnostic, Elemental adapter + grounded fallback)
export { VoiceService } from "./voice/voice-service";
export { ElementalVoiceProvider } from "./voice/providers/elemental";
export { GroundedTextProvider } from "./voice/providers/grounded";
export type {
  VoiceProvider,
  VoiceGenerationRequest,
  VoiceGenerationResponse,
  VoiceExplanation,
  GroundedDecisionContext,
} from "./voice/voice.types";
