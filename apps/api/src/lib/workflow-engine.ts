// apps/api/src/lib/workflow-engine.ts
/**
 * Atlas Multi-Entry Workflow Engine
 *
 * A pure, state-driven engine that lets contractors enter the claims lifecycle
 * at ANY stage. A Claim is the root entity; a Claim Package and a Supplement
 * are both OPTIONAL. Nothing blocks a task except missing *required* evidence
 * for that specific task.
 *
 * This module is intentionally dependency-free (no DB, no Fastify) so it can be
 * unit-tested in isolation.
 */

export type EntryPoint = 'new_claim' | 'existing_claim' | 'supplement_only' | 'imported';

export const ENTRY_POINTS: Record<EntryPoint, { label: string; description: string; icon: string }> = {
  new_claim: {
    label: 'Start New Claim',
    description: 'Customer intake, property, inspection, photos, documents, AI analysis.',
    icon: '🆕',
  },
  existing_claim: {
    label: 'Continue Existing Claim',
    description: 'Reconstruct context for an active claim from carrier + existing documents.',
    icon: '📄',
  },
  supplement_only: {
    label: 'Generate Supplement',
    description: 'Claim number, estimates, photos, documents → supplement immediately.',
    icon: '⚡',
  },
  imported: {
    label: 'Import Existing Project',
    description: 'Bring in customer, property, claim, photos, docs, estimates from another system.',
    icon: '📥',
  },
};

export const ENTRY_POINT_LABELS: Record<EntryPoint, string> = Object.fromEntries(
  Object.entries(ENTRY_POINTS).map(([k, v]) => [k, v.label])
) as Record<EntryPoint, string>;

// ============================================================================
// AI Tasks — each task has INDEPENDENT, evidence-based requirements.
// ============================================================================

export type AITask =
  | 'generate_claim_package'
  | 'generate_supplement'
  | 'analyze_policy'
  | 'review_carrier_estimate'
  | 'generate_narrative'
  | 'generate_recommendations';

export const AI_TASKS: AITask[] = [
  'generate_claim_package',
  'generate_supplement',
  'analyze_policy',
  'review_carrier_estimate',
  'generate_narrative',
  'generate_recommendations',
];

export const AI_TASK_LABELS: Record<AITask, string> = {
  generate_claim_package: 'Generate Claim Package',
  generate_supplement: 'Generate Supplement',
  analyze_policy: 'Analyze Policy',
  review_carrier_estimate: 'Review Carrier Estimate',
  generate_narrative: 'Generate Narrative',
  generate_recommendations: 'Generate Recommendations',
};

/** What evidence exists for a claim — the input to every readiness check. */
export interface EvidenceContext {
  claim: boolean;
  customer: boolean;
  property: boolean;
  insurance: boolean;
  evidence: boolean;
  inspection: boolean;
  photos: boolean;
  documents: boolean;
  policy: boolean;
  carrierEstimate: boolean;
  contractorEstimate: boolean;
  existingSupplements: boolean;
  claimPackage: boolean;
  carrierResponse: boolean;
  interviews: boolean;
  aiAnalysis: boolean;
}

export interface TaskRequirement {
  key: keyof EvidenceContext;
  label: string;
  /** false = optional module; a missing optional module is a warning, never a blocker */
  required: boolean;
}

/**
 * Which core sections are *required* depends on the entry point.
 * A supplement-only or imported project must never be blocked by missing
 * customer/property intake — those become optional, informational sections.
 */
const ENTRY_POINT_CORE: Record<EntryPoint, SectionId[]> = {
  new_claim: ['customer', 'property', 'insurance'],
  existing_claim: ['insurance'],
  supplement_only: [],
  imported: [],
};

/**
 * Independent requirement sets per task. A missing Claim Package is NEVER a
 * requirement for supplement generation. A carrier response is NEVER required
 * for claim package generation. Policy analysis never needs a supplement.
 */
