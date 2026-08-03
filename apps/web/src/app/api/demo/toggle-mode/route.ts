import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { setDemoMode } from '@/lib/demo-seed';

// POST /api/demo/toggle-mode — persist demo mode on/off for the current company.
// Body: { enabled: boolean }
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const enabled = body.enabled !== false;
    const status = await setDemoMode(context, enabled);
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo toggle-mode POST error:', error);
    return NextResponse.json({ error: 'Failed to toggle demo mode' }, { status: 500 });
  }
}
