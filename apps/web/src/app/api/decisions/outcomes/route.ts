// apps/web/src/app/api/decisions/outcomes/route.ts
// Continuous-learning feedback loop (Phase 5).
//
// POST — record a claim-completion outcome (final supplement,
//        reviewer edits, adjuster outcome, amounts, confidence
//        accuracy, evidence gaps, time to approval).
// GET  — learning metrics (confidence calibration, recommendation
//        accuracy, evidence quality trends, human override rate).
//
// Analytics and learning only. No automatic model retraining.

import { NextRequest, NextResponse } from 'next/server';
import { DecisionRepository } from '@project-atlas/decision';
import { DecisionLearningService } from '@/lib/decision-learning';
import { requireAuth } from '@/lib/server-auth';
import { setCompanyContext } from '@/lib/server-db';
import { z } from 'zod';

const outcomeSchema = z.object({
  claimId: z.string().uuid(),
  decisionId: z.string().optional(),
  finalApprovedSupplement: z.any().optional(),
  reviewerEdits: z.any().optional(),
  adjusterOutcome: z.enum(['APPROVED', 'PARTIAL', 'DENIED', 'PENDING']).optional(),
  amountApproved: z.number().optional(),
  amountDenied: z.number().optional(),
  confidenceAccuracy: z.number().min(0).max(1).optional(),
  evidenceGaps: z.any().optional(),
  timeToApprovalMinutes: z.number().optional(),
});

export async function GET() {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const learningService = new DecisionLearningService(new DecisionRepository());
    const metrics = await learningService.getMetrics(context.companyId);
    return NextResponse.json(metrics);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Learning metrics error:', error);
    return NextResponse.json({ error: 'Failed to compute learning metrics' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const outcome = outcomeSchema.parse(body);

    const learningService = new DecisionLearningService(new DecisionRepository());
    const recorded = await learningService.recordOutcome({
      organizationId: context.companyId,
      ...outcome,
    });

    return NextResponse.json({ success: true, outcome: recorded }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Record outcome error:', error);
    return NextResponse.json({ error: 'Failed to record outcome' }, { status: 500 });
  }
}