export const TASK_REQUIREMENTS: Record<AITask, TaskRequirement[]> = {
  generate_claim_package: [
    { key: 'claim', label: 'Claim information', required: true },
    { key: 'customer', label: 'Customer information', required: true },
    { key: 'property', label: 'Property information', required: true },
    { key: 'documents', label: 'Supporting documents', required: true },
    { key: 'photos', label: 'Photos', required: false },
    { key: 'inspection', label: 'Inspection', required: false },
    // NOTE: carrier response explicitly NOT required here.
  ],
  generate_supplement: [
    { key: 'claim', label: 'Claim information', required: true },
    { key: 'carrierEstimate', label: 'Carrier estimate', required: false },
    { key: 'contractorEstimate', label: 'Contractor estimate', required: false },
    { key: 'photos', label: 'Photos', required: false },
    { key: 'documents', label: 'Supporting documents', required: false },
    // NOTE: Claim Package is deliberately ABSENT — supplement generation must
    // never be blocked by a missing claim package.
  ],
  analyze_policy: [
    { key: 'policy', label: 'Policy document', required: true },
  ],
  review_carrier_estimate: [
    { key: 'carrierEstimate', label: 'Carrier estimate', required: true },
    { key: 'claim', label: 'Claim information', required: false },
  ],
  generate_narrative: [
    { key: 'claim', label: 'Claim information', required: true },
    { key: 'documents', label: 'Supporting documents', required: false },
    { key: 'photos', label: 'Photos', required: false },
    { key: 'interviews', label: 'Interview responses', required: false },
  ],
  generate_recommendations: [
    { key: 'claim', label: 'Claim information', required: true },
    { key: 'documents', label: 'Supporting documents', required: false },
    { key: 'photos', label: 'Photos', required: false },
    { key: 'aiAnalysis', label: 'AI analysis', required: false },
  ],
};

export interface TaskReadiness {
  task: AITask;
  label: string;
  ready: boolean;
  missingRequired: { key: string; label: string }[];
  missingOptional: { key: string; label: string }[];
  satisfied: { key: string; label: string }[];
}

export function evaluateTaskReadiness(task: AITask, ctx: EvidenceContext): TaskReadiness {
  const requirements = TASK_REQUIREMENTS[task];
  const missingRequired = requirements
    .filter((r) => r.required && !ctx[r.key])
    .map((r) => ({ key: r.key, label: r.label }));
  const missingOptional = requirements
    .filter((r) => !r.required && !ctx[r.key])
    .map((r) => ({ key: r.key, label: r.label }));
  const satisfied = requirements
    .filter((r) => ctx[r.key])
    .map((r) => ({ key: r.key, label: r.label }));

  return {
    task,
    label: AI_TASK_LABELS[task],
    ready: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    satisfied,
  };
}

// ============================================================================
// Workspace sections — the dynamic Claim Workspace.
// ============================================================================

export type SectionId =
  | 'customer'
  | 'property'
  | 'insurance'
  | 'timeline'
  | 'communications'
  | 'documents'
  | 'photos'
  | 'estimates'
  | 'evidence'
  | 'ai_insights'
  | 'claim_package'
  | 'supplements'
  | 'carrier_responses'
  | 'compliance';

export const SECTION_LABELS: Record<SectionId, string> = {
  customer: 'Customer',
  property: 'Property',
  insurance: 'Insurance',
  timeline: 'Timeline',
  communications: 'Communications',
  documents: 'Documents',
  photos: 'Photos',
  estimates: 'Estimates',
  evidence: 'Evidence',
  ai_insights: 'AI Insights',
  claim_package: 'Claim Package',
  supplements: 'Supplements',
  carrier_responses: 'Carrier Responses',
  compliance: 'Compliance',
};

export type SectionState = 'ready' | 'inactive' | 'optional' | 'pending';

export interface WorkspaceSection {
  id: SectionId;
  label: string;
  state: SectionState;
  hasData: boolean;
  /** Shown when a module is optional and not yet produced (never an error). */
  message?: string;
  /** Suggested action for optional sections. */
  action?: string;
}

export interface WorkspaceState {
  entryPoint: EntryPoint;
  sections: WorkspaceSection[];
  aiTasks: TaskReadiness[];
  readyTaskCount: number;
}

