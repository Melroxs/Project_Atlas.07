import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { db, setCompanyContext } from '@/lib/server-db';
import { claims } from '@project-atlas/database';
import { eq, and } from 'drizzle-orm';
import { buildEvidenceContext, getWorkspaceState } from '@/lib/workflow-engine-server';
import type { EntryPoint } from '@/lib/workflow-engine';

// GET /api/multi-entry/workspace/[claimId] - Dynamic Claim Workspace state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { claimId } = await params;

    const [claim] = await db
      .select()
      .from(claims)
      .where(and(eq(claims.id, claimId), eq(claims.companyId, context.companyId)))
      .limit(1);

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const ctx = await buildEvidenceContext(claimId, context.companyId);
    const entryPoint = ((claim as any).entryPoint || 'new_claim') as EntryPoint;
    const workspace = getWorkspaceState(entryPoint, ctx);

    return NextResponse.json({ ...workspace, evidenceContext: ctx });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Claim not found') {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }
    console.error('Workspace GET error:', error);
    return NextResponse.json(
      { error: 'Failed to build claim workspace', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
