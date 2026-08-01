// packages/claim-intelligence/src/operations.ts
import { ClaimBundle, OperationsModel } from './types';
import { analyzeClaim } from './engine';
import { getLifecycle } from './lifecycle';
import { computeFinancialIntelligence } from './financial';
import { detectRevenueOpportunities } from './revenue-opportunities';
import { generateOperationalRecommendations } from './ops-recommendations';
import { runCaseManager } from './case-manager';
import { buildDigitalTwin } from './digital-twin';

/**
 * Operations Intelligence orchestrator.
 *
 * Runs the full Phase 3 pipeline for one claim — lifecycle, financial,
 * revenue opportunities, operational recommendations, case manager, and the
 * digital twin — from a single ClaimBundle. Pure and synchronous, mirroring
 * `analyzeClaim` from Phase 2.
 */
export function analyzeOperations(bundle: ClaimBundle): OperationsModel {
  const model = analyzeClaim(bundle);
  const lifecycle = getLifecycle(bundle);
  const financial = computeFinancialIntelligence(bundle);
  const opportunities = detectRevenueOpportunities(bundle);
  const recommendations = generateOperationalRecommendations(bundle, model);
  const caseManager = runCaseManager(bundle, model, lifecycle);
  const digitalTwin = buildDigitalTwin(bundle, model, lifecycle, financial);
  digitalTwin.recommendations.operational = recommendations.length;

  return {
    claimId: bundle.claimId,
    claimNumber: bundle.claimNumber,
    generatedAt: new Date().toISOString(),
    lifecycle,
    financial,
    opportunities,
    recommendations,
    caseManager,
    digitalTwin,
  };
}

// Re-export sub-analysis functions for convenience (single entry per module).
export { getLifecycle, computeFinancialIntelligence, detectRevenueOpportunities, generateOperationalRecommendations, runCaseManager, buildDigitalTwin };
