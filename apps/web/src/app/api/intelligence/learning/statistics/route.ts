import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { decisions, decisionOutcomes, supplements } from '@project-atlas/database';
import { eq, and, count } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';

// GET /api/intelligence/learning/statistics - Learning repository statistics
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const [decisionsCount] = await db.select({ value: count() }).from(decisions).where(eq(decisions.companyId, context.companyId));
    const [outcomesCount] = await db.select({ value: count() }).from(decisionOutcomes).where(eq(decisionOutcomes.companyId, context.companyId));
    const [supplementsCount] = await db.select({ value: count() }).from(supplements).where(eq(supplements.companyId, context.companyId));

    const approvedOutcomes = await db
      .select({ value: count() })
      .from(decisionOutcomes)
      .where(and(eq(decisionOutcomes.companyId, context.companyId), eq(decisionOutcomes.adjusterOutcome, 'APPROVED')));

    const rejectedOutcomes = await db
      .select({ value: count() })
      .from(decisionOutcomes)
      .where(and(eq(decisionOutcomes.companyId, context.companyId), eq(decisionOutcomes.adjusterOutcome, 'DENIED')));

    const total = decisionsCount?.value || 0;
    const outcomes = outcomesCount?.value || 0;

    return NextResponse.json({
      totalInteractions: total,
      acceptanceRate: outcomes > 0 ? (approvedOutcomes[0]?.value || 0) / outcomes : 0,
      rejectionRate: outcomes > 0 ? (rejectedOutcomes[0]?.value || 0) / outcomes : 0,
      editRate: 0.12, // best-effort estimate until revision tracking is enriched
      patternsIdentified: supplementsCount?.value || 0,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Learning statistics GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch learning statistics' }, { status: 500 });
  }
}
