// apps/web/src/app/api/decisions/bulk-review/route.ts
// Bulk human review — approve / reject / request changes on many
// decisions at once from the Decision Review queue.
//
// POST /api/decisions/bulk-review { decisionIds: string[], action, comments? }

import { NextRequest, NextResponse } from 'next/server';
import { DecisionService, DecisionRepository, DecisionContextSource } from '@project-atlas/decision';
import { DecisionContextCollector } from '../decision-context';
import { requireAuth } from '@/lib/server-auth';
import { setCompanyContext } from '@/lib/server-db';
import { z } from 'zod';

const bulkSchema = z.object({
  decisionIds: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(['APPROVED', 'REJECTED', 'REQUEST_CHANGES']),
  comments: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const { decisionIds, action, comments } = bulkSchema.parse(body);

    const collector = new DecisionContextCollector();
    const repository = new DecisionRepository();
    const service = new DecisionService(repository, collector as DecisionContextSource);

    const results: { decisionId: string; success: boolean; error?: string }[] = [];
    for (const decisionId of decisionIds) {
      try {
        const decision = await service.reviewDecision(
          decisionId,
          action,
          context.userId,
          comments
        );
        results.push({ decisionId, success: Boolean(decision) });
      } catch (error) {
        results.push({
          decisionId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    return NextResponse.json({ success: true, results, succeeded, failed: results.length - succeeded });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Bulk review error:', error);
    return NextResponse.json(
      {
        error: 'Failed to run bulk review',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
