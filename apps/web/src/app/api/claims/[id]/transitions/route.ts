import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { claims } from '@project-atlas/database';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { STATUS_LABELS } from '@/lib/claims-workflow';

// Allowed transitions per status (forward workflow only)
const TRANSITIONS: Record<string, string[]> = {
  new: ['inspection_scheduled', 'estimate_submitted', 'supplement_required', 'closed'],
  inspection_scheduled: ['inspection_complete', 'estimate_submitted', 'supplement_required'],
  inspection_complete: ['estimate_submitted', 'supplement_required', 'work_in_progress'],
  estimate_submitted: ['supplement_required', 'supplement_submitted', 'waiting_for_carrier', 'approved', 'denied', 'work_in_progress'],
  supplement_required: ['supplement_submitted', 'work_in_progress'],
  supplement_submitted: ['waiting_for_carrier', 'approved', 'denied', 'needs_revision'],
  waiting_for_carrier: ['approved', 'denied', 'partially_approved', 'needs_revision'],
  approved: ['work_in_progress', 'completed'],
  denied: ['supplement_required', 'closed'],
  work_in_progress: ['completed', 'closed'],
  completed: ['closed'],
  closed: [],
};

// GET /api/claims/[id]/transitions - Get available status transitions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const [claim] = await db
      .select()
      .from(claims)
      .where(and(eq(claims.id, id), eq(claims.companyId, context.companyId)));

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const nextStatuses = (TRANSITIONS[claim.status] || []).map((status) => ({
      value: status,
      label: (STATUS_LABELS as Record<string, string>)[status] || status,
    }));

    return NextResponse.json({
      currentStatus: claim.status,
      nextStatuses,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Claim transitions GET error:', error);
    return NextResponse.json({ error: 'Failed to get claim transitions' }, { status: 500 });
  }
}
