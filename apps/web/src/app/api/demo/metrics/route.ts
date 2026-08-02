import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { calculateMetrics } from '@/lib/demo-seed';

// GET /api/demo/metrics - Demo dashboard metrics from live DB data
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    const metrics = await calculateMetrics(context);
    return NextResponse.json(metrics);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo metrics GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch demo metrics' }, { status: 500 });
  }
}
