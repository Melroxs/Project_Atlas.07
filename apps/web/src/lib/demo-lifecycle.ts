// apps/web/src/lib/demo-lifecycle.ts
// Client-side mirror of the server lifecycle in demo-runner.ts. The ids MUST
// match exactly — POST /api/demo/run-step dispatches on them. Kept in one
// place so the Full Demo player and the live guided walkthroughs share the
// same source of truth.

export interface LifecycleStep {
  id: string;
  label: string;
  icon: string;
  ai: string;
}

export const LIFECYCLE_STEPS: readonly LifecycleStep[] = [
  { id: 'lead', label: 'Lead created', icon: '📥', ai: 'Creating lead from inbound storm report…' },
  { id: 'inspection', label: 'Inspection scheduled', icon: '📅', ai: 'Scheduling roof inspection with photo checklist…' },
  { id: 'interview', label: 'FNOL interview', icon: '💬', ai: 'Running guided interview — extracting loss details…' },
  { id: 'claim', label: 'Claim created', icon: '📄', ai: 'Creating claim CL-2026-0614 from interview data…' },
  { id: 'photos', label: 'Photos uploaded', icon: '📷', ai: 'Uploading 22 inspection photos with GPS tags…' },
  { id: 'photo_ai', label: 'Photo intelligence', icon: '🤖', ai: 'Analyzing photos for hail impacts, granule loss and flashing damage…' },
  { id: 'weather', label: 'Weather verified', icon: '⛈️', ai: 'Checking NOAA history for the loss date…' },
  { id: 'measurements', label: 'Roof measured', icon: '📐', ai: 'Measuring roof planes from drone photogrammetry…' },
  { id: 'code', label: 'Code compliance', icon: '📜', ai: 'Checking 2023 Florida Building Code requirements…' },
  { id: 'evidence', label: 'Evidence graph built', icon: '🕸️', ai: 'Linking photos, weather and policy to the scope…' },
  { id: 'decision', label: 'Decision Engine', icon: '🧠', ai: 'Running Decision Engine — scoring evidence, coverage, risk…' },
  { id: 'compliance', label: 'Compliance validated', icon: '🛡️', ai: 'Validating compliance — 0 violations found…' },
  { id: 'supplement', label: 'Supplement generated', icon: '💰', ai: 'Pricing six Xactimate line items — $22,835.65…' },
  { id: 'carrier', label: 'Submitted to carrier', icon: '🏛️', ai: 'Assembling package and submitting for carrier review…' },
  { id: 'approval', label: 'Carrier approved', icon: '✅', ai: 'Carrier approved $18,421.15 — updating recovery…' },
  { id: 'invoice', label: 'Invoice issued', icon: '🧾', ai: 'Issuing invoice ATL-8821 for approved scope…' },
  { id: 'closed', label: 'Claim closed', icon: '🏁', ai: 'Finalizing claim — $18,421.15 recovered, +417%…' },
] as const;

export interface LifecycleMetrics {
  totalClaims?: number;
  totalRevenueRequested?: number;
  totalRevenueApproved?: number;
  approvalRate?: number;
  activities?: number;
  documents?: number;
}

export interface LifecycleClaimSnap {
  id: string;
  claimNumber: string;
  status: string;
}

export const fmtMoney = (v: number | undefined) =>
  `$${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
