import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getWalkthroughs } from '@/lib/demo-data';

// GET /api/demo/walkthroughs - Guided demo walkthroughs from live seeded data
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    const walkthroughs = await getWalkthroughs(context);
    return NextResponse.json({ walkthroughs });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo walkthroughs GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch demo walkthroughs' }, { status: 500 });
  }
}
