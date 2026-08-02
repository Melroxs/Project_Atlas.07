import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getDemoStatus } from '@/lib/demo-seed';

// GET /api/demo/status - Check demo mode status (DB-backed)
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    const status = await getDemoStatus(context);
    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo status GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch demo status' }, { status: 500 });
  }
}
