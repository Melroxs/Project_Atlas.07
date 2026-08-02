import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getDemoActivities } from '@/lib/demo-data';

// GET /api/demo/activities?claimId=... - Demo activity timeline
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    const claimId = request.nextUrl.searchParams.get('claimId') || undefined;
    const activities = await getDemoActivities(context, claimId);
    return NextResponse.json({ activities });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo activities GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch demo activities' }, { status: 500 });
  }
}
