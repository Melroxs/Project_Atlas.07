import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getDemoSupplements } from '@/lib/demo-data';

// GET /api/demo/supplements - Demo supplements from live seeded data
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    const supplements = await getDemoSupplements(context);
    return NextResponse.json({ supplements });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo supplements GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch demo supplements' }, { status: 500 });
  }
}
