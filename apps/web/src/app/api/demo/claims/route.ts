import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getDemoClaims } from '@/lib/demo-data';

// GET /api/demo/claims - Demo claims from live seeded data
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    const claims = await getDemoClaims(context);
    return NextResponse.json({ claims });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo claims GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch demo claims' }, { status: 500 });
  }
}
