// ==========================================================
// Atlas
// decision.types.ts
// Decision Engine Domain Types
// ==========================================================

//
// ENUMS
//

export type DecisionType =
  | "SUPPLEMENT_OPPORTUNITY"
  | "COMPLIANCE_WARNING"
  | "DOCUMENT_REQUEST"
  | "CLAIM_REVIEW";

export type DecisionStatus =
  | "GENERATED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED";

export type DecisionPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type RiskType =
  | "MISSING_DOCUMENTATION"
  | "INSUFFICIENT_EVIDENCE"
  | "COMPLIANCE_FAILURE"
  | "CONFLICTING_INFORMATION"
  | "REVENUE_LEAKAGE";

export type RiskSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type ActionType =
  | "REVIEW"
  | "REQUEST_DOCUMENT"
  | "UPDATE_ESTIMATE"
  | "CONTACT_ADJUSTER"
  | "SUBMIT_SUPPLEMENT";

export type ActionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type ApprovalStatus =
  | "APPROVED"
  | "REJECTED"
  | "REQUEST_CHANGES";

export type ConfidenceLabel =
  | "VERY_LOW"
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "VERY_HIGH";

export type RiskLevel =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "CRITICAL";

export type EvidenceImpact =
  | "HIGH"
  | "MEDIUM"
  | "LOW";

//
// DECISION OBJECT
//

