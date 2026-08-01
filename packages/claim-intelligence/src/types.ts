// packages/claim-intelligence/src/types.ts
/**
 * Shared vocabulary for the Atlas Claim Intelligence Layer.
 *
 * The engine is PURE: it consumes a ClaimBundle (plain data, no DB handles)
 * and produces a ClaimIntelligenceModel. Both the Fastify API and the Next.js
 * dashboard load a ClaimBundle from their own DB layer and run this same
 * engine — one source of truth, no duplicated business logic.
 */

// ============================================================================
// Input: ClaimBundle — everything the engine needs to know about a claim.
// ============================================================================

export interface ClaimBundleDocument {
  id: string;
  fileName: string;
  url: string;
  mimeType?: string | null;
  createdAt: string;
  // Heuristic classification (set by the loader):
  isPhoto?: boolean;
  isPolicy?: boolean;
  isEstimate?: boolean;
  isCarrierDocument?: boolean;
  isContractorDocument?: boolean;
  isSigned?: boolean;
  duplicateOf?: string; // id of another doc with the same fileName/url
  conflictDetected?: boolean; // estimate whose amounts conflict with the carrier's
}

export interface ClaimBundleSupplement {
  id: string;
  supplementNumber: string;
  status: string;
  requestedAmount?: number | null;
  approvedAmount?: number | null;
  lineItems?: { description?: string; total?: number | null }[] | null;
  submissionDate?: string | null;
  responseDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimBundleInterview {
  id: string;
  status: string;
  progress?: number | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface ClaimBundleCommunication {
  id: string;
  source: 'note' | 'activity' | 'ai_conversation';
  content: string;
  createdAt: string;
}

export interface ClaimBundleEvidenceLink {
  id: string;
  recommendationId: string;
  documentId?: string | null;
  strengthScore?: string | number | null;
  relevance?: string | null;
}

export interface ClaimBundle {
  claimId: string;
  companyId: string;
  claimNumber: string;
  status: string;
  entryPoint?: string | null;
  dateOfLoss?: string | null;
  dateReported?: string | null;
  insuranceCompany?: string | null;
  policyNumber?: string | null;
  deductible?: number | null;
  estimatedValue?: number | null;
  approvedValue?: number | null;
  description?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  propertyId?: string | null;
  createdAt: string;
  updatedAt: string;
  property?: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null;
  documents: ClaimBundleDocument[];
  supplements: ClaimBundleSupplement[];
  interviews: ClaimBundleInterview[];
  communications: ClaimBundleCommunication[];
  evidenceLinks: ClaimBundleEvidenceLink[];
}

// ============================================================================
// Output: the live intelligence model for one claim.
// ============================================================================

export type FactorKey =
  | 'evidenceQuality'
  | 'documentation'
  | 'policyReferences'
  | 'carrierResponseCoverage'
  | 'compliance'
  | 'aiConfidence';

export interface RecoveryFactor {
  key: FactorKey;
  label: string;
  weight: number; // 0-100 share
  score: number; // 0-100
  contribution: number; // weight * score / 100
  explanation: string;
}

export interface RecoveryReadiness {
  score: number; // 0-100
  factors: RecoveryFactor[];
  level: 'low' | 'medium' | 'high';
  label: string;
}

export interface ClaimHealth {
  score: number; // 0-100
  level: 'critical' | 'at_risk' | 'healthy';
  label: string;
}

export interface Risk {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  detail: string;
  evidenceIds?: string[];
}

export interface MissingInformation {
  id: string;
  label: string;
  detail: string;
  requiredFor: string[];
}

export interface NextBestAction {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  requiredAction: string;
  confidence: number; // 0-1
  supportingEvidence: {
    documentIds: string[];
    photoIds: string[];
    policySections: string[];
    estimateLineItems: string[];
  };
  relatedSection: string;
  explanation: {
    why: string;
    evidenceUsed: string[];
    documentsUsed: string[];
    photosReferenced: string[];
    policySectionsReferenced: string[];
    lineItemsContributed: string[];
  };
}

export type KnowledgeNodeType =
  | 'customer'
  | 'property'
  | 'claim'
  | 'policy'
  | 'carrier'
  | 'adjuster'
  | 'inspection'
  | 'photo'
  | 'document'
  | 'estimate'
  | 'communication'
  | 'evidence'
  | 'supplement'
  | 'invoice'
  | 'payment';

export interface KnowledgeNode {
  id: string;
  type: KnowledgeNodeType;
  label: string;
  summary?: string;
  reference?: string; // URL / claim number / policy number etc.
}

export interface KnowledgeEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  relation: string;
  strength?: number; // 0-1
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface ClaimIntelligenceModel {
  claimId: string;
  claimNumber: string;
  analyzedAt: string;
  health: ClaimHealth;
  recoveryReadiness: RecoveryReadiness;
  evidenceCompleteness: number; // 0-100
  documentationCompleteness: number; // 0-100
  policyAnalysisStatus: 'not_analyzed' | 'analyzed' | 'partial' | 'not_applicable';
  complianceStatus: 'passed' | 'attention' | 'not_run' | 'not_applicable';
  aiConfidence: number; // 0-100
  missingInformation: MissingInformation[];
  openRisks: Risk[];
  nextBestActions: NextBestAction[];
  knowledgeGraph: KnowledgeGraph;
}

// ============================================================================
// Communications intelligence
// ============================================================================

export type ExtractedEntityType =
  | 'claim_number'
  | 'policy_number'
  | 'date'
  | 'adjuster_name'
  | 'customer_name'
  | 'damage_description'
  | 'address'
  | 'promise'
  | 'requested_document'
  | 'deadline';

export interface ExtractedEntity {
  id: string;
  entityType: ExtractedEntityType;
  value: string;
  confidence: number; // 0-1
  context: string; // surrounding text snippet
  sourceCommunicationId: string;
  source: string; // note | activity | ai_conversation
}

// ============================================================================
// Domain events (event-driven architecture)
// ============================================================================

export type DomainEventType =
  | 'claim.created'
  | 'claim.updated'
  | 'document.uploaded'
  | 'photo.uploaded'
  | 'estimate.uploaded'
  | 'policy.uploaded'
  | 'communication.added'
  | 'carrier.response'
  | 'timeline.updated'
  | 'compliance.completed'
  | 'intelligence.reanalyzed';

export interface DomainEvent {
  id: string;
  companyId: string;
  claimId?: string;
  eventType: DomainEventType;
  entityType: string;
  entityId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface EventSubscriber {
  (event: DomainEvent): void | Promise<void>;
}

// ============================================================================
// Operations Intelligence Layer (Phase 3) — AI Case Manager & dashboards
// ============================================================================

export type LifecycleStage =
  | 'lead'
  | 'inspection_scheduled'
  | 'inspection_complete'
  | 'claim_created'
  | 'carrier_review'
  | 'documentation_requested'
  | 'supplement_preparation'
  | 'supplement_submitted'
  | 'negotiation'
  | 'approved'
  | 'final_payment'
  | 'closed';

export interface LifecycleStageDef {
  stage: LifecycleStage;
  label: string;
  index: number;
  reached: boolean;
  evidence: string[];
}

export interface LifecycleInfo {
  currentStage: LifecycleStage;
  currentIndex: number;
  totalStages: number;
  progressPct: number; // 0-100
  nextStage: LifecycleStage | null;
  missingRequirements: MissingInformation[];
  blockingIssues: Risk[];
  recommendedActions: string[];
  stages: LifecycleStageDef[];
}

// ---------------------------------------------------------------------------
// Financial Intelligence
// ---------------------------------------------------------------------------
export interface FinancialFigure {
  key: string;
  label: string;
  value: number | null;
  source: string; // where the number came from (claim field, supplement, estimate)
  evidence: string[]; // supporting documents/supplements
  confidence: number; // 0-1
}

export interface FinancialIntelligence {
  originalEstimate: number | null;
  carrierApprovedAmount: number | null;
  contractorEstimate: number | null;
  supplementValue: number; // sum of supplement requested amounts
  recoveredRevenue: number; // sum of approved amounts
  outstandingRevenue: number; // supplementValue - recoveredRevenue (>= 0)
  potentialRecovery: number | null; // contractor scope not yet recovered
  estimatedRecoveryOpportunity: number | null;
  confidenceScore: number; // 0-100
  figures: FinancialFigure[];
}

export type RevenueOpportunityType =
  | 'missing_estimate_items'
  | 'pricing_discrepancy'
  | 'code_related'
  | 'matching_opportunity'
  | 'overhead_profit'
  | 'documentation_deficiency'
  | 'potential_supplement';

export interface RevenueOpportunity {
  id: string;
  type: RevenueOpportunityType;
  title: string;
  detail: string;
  estimatedValue: number | null;
  confidence: number; // 0-1
  priority: 'critical' | 'high' | 'medium' | 'low';
  evidence: string[];
  requiredAction: string;
  explanation: {
    why: string;
    documentsUsed: string[];
    estimateItemsContributed: string[];
    policyReferencesUsed: string[];
  };
}

export type OpsRecommendationCategory =
  | 'inspection'
  | 'evidence'
  | 'documentation'
  | 'carrier'
  | 'supplement'
  | 'escalation'
  | 'invoice';

export interface OperationalRecommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: OpsRecommendationCategory;
  title: string;
  reason: string;
  supportingEvidence: string[];
  confidence: number; // 0-1
  estimatedBusinessImpact: string;
  requiredUserAction: string;
}

// ---------------------------------------------------------------------------
// AI Case Manager
// ---------------------------------------------------------------------------
export interface CaseDeadline {
  label: string;
  date: string; // ISO
  daysUntil: number;
  severity: 'overdue' | 'due_soon' | 'upcoming';
  source: string;
}

export interface CaseManagerReport {
  claimId: string;
  claimNumber: string;
  monitoredAt: string;
  overallStatus: 'on_track' | 'attention' | 'stalled' | 'blocked';
  priorityScore: number; // 0-100 (higher = act first)
  stage: LifecycleStage;
  stageProgressPct: number;
  daysSinceLastUpdate: number;
  isStalled: boolean;
  stalledReason: string | null;
  deadlines: CaseDeadline[];
  issues: Risk[];
  missingDocumentation: MissingInformation[];
  nextActions: string[];
  aiSummary: string;
}

// ---------------------------------------------------------------------------
// Claim Digital Twin
// ---------------------------------------------------------------------------
export interface DigitalTwinCustomer {
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface DigitalTwinPolicy {
  policyNumber: string | null;
  deductible: number | null;
  analysisStatus: string;
  documents: number;
}

export interface DigitalTwinCarrier {
  name: string | null;
  responses: number;
  latestResponseAt: string | null;
  reviewDays: { supplement: string; days: number }[];
}

export interface DigitalTwin {
  claimId: string;
  claimNumber: string;
  generatedAt: string;
  customer: DigitalTwinCustomer;
  property: { address: string | null; city: string | null; state: string | null; zip: string | null } | null;
  policy: DigitalTwinPolicy;
  carrier: DigitalTwinCarrier;
  claim: {
    entryPoint: string | null;
    status: string;
    dateOfLoss: string | null;
    dateReported: string | null;
    createdAt: string;
    updatedAt: string;
    description: string | null;
  };
  timeline: { communications: number; events: number; first: string | null; last: string | null };
  photos: { count: number; ids: string[] };
  documents: { count: number; byType: Record<string, number> };
  inspections: { count: number; completed: number };
  estimates: { count: number; names: string[] };
  evidenceGraph: { links: number; strongLinks: number };
  knowledgeGraph: KnowledgeGraph;
  aiInsights: {
    healthScore: number;
    healthLevel: string;
    recoveryReadiness: number;
    aiConfidence: number;
    complianceStatus: string;
    openRisks: Risk[];
    missingInformation: MissingInformation[];
  };
  financial: FinancialIntelligence;
  supplements: { count: number; submitted: number; approved: number; totalRequested: number; totalApproved: number };
  carrierResponses: { count: number; latest: string | null };
  recommendations: { nextBestActions: number; operational: number };
}

// ---------------------------------------------------------------------------
// Operations model (orchestrated per claim)
// ---------------------------------------------------------------------------
export interface OperationsModel {
  claimId: string;
  claimNumber: string;
  generatedAt: string;
  lifecycle: LifecycleInfo;
  financial: FinancialIntelligence;
  opportunities: RevenueOpportunity[];
  recommendations: OperationalRecommendation[];
  caseManager: CaseManagerReport;
  digitalTwin: DigitalTwin;
}

// ---------------------------------------------------------------------------
// Company-wide analytics (portfolio / executive / revenue)
// ---------------------------------------------------------------------------
export interface PortfolioClaimSummary {
  claimId: string;
  claimNumber: string;
  status: string;
  insuranceCompany: string | null;
  customerName: string | null;
  entryPoint: string | null;
  lifecycleStage: LifecycleStage;
  healthScore: number;
  recoveryReadiness: number;
  aiConfidence: number;
  estimatedValue: number | null;
  recoveredRevenue: number;
  outstandingOpportunity: number;
  isStalled: boolean;
  atRisk: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineBucket {
  label: string;
  count: number;
  value: number;
}

export interface UpcomingDeadline {
  claimId: string;
  claimNumber: string;
  label: string;
  date: string;
  daysUntil: number;
  severity: CaseDeadline['severity'];
}

export interface ExecutiveDashboard {
  companyHealth: number;
  claimPipeline: PipelineBucket[];
  revenuePipeline: PipelineBucket[];
  highRiskClaims: PortfolioClaimSummary[];
  upcomingDeadlines: UpcomingDeadline[];
  teamWorkload: { label: string; count: number }[];
  aiRecommendations: { claimId: string; claimNumber: string; title: string; priority: string }[];
  revenueForecast: { bucket: string; value: number; confidence: number }[];
  operationalBottlenecks: { stage: LifecycleStage; count: number; avgDaysInStage: number; issue: string }[];
}

export interface PortfolioIntelligence {
  commonMissingDocumentation: { label: string; count: number }[];
  frequentlyDelayedStages: { stage: LifecycleStage; count: number }[];
  recurringCarrierRequests: { request: string; count: number }[];
  repeatedEvidenceGaps: { gap: string; count: number }[];
  claimsRequiringImmediateAttention: PortfolioClaimSummary[];
  revenueConcentrationByCarrier: { carrier: string; estimatedValue: number; pct: number }[];
  averageClaimDurationDays: number;
  supplementSuccessRates: {
    total: number;
    submitted: number;
    approved: number;
    approvedPct: number;
    valueApprovedPct: number;
  };
  trends: { label: string; value: number }[];
}

export interface RevenueRecoveryDashboard {
  totalActiveClaims: number;
  claimsAwaitingResponse: number;
  claimsReadyForSupplement: number;
  claimsMissingEvidence: number;
  claimsAtRisk: number;
  estimatedRecoverableRevenue: number;
  revenueAlreadyRecovered: number;
  outstandingOpportunity: number;
  averageClaimHealth: number;
  averageRecoveryReadiness: number;
  averageAIConfidence: number;
}

export interface CompanyOperationsOverview {
  generatedAt: string;
  revenue: RevenueRecoveryDashboard;
  executive: ExecutiveDashboard;
  portfolio: PortfolioIntelligence;
}
