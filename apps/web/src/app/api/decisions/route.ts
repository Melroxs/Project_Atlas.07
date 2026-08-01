// apps/web/src/app/api/decisions/route.ts
// Decision Engine API (Phase 1-2) — list + evaluate.

import { NextRequest, NextResponse } from 'next/server';
import {
  DecisionService,
  DecisionRepository,
  DecisionContextSource,
} from '@project-atlas/decision';
import { DecisionContextCollector } from './decision-context';
import { requireAuth } from '@/lib/server-auth';
import { setCompanyContext } from '@/lib/server-db';
import { z } from 'zod';

const evaluateSchema = z.object({
  claimId: z.string().uuid(),
});

// DecisionService: repository doubles as the DecisionStore, so every
// execution is persisted with version history (never overwrite).
function buildService(context: { companyId: string }) {
  const collector = new DecisionContextCollector();
  const repository = new DecisionRepository();
  const service = new DecisionService(repository, collector as DecisionContextSource);
  return { service, repository };
}

// GET /api/decisions — list persisted decisions
export async function GET() {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const { repository } = buildService(context);
    const decisions = await repository.listDecisions(context.companyId);
    return NextResponse.json({ decisions });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Decisions GET error:', error);
    return NextResponse.json({ error: 'Failed to list decisions' }, { status: 500 });
  }
}

// POST /api/decisions — evaluate a claim through the Decision Engine
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const { claimId } = evaluateSchema.parse(body);

    const { service, repository } = buildService(context);
    const result = await service.analyzeClaim(claimId, context.companyId);

    // Return the persisted decision record (with its id) so the UI can
    // navigate straight to the new decision — never rely on stale state.
    const decision = await repository.getLatestDecision(claimId, context.companyId);
    return NextResponse.json({ ...result, decision });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Decisions POST error:', error);
    return NextResponse.json(
      {
        error: 'Failed to evaluate claim',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