const OPTIONAL_MESSAGES: Record<SectionId, { message: string; action: string }> = {
  claim_package: { message: 'Claim Package not yet generated.', action: 'Generate Claim Package (Optional)' },
  supplements: { message: 'No supplements yet.', action: 'Generate Supplement (Optional)' },
  carrier_responses: { message: 'No carrier responses yet.', action: 'Check Carrier' },
  compliance: { message: 'Compliance check not yet run.', action: 'Run Compliance Check (Optional)' },
  communications: { message: 'No communications recorded.', action: 'Add Communication' },
  ai_insights: { message: 'AI analysis not yet run.', action: 'Run AI Analysis (Optional)' },
  evidence: { message: 'No evidence links yet.', action: 'Build Evidence Graph' },
  timeline: { message: 'No timeline events yet.', action: 'View Activity' },
  customer: { message: 'Customer intake not completed.', action: 'Add Customer' },
  property: { message: 'Property information not set.', action: 'Add Property' },
  insurance: { message: 'Insurance details not set.', action: 'Add Insurance' },
  documents: { message: 'No documents uploaded.', action: 'Upload Documents' },
  photos: { message: 'No photos uploaded.', action: 'Upload Photos' },
  estimates: { message: 'No estimates uploaded.', action: 'Upload Estimate' },
};

/**
 * Build the dynamic workspace state for a claim from its evidence context.
 * Optional modules render as informational (never errors); required modules
 * that are missing render as "pending".
 */
export function getWorkspaceState(
  entryPoint: EntryPoint,
  ctx: EvidenceContext,
  opts: { coreRequired?: SectionId[] } = {}
): WorkspaceState {
  const coreRequired = opts.coreRequired || ENTRY_POINT_CORE[entryPoint];
  const hasEvidence = (key: keyof EvidenceContext) => ctx[key];

  const sectionDefs: { id: SectionId; key?: keyof EvidenceContext; optional?: boolean }[] = [
    { id: 'customer', key: 'customer' },
    { id: 'property', key: 'property' },
    { id: 'insurance', key: 'insurance' },
    { id: 'timeline' },
    { id: 'communications', optional: true },
    { id: 'documents', key: 'documents' },
    { id: 'photos', key: 'photos' },
    { id: 'estimates', key: 'carrierEstimate' },
    { id: 'evidence', key: 'evidence' },
    { id: 'ai_insights', key: 'aiAnalysis', optional: true },
    { id: 'claim_package', key: 'claimPackage', optional: true },
    { id: 'supplements', key: 'existingSupplements', optional: true },
    { id: 'carrier_responses', key: 'carrierResponse', optional: true },
    { id: 'compliance', key: 'aiAnalysis', optional: true },
  ];

  const sections: WorkspaceSection[] = sectionDefs.map((def) => {
    const hasData = def.key ? hasEvidence(def.key) : false;
    const optional = def.optional === true;
    let state: SectionState;
    if (hasData) {
      state = 'ready';
    } else if (optional) {
      state = 'optional';
    } else if (coreRequired.includes(def.id)) {
      state = 'pending';
    } else {
      state = 'inactive';
    }
    const msg = OPTIONAL_MESSAGES[def.id];
    return {
      id: def.id,
      label: SECTION_LABELS[def.id],
      state,
      hasData,
      ...(state === 'optional' ? { message: msg?.message, action: msg?.action } : {}),
    };
  });

  const aiTasks = AI_TASKS.map((task) => evaluateTaskReadiness(task, ctx));
  const readyTaskCount = aiTasks.filter((t) => t.ready).length;

  return { entryPoint, sections, aiTasks, readyTaskCount };
}

/** Build an empty EvidenceContext (all false) for easy spreading. */
export function emptyEvidenceContext(): EvidenceContext {
  return {
    claim: false,
    customer: false,
    property: false,
    insurance: false,
    evidence: false,
    inspection: false,
    photos: false,
    documents: false,
    policy: false,
    carrierEstimate: false,
    contractorEstimate: false,
    existingSupplements: false,
    claimPackage: false,
    carrierResponse: false,
    interviews: false,
    aiAnalysis: false,
  };
}
