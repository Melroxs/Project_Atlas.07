import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { interviews } from '@project-atlas/database';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';

// GET /api/claims/[id]/interviews - Get interviews for a claim
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const claimInterviews = await db
      .select()
      .from(interviews)
      .where(and(eq(interviews.claimId, id), eq(interviews.companyId, context.companyId)))
      .orderBy(desc(interviews.createdAt));

    return NextResponse.json({
      interviews: claimInterviews,
      count: claimInterviews.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Claim interviews GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch claim interviews' }, { status: 500 });
  }
}
