// packages/claim-intelligence/src/portfolio.ts
import {
  ClaimBundle,
  CompanyOperationsOverview,
  ExecutiveDashboard,
  LifecycleStage,
  PipelineBucket,
  PortfolioClaimSummary,
  PortfolioIntelligence,
  RevenueRecoveryDashboard,
  UpcomingDeadline,
} from './types';
import { analyzeClaim } from './engine';
import { computeFinancialIntelligence } from './financial';
import { getLifecycle } from './lifecycle';
import { runCaseManager } from './case-manager';
import { extractAll } from './communications';

/**
 * Portfolio Intelligence — analyzes ALL active claims collectively.
 *
 * Powers the Revenue Recovery Dashboard, the Executive Operations Dashboard,
 * and Portfolio Intelligence from a single pass over company bundles.
 */

export interface PortfolioInput {
  bundles: ClaimBundle[];
}

export function analyzePortfolio(input: PortfolioInput): CompanyOperationsOverview {
  const { bundles } = input;
  const now = Date.now();

  const summaries: PortfolioClaimSummary[] = [];
  const deadlines: UpcomingDeadline[] = [];
  const aiRecs: { claimId: string; claimNumber: string; title: string; priority: string }[] = [];
  const missingDocCounts = new Map<string, number>();
  const carrierValue = new Map<string, { value: number; claims: number }>();
  const stageCounts = new Map<LifecycleStage, { count: number; createdAts: string[] }>();
  const stageDelay = new Map<LifecycleStage, number>();
  const requestedDocs = new Map<string, number>();
  const evidenceGaps = new Map<string, number>();
  const supsAll: { status: string; requested: number; approved: number }[] = [];

  let totalHealth = 0;
  let totalReadiness = 0;
  let totalAIConf = 0;
  let recoveredRevenue = 0;
  let outstandingOpportunity = 0;
  let estRecoverable = 0;
  let totalDurationDays = 0;

  for (const bundle of bundles) {
    const model = analyzeClaim(bundle);
    const financial = computeFinancialIntelligence(bundle);
    const lifecycle = getLifecycle(bundle);
    const caseManager = runCaseManager(bundle, model, lifecycle);

    const terminal = ['closed', 'final_payment'].includes(lifecycle.currentStage);
    const awaitingResponse = bundle.supplements.some((s) => !s.responseDate && s.status !== 'denied' && s.status !== 'approved');
    const readyForSupplement =
      !terminal &&
      bundle.documents.some((d) => d.isEstimate) &&
      bundle.documents.some((d) => d.isPhoto) &&
      bundle.supplements.filter((s) => !['approved', 'denied', 'closed'].includes(s.status)).length === 0;
    const missingEvidence =
      bundle.documents.length === 0 || !bundle.documents.some((d) => d.isPhoto) || !bundle.documents.some((d) => d.isEstimate);
    const atRisk = caseManager.overallStatus === 'blocked' || model.health.level === 'critical' || caseManager.isStalled;

    totalHealth += model.health.score;
    totalReadiness += model.recoveryReadiness.score;
    totalAIConf += model.aiConfidence;
    recoveredRevenue += financial.recoveredRevenue;
    outstandingOpportunity += financial.outstandingRevenue;
    if (financial.estimatedRecoveryOpportunity != null) estRecoverable += financial.estimatedRecoveryOpportunity;
    totalDurationDays += (now - new Date(bundle.createdAt).getTime()) / 86400000;

    // Lifecycle stage counts + delay
    const stage = lifecycle.currentStage;
    const prev = stageCounts.get(stage) || { count: 0, createdAts: [] };
    prev.count += 1;
    prev.createdAts.push(bundle.createdAt);
    stageCounts.set(stage, prev);
    if (!terminal) {
      const current = stageDelay.get(stage) || 0;
      stageDelay.set(stage, current + Math.max(0, (now - new Date(bundle.updatedAt).getTime()) / 86400000));
    }

    // Missing documentation aggregation
    for (const m of model.missingInformation) {
      missingDocCounts.set(m.label, (missingDocCounts.get(m.label) || 0) + 1);
    }
    if (!bundle.insuranceCompany) evidenceGaps.set('Carrier not recorded', (evidenceGaps.get('Carrier not recorded') || 0) + 1);
    if (bundle.documents.length === 0) evidenceGaps.set('No documents', (evidenceGaps.get('No documents') || 0) + 1);

    // Carrier concentration + requested docs from communications
    if (bundle.insuranceCompany) {
      const c = carrierValue.get(bundle.insuranceCompany) || { value: 0, claims: 0 };
      c.value += Number(bundle.estimatedValue ?? 0);
      c.claims += 1;
      carrierValue.set(bundle.insuranceCompany, c);
    }
    for (const e of extractAll(bundle)) {
      if (e.entityType === 'requested_document') {
        requestedDocs.set(e.value, (requestedDocs.get(e.value) || 0) + 1);
      }
    }

    // Supplements for success rate
    for (const s of bundle.supplements) {
      supsAll.push({ status: s.status, requested: Number(s.requestedAmount ?? 0), approved: Number(s.approvedAmount ?? 0) });
    }

    // Deadlines + AI recommendations
    for (const d of caseManager.deadlines) {
      deadlines.push({ claimId: bundle.claimId, claimNumber: bundle.claimNumber, label: d.label, date: d.date, daysUntil: d.daysUntil, severity: d.severity });
    }
    for (const r of model.nextBestActions.slice(0, 2)) {
      aiRecs.push({ claimId: bundle.claimId, claimNumber: bundle.claimNumber, title: r.title, priority: r.priority });
    }

    summaries.push({
      claimId: bundle.claimId,
      claimNumber: bundle.claimNumber,
      status: bundle.status,
      insuranceCompany: bundle.insuranceCompany ?? null,
      customerName: bundle.customerName ?? null,
      entryPoint: bundle.entryPoint ?? 'new_claim',
      lifecycleStage: stage,
      healthScore: model.health.score,
      recoveryReadiness: model.recoveryReadiness.score,
      aiConfidence: model.aiConfidence,
      estimatedValue: bundle.estimatedValue != null ? Number(bundle.estimatedValue) : null,
      recoveredRevenue: financial.recoveredRevenue,
      outstandingOpportunity: financial.outstandingRevenue,
      isStalled: caseManager.isStalled,
      atRisk,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
    });
  }

  const total = bundles.length;
  const active = summaries.filter((s) => !['closed', 'final_payment'].includes(s.lifecycleStage));

  const revenue: RevenueRecoveryDashboard = {
    totalActiveClaims: active.length,
    claimsAwaitingResponse: summaries.filter((s) => {
      const b = bundles.find((x) => x.claimId === s.claimId);
      return b ? b.supplements.some((x) => !x.responseDate && x.status !== 'denied' && x.status !== 'approved') : false;
    }).length,
    claimsReadyForSupplement: summaries.filter((s) => {
      const b = bundles.find((x) => x.claimId === s.claimId);
      return b
        ? b.documents.some((d) => d.isEstimate) &&
            b.documents.some((d) => d.isPhoto) &&
            b.supplements.filter((x) => !['approved', 'denied', 'closed'].includes(x.status)).length === 0
        : false;
    }).length,
    claimsMissingEvidence: summaries.filter((s) => {
      const b = bundles.find((x) => x.claimId === s.claimId);
      return b ? b.documents.length === 0 || !b.documents.some((d) => d.isPhoto) || !b.documents.some((d) => d.isEstimate) : false;
    }).length,
    claimsAtRisk: summaries.filter((s) => s.atRisk).length,
    estimatedRecoverableRevenue: Math.round(estRecoverable * 100) / 100,
    revenueAlreadyRecovered: Math.round(recoveredRevenue * 100) / 100,
    outstandingOpportunity: Math.round(outstandingOpportunity * 100) / 100,
    averageClaimHealth: total ? Math.round(totalHealth / total) : 0,
    averageRecoveryReadiness: total ? Math.round(totalReadiness / total) : 0,
    averageAIConfidence: total ? Math.round(totalAIConf / total) : 0,
  };

  const claimPipeline: PipelineBucket[] = [...stageCounts.entries()]
    .map(([stage, info]) => ({ label: stage.replace(/_/g, ' '), count: info.count, value: info.count }))
    .sort((a, b) => b.count - a.count);

  const revenuePipeline = buildRevenuePipeline(summaries);

  const highRiskClaims = summaries.filter((s) => s.atRisk).sort((a, b) => b.healthScore - a.healthScore);

  const bottlenecks = [...stageCounts.entries()]
    .map(([stage, info]) => ({
      stage,
      count: info.count,
      avgDaysInStage: info.count ? Math.round((stageDelay.get(stage) || 0) / info.count) : 0,
      issue:
        info.count > 0
          ? stage === 'carrier_review'
            ? 'Waiting on carrier — typical bottleneck'
            : stage === 'supplement_preparation'
              ? 'Supplements being prepared — evidence gaps may stall'
              : stage === 'negotiation'
                ? 'Negotiation open — responses pending'
                : 'Claim active in this stage'
          : 'No claims',
    }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count);

  const revenueConcentration = [...carrierValue.entries()]
    .map(([carrier, info]) => ({
      carrier,
      estimatedValue: Math.round(info.value * 100) / 100,
      pct: total && info.value > 0 ? Math.round((info.value / (bundles.reduce((s, b) => s + Number(b.estimatedValue ?? 0), 0) || 1)) * 100) : 0,
    }))
    .sort((a, b) => b.estimatedValue - a.estimatedValue);

  const supsApproved = supsAll.filter((s) => s.status === 'approved' || s.status === 'partially_approved');
  const valueApprovedPct = supsAll.reduce((s, x) => s + x.requested, 0)
    ? Math.round((supsAll.reduce((s, x) => s + x.approved, 0) / supsAll.reduce((s, x) => s + x.requested, 0)) * 100)
    : 0;

  const portfolio: PortfolioIntelligence = {
    commonMissingDocumentation: [...missingDocCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    frequentlyDelayedStages: bottlenecks.map((b) => ({ stage: b.stage, count: b.count })),
    recurringCarrierRequests: [...requestedDocs.entries()]
      .map(([request, count]) => ({ request, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    repeatedEvidenceGaps: [...evidenceGaps.entries()]
      .map(([gap, count]) => ({ gap, count }))
      .sort((a, b) => b.count - a.count),
    claimsRequiringImmediateAttention: summaries
      .filter((s) => s.atRisk || s.isStalled)
      .sort((a, b) => b.healthScore - a.healthScore),
    revenueConcentrationByCarrier: revenueConcentration,
    averageClaimDurationDays: total ? Math.round(totalDurationDays / total) : 0,
    supplementSuccessRates: {
      total: supsAll.length,
      submitted: supsAll.length,
      approved: supsApproved.length,
      approvedPct: supsAll.length ? Math.round((supsApproved.length / supsAll.length) * 100) : 0,
      valueApprovedPct,
    },
    trends: buildTrends(bundles),
  };

  const executive: ExecutiveDashboard = {
    companyHealth: revenue.averageClaimHealth,
    claimPipeline,
    revenuePipeline,
    highRiskClaims,
    upcomingDeadlines: deadlines
      .filter((d) => d.severity !== 'upcoming')
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 15),
    teamWorkload: [...stageCounts.entries()].map(([stage, info]) => ({
      label: stage.replace(/_/g, ' '),
      count: info.count,
    })),
    aiRecommendations: aiRecs.slice(0, 12),
    revenueForecast: buildForecast(summaries),
    operationalBottlenecks: bottlenecks.slice(0, 6),
  };

  return { generatedAt: new Date().toISOString(), revenue, executive, portfolio };
}

function buildRevenuePipeline(summaries: PortfolioClaimSummary[]): PipelineBucket[] {
  const buckets: Record<string, PipelineBucket> = {};
  for (const s of summaries) {
    const bucket =
      s.lifecycleStage === 'closed' || s.lifecycleStage === 'final_payment'
        ? 'Recovered / Closed'
        : s.lifecycleStage === 'approved'
          ? 'Approved — invoicing'
          : s.recoveredRevenue > 0
            ? 'Partially recovered'
            : 'Open opportunity';
    buckets[bucket] = buckets[bucket] || { label: bucket, count: 0, value: 0 };
    buckets[bucket].count += 1;
    buckets[bucket].value += s.outstandingOpportunity;
  }
  return Object.values(buckets).sort((a, b) => b.count - a.count);
}

function buildForecast(summaries: PortfolioClaimSummary[]): { bucket: string; value: number; confidence: number }[] {
  const open = summaries.filter((s) => s.lifecycleStage !== 'closed' && s.lifecycleStage !== 'final_payment');
  const totalOutstanding = open.reduce((sum, s) => sum + s.outstandingOpportunity, 0);
  const highConf = open.filter((s) => s.recoveryReadiness >= 70).reduce((sum, s) => sum + s.outstandingOpportunity, 0);
  const mediumConf = open
    .filter((s) => s.recoveryReadiness >= 40 && s.recoveryReadiness < 70)
    .reduce((sum, s) => sum + s.outstandingOpportunity, 0);
  return [
    { bucket: 'High-confidence recovery (30d)', value: Math.round(highConf * 0.7 * 100) / 100, confidence: 0.7 },
    { bucket: 'Medium-confidence recovery (60d)', value: Math.round(mediumConf * 0.4 * 100) / 100, confidence: 0.4 },
    { bucket: 'Total outstanding opportunity', value: Math.round(totalOutstanding * 100) / 100, confidence: 0.3 },
  ];
}

function buildTrends(bundles: ClaimBundle[]): { label: string; value: number }[] {
  const byMonth = new Map<string, number>();
  for (const b of bundles) {
    const key = b.createdAt.slice(0, 7); // YYYY-MM
    byMonth.set(key, (byMonth.get(key) || 0) + 1);
  }
  return [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }));
}
