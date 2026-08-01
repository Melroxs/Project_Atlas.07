// ==========================================================
// Atlas
// packages/domain/decision/decision.learning.ts
// Continuous Learning — feedback-loop analytics (Phase 5)
// ==========================================================
//
// Pure, deterministic analytics computed from recorded claim
// outcomes. Shared by the API and web learning services.
//
// ANALYTICS AND LEARNING ONLY — this module NEVER retrains
// models automatically. Human review remains mandatory.

// ==========================================================
// TYPES
// ==========================================================

export interface DecisionOutcomeInput {
  organizationId: string;
  claimId: string;
  decisionId?: string;
  finalApprovedSupplement?: unknown;
  reviewerEdits?: Record<string, unknown> | null;
  adjusterOutcome?: "APPROVED" | "PARTIAL" | "DENIED" | "PENDING";
  amountApproved?: number;
  amountDenied?: number;
  confidenceAccuracy?: number; // 0-1, predicted vs actual
  evidenceGaps?: unknown[] | null;
  timeToApprovalMinutes?: number;
}

export interface LearningMetrics {
  confidenceCalibration: {
    sampleCount: number;
    averagePredicted: number;
    averageActual: number;
    calibrationError: number; // |avg predicted - avg actual|
    overconfident: boolean;
  };
  recommendationAccuracy: {
    total: number;
    approved: number;
    denied: number;
    partial: number;
    accuracyRate: number; // approved / total
    approvalRate: number;
    denialRate: number;
  };
  evidenceQualityTrends: {
    total: number;
    withGaps: number;
    withoutGaps: number;
    gapRate: number;
    averageTimeToApprovalMinutes: number;
    mostCommonGaps: { type: string; count: number }[];
  };
  humanOverrideFrequency: {
    total: number;
    overridden: number;
    overrideRate: number; // decisions where reviewer edits were recorded
  };
}

/**
 * Normalized outcome row shape consumed by the metrics
 * computation (matches repository.listOutcomes output).
 */
export interface LearningOutcomeRow {
  adjusterOutcome?: string | null;
  confidenceAccuracy?: number | null;
  evidenceGaps?: unknown[] | null;
  timeToApprovalMinutes?: number | null;
  reviewerEdits?: Record<string, unknown> | null;
}

// ==========================================================
// METRICS COMPUTATION (pure)
// ==========================================================

export function computeLearningMetrics(
  outcomes: LearningOutcomeRow[]
): LearningMetrics {
  const withOutcome = outcomes.filter(
    (o) => o.adjusterOutcome && o.adjusterOutcome !== "PENDING"
  );
  const approved = withOutcome.filter((o) => o.adjusterOutcome === "APPROVED");
  const denied = withOutcome.filter((o) => o.adjusterOutcome === "DENIED");
  const partial = withOutcome.filter((o) => o.adjusterOutcome === "PARTIAL");

  const accuracyValues = outcomes
    .filter((o) => o.confidenceAccuracy != null)
    .map((o) => o.confidenceAccuracy as number);
  const avgAccuracy = accuracyValues.length
    ? accuracyValues.reduce((a, b) => a + b, 0) / accuracyValues.length
    : 0;

  const withGaps = outcomes.filter(
    (o) =>
      o.evidenceGaps &&
      Array.isArray(o.evidenceGaps) &&
      o.evidenceGaps.length > 0
  );

  // Most common gap types
  const gapCounts: Record<string, number> = {};
  for (const o of withGaps) {
    for (const gap of o.evidenceGaps as unknown[]) {
      const type =
        typeof gap === "string"
          ? gap
          : ((gap as { type?: string })?.type ?? "UNKNOWN");
      gapCounts[type] = (gapCounts[type] || 0) + 1;
    }
  }
  const mostCommonGaps = Object.entries(gapCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const times = outcomes
    .filter((o) => o.timeToApprovalMinutes != null)
    .map((o) => o.timeToApprovalMinutes as number);

  const overridden = outcomes.filter(
    (o) =>
      o.reviewerEdits &&
      typeof o.reviewerEdits === "object" &&
      Object.keys(o.reviewerEdits).length > 0
  );

  const actualRate = withOutcome.length
    ? approved.length / withOutcome.length
    : 0;

  return {
    confidenceCalibration: {
      sampleCount: accuracyValues.length,
      averagePredicted: accuracyValues.length ? round2(avgAccuracy) : 0,
      averageActual: withOutcome.length ? round2(actualRate) : 0,
      calibrationError:
        accuracyValues.length && withOutcome.length
          ? round2(Math.abs(avgAccuracy - actualRate))
          : 0,
      overconfident: accuracyValues.length > 0 && avgAccuracy > actualRate,
    },
    recommendationAccuracy: {
      total: withOutcome.length,
      approved: approved.length,
      denied: denied.length,
      partial: partial.length,
      accuracyRate: withOutcome.length ? round2(approved.length / withOutcome.length) : 0,
      approvalRate: withOutcome.length ? round2(approved.length / withOutcome.length) : 0,
      denialRate: withOutcome.length ? round2(denied.length / withOutcome.length) : 0,
    },
    evidenceQualityTrends: {
      total: outcomes.length,
      withGaps: withGaps.length,
      withoutGaps: outcomes.length - withGaps.length,
      gapRate: outcomes.length ? round2(withGaps.length / outcomes.length) : 0,
      averageTimeToApprovalMinutes: times.length
        ? round1(times.reduce((a, b) => a + b, 0) / times.length)
        : 0,
      mostCommonGaps,
    },
    humanOverrideFrequency: {
      total: outcomes.length,
      overridden: overridden.length,
      overrideRate: outcomes.length ? round2(overridden.length / outcomes.length) : 0,
    },
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
