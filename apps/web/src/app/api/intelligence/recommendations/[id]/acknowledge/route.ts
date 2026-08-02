import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';

// POST /api/intelligence/recommendations/[id]/acknowledge
// Recommendations are computed live (not persisted), so acknowledging simply
// confirms the action — the UI marks it acknowledged locally.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    return NextResponse.json({
      id,
      acknowledged: true,
      message: 'Recommendation acknowledged',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Recommendation acknowledge error:', error);
    return NextResponse.json({ error: 'Failed to acknowledge recommendation' }, { status: 500 });
  }
}
