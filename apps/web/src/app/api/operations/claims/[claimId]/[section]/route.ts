import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { computeOperationsWeb } from '@/lib/operations-server';

const SECTIONS = ['full', 'lifecycle', 'financial', 'case-manager', 'opportunities', 'recommendations', 'twin'] as const;

// GET /api/operations/claims/[claimId]/[section]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string; section: string }> }
) {
  try {
    const context = await requireAuth();
    const { claimId, section } = await params;

    if (!(SECTIONS as readonly string[]).includes(section)) {
      return NextResponse.json({ error: 'Unknown operations section' }, { status: 400 });
    }

    const model = await computeOperationsWeb(context.companyId, claimId);
    if (!model) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    switch (section) {
      case 'full':
        return NextResponse.json(model);
      case 'lifecycle':
        return NextResponse.json(model.lifecycle);
      case 'financial':
        return NextResponse.json(model.financial);
      case 'case-manager':
        return NextResponse.json(model.caseManager);
      case 'opportunities':
        return NextResponse.json({ opportunities: model.opportunities });
      case 'recommendations':
        return NextResponse.json({ recommendations: model.recommendations });
      case 'twin':
        return NextResponse.json({ twin: model.digitalTwin });
      default:
        return NextResponse.json({ error: 'Unknown operations section' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Operations GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch operations model' }, { status: 500 });
  }
}
