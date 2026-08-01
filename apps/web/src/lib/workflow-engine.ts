// apps/web/src/lib/workflow-engine.ts
/**
 * Atlas Multi-Entry Workflow Engine — web mirror.
 *
 * Pure types/labels/helpers used by the UI (New Project dialog, dynamic Claim
 * Workspace). The authoritative evaluation logic lives in the API
 * (apps/api/src/lib/workflow-engine.ts); the API returns evaluated workspace
 * state which this module types + labels for rendering.
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

export const ENTRY_POINT_ORDER: EntryPoint[] = [
  'new_claim',
  'existing_claim',
  'supplement_only',
  'imported',
];

export type AITask =
  | 'generate_claim_package'
  | 'generate_supplement'
  | 'analyze_policy'
  | 'review_carrier_estimate'
  | 'generate_narrative'
  | 'generate_recommendations';

export const AI_TASK_LABELS: Record<AITask, string> = {
  generate_claim_package: 'Generate Claim Package',
  generate_supplement: 'Generate Supplement',
  analyze_policy: 'Analyze Policy',
  review_carrier_estimate: 'Review Carrier Estimate',
  generate_narrative: 'Generate Narrative',
  generate_recommendations: 'Generate Recommendations',
};

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
  message?: string;
  action?: string;
}

export interface TaskReadiness {
  task: AITask;
  label: string;
  ready: boolean;
  missingRequired: { key: string; label: string }[];
  missingOptional: { key: string; label: string }[];
  satisfied: { key: string; label: string }[];
}

export interface WorkspaceState {
  entryPoint: EntryPoint;
  sections: WorkspaceSection[];
  aiTasks: TaskReadiness[];
  readyTaskCount: number;
}

export const SECTION_STATE_LABELS: Record<SectionState, string> = {
  ready: 'Ready',
  inactive: 'Inactive',
  optional: 'Not yet generated',
  pending: 'Pending',
};

export const SECTION_STATE_COLORS: Record<SectionState, string> = {
  ready: 'bg-success/10 text-success',
  inactive: 'bg-muted text-muted-foreground',
  optional: 'bg-warning/10 text-warning',
  pending: 'bg-info/10 text-info',
};
