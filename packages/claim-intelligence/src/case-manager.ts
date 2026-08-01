// packages/claim-intelligence/src/case-manager.ts
import {
  ClaimBundle,
  CaseManagerReport,
  CaseDeadline,
  ClaimIntelligenceModel,
  LifecycleInfo,
} from './types';
import { extractAll } from './communications';
import { detectRisks, detectMissingInformation } from './health-monitor';

/**
 * AI Case Manager.
 *
 * Monitors claim progress, tracks workflow stages, detects stalled claims,
 * manages deadlines, identifies missing documentation/evidence, prioritizes
 * work, and recommends next actions. Continuously updated as new information
 * arrives (driven by the event bus at the service layer).
 */

const STALL_DAYS = 14;
const DAY = 86400000;

function daysBetween(aIso: string, bIso: string): number {
  return Math.round((new Date(bIso).getTime() - new Date(aIso).getTime()) / DAY);
}

function deadline(label: string, dateIso: string, source: string): CaseDeadline {
  const daysUntil = Math.round((new Date(dateIso).getTime() - Date.now()) / DAY);
  const severity = daysUntil < 0 ? 'overdue' : daysUntil <= 7 ? 'due_soon' : 'upcoming';
  return { label, date: dateIso, daysUntil, severity, source };
}

export function runCaseManager(
  bundle: ClaimBundle,
  model: ClaimIntelligenceModel,
  lifecycle: LifecycleInfo
): CaseManagerReport {
  const now = new Date().toISOString();
  const daysSinceLastUpdate = daysBetween(bundle.updatedAt, now);
  const terminal = ['closed', 'final_payment', 'approved'].includes(lifecycle.currentStage);

  const risks = detectRisks(bundle);
  const missing = detectMissingInformation(bundle);
  const deadlines: CaseDeadline[] = [];

  // Deadlines from supplement response expectations (21-day industry norm).
  for (const s of bundle.supplements) {
    if (s.submissionDate && !s.responseDate) {
      const expected = new Date(new Date(s.submissionDate).getTime() + 21 * DAY).toISOString();
      deadlines.push(deadline(`Carrier response expected for ${s.supplementNumber}`, expected, 'supplement'));
    }
    if (s.responseDate && !['approved', 'partially_approved'].includes(s.status)) {
      const followUp = new Date(new Date(s.responseDate).getTime() + 14 * DAY).toISOString();
      deadlines.push(deadline(`Negotiation follow-up on ${s.supplementNumber}`, followUp, 'supplement'));
    }
  }

  // Deadlines extracted from communications (promises / requested docs).
  for (const e of extractAll(bundle)) {
    if (e.entityType === 'deadline') {
      const parsed = new Date(e.value.replace(/^by\s+/i, '').replace(/st|nd|rd|th/g, ''));
      if (!Number.isNaN(parsed.getTime())) {
        deadlines.push(deadline(`Deadline from communication: ${e.value}`, parsed.toISOString(), 'communication'));
      }
    }
  }

  // Stalled detection: no update in STALL_DAYS and not terminal.
  const isStalled = !terminal && daysSinceLastUpdate > STALL_DAYS;
  const stalledReason = isStalled
    ? `No activity on this claim for ${daysSinceLastUpdate} days (threshold ${STALL_DAYS}).`
    : null;

  // Priority score (0-100): health + stall + risk + missing penalties.
  let priorityScore = Math.round(
    100 - model.health.score * 0.5 + (isStalled ? 25 : 0) + Math.min(30, risks.length * 6)
  );
  priorityScore = Math.max(0, Math.min(100, priorityScore));

  const hasCritical = risks.some((r) => r.severity === 'critical');
  const hasOverdue = deadlines.some((d) => d.severity === 'overdue');
  const overallStatus = isStalled || hasCritical
    ? 'blocked'
    : hasOverdue || model.health.level !== 'healthy'
      ? 'attention'
      : 'on_track';

  const nextActions = lifecycle.recommendedActions.slice(0, 5);
  if (isStalled) nextActions.unshift('Re-engage this stalled claim: review timeline and contact all parties.');

  const aiSummary = buildSummary(bundle, lifecycle, isStalled, daysSinceLastUpdate, deadlines, risks);

  return {
    claimId: bundle.claimId,
    claimNumber: bundle.claimNumber,
    monitoredAt: now,
    overallStatus,
    priorityScore,
    stage: lifecycle.currentStage,
    stageProgressPct: lifecycle.progressPct,
    daysSinceLastUpdate,
    isStalled,
    stalledReason,
    deadlines: deadlines.sort((a, b) => a.daysUntil - b.daysUntil),
    issues: risks,
    missingDocumentation: missing,
    nextActions,
    aiSummary,
  };
}

function buildSummary(
  bundle: ClaimBundle,
  lifecycle: LifecycleInfo,
  isStalled: boolean,
  daysSinceLastUpdate: number,
  deadlines: CaseDeadline[],
  risks: ReturnType<typeof detectRisks>
): string {
  const parts: string[] = [];
  parts.push(`Claim ${bundle.claimNumber} is in the "${lifecycle.currentStage.replace(/_/g, ' ')}" stage (${lifecycle.progressPct}% of lifecycle).`);
  if (isStalled) {
    parts.push(`It is STALLED — no activity for ${daysSinceLastUpdate} days.`);
  } else if (daysSinceLastUpdate > 5) {
    parts.push(`Last activity was ${daysSinceLastUpdate} days ago.`);
  }
  const overdue = deadlines.filter((d) => d.severity === 'overdue');
  if (overdue.length > 0) parts.push(`${overdue.length} deadline(s) are overdue.`);
  if (risks.length > 0) parts.push(`${risks.length} open risk(s): ${risks.slice(0, 3).map((r) => r.title).join('; ')}.`);
  if (bundle.documents.length === 0) parts.push('No documents have been uploaded yet.');
  if (bundle.supplements.length === 0) parts.push('No supplements exist yet.');
  return parts.join(' ');
}
