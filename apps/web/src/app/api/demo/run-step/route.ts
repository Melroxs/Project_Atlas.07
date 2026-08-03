import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { runDemoStep } from '@/lib/demo-runner';

// POST /api/demo/run-step — execute one lifecycle step of the Full Atlas Demo.
// Body: { stepId: 'lead' | 'inspection' | ... }
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const result = await runDemoStep(context, body.stepId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo run-step POST error:', error);
    return NextResponse.json({ error: 'Failed to run demo step' }, { status: 500 });
  }
}