export interface Decision {
  id: string;
  organizationId: string;
  claimId: string;
  decisionType: DecisionType;
  status: DecisionStatus;
  title: string;
  description: string;
  recommendation: string;
  confidenceScore: number;
  riskScore: number;
  priority: DecisionPriority;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

//
// CREATE DECISION REQUEST
//

export interface CreateDecisionRequest {
  organizationId: string;
  claimId: string;
  decisionType: DecisionType;
  title: string;
  description: string;
  recommendation: string;
  confidenceScore: number;
  riskScore: number;
  priority: DecisionPriority;
}

//
// DECISION SCORE
//

export interface DecisionScore {
  id: string;
  decisionId: string;
  evidenceScore: number;
  coverageScore: number;
  complianceScore: number;
  riskFactorScore: number;
  finalScore: number;
  calculationDetails: Record<string, unknown>;
  createdAt: Date;
}

//
// EVIDENCE LINK
//

export interface DecisionEvidenceLink {
  id: string;
  decisionId: string;
  evidenceNodeId: string;
  relationshipType:
    | "SUPPORTS"
    | "PRIMARY_REASON"
    | "SECONDARY_REASON"
    | "RISK_INDICATOR";
  importanceScore: number;
  createdAt: Date;
}

//
// RISK OBJECT
//

export interface DecisionRisk {
  id: string;
  decisionId: string;
  riskType: RiskType;
  severity: RiskSeverity;
  description: string;
  mitigation: string;
  createdAt: Date;
}

//
// ACTION OBJECT
//

export interface DecisionAction {
  id: string;
  decisionId: string;
  actionType: ActionType;
  description: string;
  status: ActionStatus;
  assignedTo?: string;
  completedAt?: Date;
}

//
// APPROVAL OBJECT
//

export interface DecisionApproval {
  id: string;
  decisionId: string;
  reviewerId: string;
  approvalStatus: ApprovalStatus;
  comments?: string;
  createdAt: Date;
}

//
// REASONING LOG
//

export interface DecisionReasoningLog {
  id: string;
  decisionId: string;
  reasoningType:
    | "EVIDENCE_ANALYSIS"
    | "COMPLIANCE_CHECK"
    | "RISK_ASSESSMENT"
    | "SUPPLEMENT_ANALYSIS";
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  createdAt: Date;
}

//
// DECISION CONTEXT
//
// Input provided to Decision Engine
//

export interface DecisionContext {
  claimId: string;
  evidenceNodes: EvidenceInput[];
  evidenceRelationships: any[];
  complianceResults: any[];
  historicalData?: Record<string, unknown>;
}

//
// DECISION RESULT
//

export interface DecisionResult {
  decision: Decision;
  supportingEvidence: EvidenceInput[];
  risks: DecisionRisk[];
  recommendedActions: DecisionAction[];
  explanation: string;
}

//
// SUPPLEMENT DECISION CONTEXT
//

export interface SupplementDecisionContext {
  claimId: string;
  missingScope: string[];
  supportingEvidence: EvidenceInput[];
  estimatedImpact: number;
  confidenceScore: number;
  requiresApproval: boolean;
}

//
// VOICE ASSISTANT RESPONSE
//

export interface DecisionVoiceResponse {
  decisionId: string;
  summary: string;
  recommendation: string;
  confidenceScore: number;
  risks: string[];
  nextActions: string[];
}

//
// DECISION QUERY
//

export interface DecisionQuery {
  claimId?: string;
  organizationId: string;
  decisionTypes?: DecisionType[];
  statuses?: DecisionStatus[];
  minimumConfidence?: number;
}

// ==========================================================
// DECISION ENGINE — STRUCTURED OUTPUT TYPES
// ==========================================================

//
// EVIDENCE INPUT
//
// Normalized evidence node fed into the Decision Pipeline.
//

export interface EvidenceInput {
  id: string;
  nodeType: string; // CLAIM | DOCUMENT | PHOTO | ESTIMATE_ITEM | POLICY_REQUIREMENT | DAMAGE_AREA | MATERIAL | RECOMMENDATION
  sourceType: string; // USER | DOCUMENT_AI | COMPUTER_VISION | SYSTEM | EXTERNAL_IMPORT
  sourceId: string;
  title: string;
  confidenceScore: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

//
// EVIDENCE SUMMARY
//

export interface EvidenceSummary {
  totalEvidence: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  averageConfidence: number;
  coverage: number; // 0-1 fraction of required evidence types present
  requiredTypes: string[];
  presentTypes: string[];
  missingTypes: string[];
}

//
// CONFIDENCE FACTOR
//

export interface ConfidenceFactor {
  name: string;
  weight: number;
  score: number; // 0-1
  contribution: number; // weight * score
}

//
// CONFIDENCE SCORE
//

export interface ConfidenceScore {
  value: number; // 0-1
  label: ConfidenceLabel;
  factors: ConfidenceFactor[];
  details: Record<string, number>;
}

//
// RISK FACTOR
//

export interface RiskFactor {
  type: RiskType;
  severity: RiskSeverity;
  description: string;
  points: number; // risk points contributed
  mitigation?: string;
}

//
// RISK ASSESSMENT
//

export interface RiskAssessment {
  score: number; // 0-100
  level: RiskLevel;
  factors: RiskFactor[];
}

//
// MISSING EVIDENCE
//

export interface MissingEvidence {
  type: string;
  description: string;
  severity: RiskSeverity;
  impact: EvidenceImpact;
  sourceHint?: string;
}

//
// RECOMMENDATION
//

export interface Recommendation {
  id: string;
  type: DecisionType;
  title: string;
  description: string;
  confidence: number;
  priority: DecisionPriority;
  supportingEvidenceIds: string[];
  missingEvidenceIds: string[];
  suggestedActions: ActionType[];
  requiresHumanApproval: boolean;
  rulesApplied: string[];
}

//
// RECOMMENDATION VALIDATION RESULT
//

export interface RecommendationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: Recommendation[];
}

//
// COMPLIANCE GATEWAY RESULT
//
// Output of the compliance validation step (uses existing ComplianceRulesEngine).
//

export interface ComplianceGatewayResult {
  status: string; // READY | NEEDS_REVIEW | MISSING_INFORMATION | NON_COMPLIANT
  score: number; // 0-100
  ruleResults: {
    ruleId: string;
    result: string;
    message: string;
    evidenceReferences: string[];
  }[];
  violations: string[];
}

//
// COMPLIANCE GATEWAY INTERFACE
//
// Clean interface for compliance validation. The default implementation
// reuses the existing ComplianceRulesEngine; a repository-backed gateway
// can be plugged in once compliance tables exist.
//

export interface ComplianceGateway {
  evaluate(
    context: DecisionComplianceContext
  ): Promise<ComplianceGatewayResult> | ComplianceGatewayResult;
}

export interface DecisionComplianceContext {
  claimId: string;
  claimType: string;
  evidenceNodes: EvidenceInput[];
  documents: any[];
  decisions: any[];
  workflowState?: Record<string, unknown>;
}

//
// DECISION PIPELINE INPUT
//
// Normalized claim snapshot collected from existing modules
// (claims, documents, interviews, supplements, activity timeline, AI drafts).
//

export interface DecisionPipelineInput {
  claimId: string;
  organizationId: string;
  claim: {
    id?: string;
    claimNumber: string;
    insuranceCompany?: string;
    policyNumber?: string;
    dateOfLoss?: string;
    causeOfLoss?: string;
    description?: string;
    status?: string;
    estimatedValue?: number;
    approvedValue?: number;
    deductible?: number;
    customerName?: string;
  };
  documents: {
    id: string;
    type?: string;
    name: string;
    confidence?: number;
    mimeType?: string;
    createdAt?: string;
  }[];
  interviews: {
    id: string;
    status: string;
    templateName?: string;
    progress?: number;
    responses?: Record<string, unknown>;
    completedAt?: string;
  }[];
  supplements: {
    id: string;
    supplementNumber: string;
    status: string;
    requestedAmount?: number;
    approvedAmount?: number;
    lineItems?: {
      id?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[];
  }[];
  activity: {
    id: string;
    type?: string;
    description?: string;
    createdAt?: string;
  }[];
  aiRecommendations?: {
    id: string;
    description: string;
    category?: string;
    amount?: number;
    confidence?: number;
    evidence?: string[];
  }[];
  policy?: {
    insuranceCompany?: string;
    policyNumber?: string;
    deductible?: number;
  };
  historicalData?: Record<string, unknown>;
}

//
// REASONING TRACE ENTRY
//

export interface ReasoningTraceEntry {
  stage: string;
  input: unknown;
  output: unknown;
}

//
// DECISION RECORD
//
// Persisted form of a Decision Engine execution (DECISION-002).
// One row per version — never overwrite previous decisions.
//

export type HumanReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REQUEST_CHANGES";

export interface DecisionRecord {
  id: string;
  organizationId: string; // maps to company_id in the DB
  claimId: string;
  claimNumber?: string;
  version: number;
  decisionType: DecisionType;
  status: DecisionStatus;
  title: string;
  description?: string;
  recommendation?: string;
  confidenceScore: number;
  riskScore: number;
  priority: DecisionPriority;
  evidenceSummary?: EvidenceSummary;
  evidenceNodes?: EvidenceInput[];
  recommendations?: Recommendation[];
  missingEvidence?: MissingEvidence[];
  reasoningTrace?: ReasoningTraceEntry[];
  riskFactors?: RiskFactor[];
  complianceStatus?: string;
  complianceScore?: number;
  humanReviewStatus: HumanReviewStatus;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

//
// DECISION PIPELINE RESULT
//

export interface DecisionPipelineResult {
  claimId: string;
  organizationId: string;
  generatedAt: Date;
  evidence: EvidenceSummary;
  confidence: ConfidenceScore;
  risk: RiskAssessment;
  recommendations: Recommendation[];
  missingEvidence: MissingEvidence[];
  compliance: ComplianceGatewayResult;
  sufficientEvidence: boolean;
  requiresHumanApproval: boolean;
  explanation: string;
  reasoningTrace: ReasoningTraceEntry[];
}
