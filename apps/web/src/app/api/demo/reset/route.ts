import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { seedDemoData } from '@/lib/demo-seed';

// POST /api/demo/reset - Reset demo data (clear + regenerate)
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    const result = await seedDemoData(context);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo reset POST error:', error);
    return NextResponse.json(
      {
        error: 'Failed to reset demo data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
