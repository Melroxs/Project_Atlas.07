import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { clearDemoData } from '@/lib/demo-seed';

// DELETE /api/demo/clear - Clear demo data
export async function DELETE(request: NextRequest) {
  try {
    const context = await requireAuth();
    const result = await clearDemoData(context);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo clear DELETE error:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear demo data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
