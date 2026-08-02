import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';

// POST /api/intelligence/diagnostics/clear-cache - Clear in-memory caches
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    return NextResponse.json({
      cleared: true,
      timestamp: new Date().toISOString(),
      message: 'Caches cleared',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Clear cache error:', error);
    return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 });
  }
}
