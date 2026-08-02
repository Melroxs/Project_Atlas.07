import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { seedDemoData } from '@/lib/demo-seed';

// POST /api/demo/generate - Generate demo data for the current company
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    const result = await seedDemoData(context);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo generate POST error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate demo data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
