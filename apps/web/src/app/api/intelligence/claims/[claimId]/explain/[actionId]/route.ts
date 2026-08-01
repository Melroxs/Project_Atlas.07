import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { analyzeClaimWeb } from '@/lib/claim-intelligence-server';

// GET /api/intelligence/claims/[claimId]/explain/[actionId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string; actionId: string }> }
) {
  try {
    const context = await requireAuth();
    const { claimId, actionId } = await params;

    const model = await analyzeClaimWeb(context.companyId, claimId);
    if (!model) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const action = model.nextBestActions.find((a) => a.id === actionId);
    if (!action) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    }

    return NextResponse.json(action.explanation);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Claim intelligence explain error:', error);
    return NextResponse.json({ error: 'Failed to explain recommendation' }, { status: 500 });
  }
}
