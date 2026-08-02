// apps/web/src/app/api/decisions/[id]/route.ts
// Decision detail + human review workflow (Phase 1, 3).

import { NextRequest, NextResponse } from 'next/server';
import {
  DecisionService,
  DecisionRepository,
  DecisionContextSource,
} from '@project-atlas/decision';
import { DecisionContextCollector } from '../decision-context';
import { requireAuth } from '@/lib/server-auth';
import { setCompanyContext } from '@/lib/server-db';
import { z } from 'zod';

const reviewSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED', 'REQUEST_CHANGES', 'REGENERATE']),
  comments: z.string().optional(),
});

function buildService(context: { companyId: string }) {
  const collector = new DecisionContextCollector();
  const repository = new DecisionRepository();
  const service = new DecisionService(repository, collector as DecisionContextSource);
  return { service, repository };
}

// GET /api/decisions/:id — decision + full evidence context
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const { repository } = buildService(context);
    const decisionContext = await repository.buildDecisionContext(
      id,
      context.companyId
    );

    if (!decisionContext) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    return NextResponse.json(decisionContext);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Decision GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch decision' }, { status: 500 });
  }
}

// POST /api/decisions/:id — human review (approve/reject/request changes/regenerate)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const body = await request.json();
    const { action, comments } = reviewSchema.parse(body);
    const { service, repository } = buildService(context);

    if (action === 'REGENERATE') {
      const existing = await repository.getDecision(id, context.companyId);
      if (!existing) {
        return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
      }
      // Re-run the pipeline — repository persists a NEW version (never overwrite).
      const result = await service.analyzeClaim(existing.claimId, context.companyId);
      return NextResponse.json(result);
    }

    const decision = await service.reviewDecision(
      id,
      action,
      context.userId,
      comments
    );

    return NextResponse.json({ success: true, decision });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Decision review error:', error);
    return NextResponse.json(
      {
        error: 'Failed to review decision',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE /api/decisions/:id — archive (soft-delete) a decision.
// Version history is never overwritten, so decisions are ARCHIVED
// rather than physically removed.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const { repository } = buildService(context);
    const existing = await repository.getDecision(id, context.companyId);
    if (!existing) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    const archived = await repository.updateDecisionStatus(id, 'ARCHIVED');
    return NextResponse.json({ success: true, decision: archived });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Decision delete error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete decision',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
