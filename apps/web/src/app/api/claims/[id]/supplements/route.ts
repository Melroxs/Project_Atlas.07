import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { supplements } from '@project-atlas/database';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';

// GET /api/claims/[id]/supplements - Get supplements for a claim with summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const claimSupplements = await db
      .select()
      .from(supplements)
      .where(and(eq(supplements.claimId, id), eq(supplements.companyId, context.companyId)))
      .orderBy(desc(supplements.createdAt));

    const summary = {
      count: claimSupplements.length,
      totalRequested: claimSupplements.reduce((sum: number, s: any) => sum + (Number(s.requestedAmount) || 0), 0),
      totalApproved: claimSupplements.reduce((sum: number, s: any) => sum + (Number(s.approvedAmount) || 0), 0),
      totalOutstanding: claimSupplements.reduce((sum: number, s: any) => sum + ((Number(s.requestedAmount) || 0) - (Number(s.approvedAmount) || 0)), 0),
      latestStatus: claimSupplements.length > 0 ? claimSupplements[0].status : null,
      latestCarrierResponse: claimSupplements.length > 0 ? claimSupplements[0].responseDate : null,
    };

    return NextResponse.json({ supplements: claimSupplements, summary });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Claim supplements GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch claim supplements' }, { status: 500 });
  }
}
