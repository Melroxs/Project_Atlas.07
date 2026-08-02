import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { db, setCompanyContext } from '@/lib/server-db';
import { claims } from '@project-atlas/database';
import { eq, and } from 'drizzle-orm';
import { buildEvidenceContext, evaluateTaskReadiness, AI_TASKS, type AITask } from '@/lib/workflow-engine-server';

// POST /api/multi-entry/ai-tasks/[task]/check - Evidence-based AI task readiness
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ task: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { task } = await params;

    if (!(AI_TASKS as string[]).includes(task)) {
      return NextResponse.json({ error: 'Unknown AI task' }, { status: 400 });
    }

    const body = await request.json();
    const claimId = body?.claimId as string | undefined;
    if (!claimId) {
      return NextResponse.json({ error: 'claimId is required' }, { status: 400 });
    }

    const [existingClaim] = await db
      .select()
      .from(claims)
      .where(and(eq(claims.id, claimId), eq(claims.companyId, context.companyId)))
      .limit(1);
    if (!existingClaim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const ctx = await buildEvidenceContext(claimId, context.companyId);
    const readiness = evaluateTaskReadiness(task as AITask, ctx);

    return NextResponse.json({
      task: readiness.task,
      label: readiness.label,
      ready: readiness.ready,
      missingRequired: readiness.missingRequired,
      missingOptional: readiness.missingOptional,
      satisfied: readiness.satisfied,
      message: readiness.ready
        ? `${readiness.label} can run — required evidence present.`
        : `${readiness.label} needs: ${readiness.missingRequired.map((m) => m.label).join(', ') || 'required evidence'}.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('AI task check POST error:', error);
    return NextResponse.json(
      { error: 'Failed to check AI task readiness', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
