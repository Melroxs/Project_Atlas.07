import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { claims, supplements, adjusters } from '@project-atlas/database';
import { eq, and, desc, lt, count } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { sql } from 'drizzle-orm';

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  type: 'action' | 'warning' | 'opportunity';
  title: string;
  reason: string;
  expectedImpact: { financial?: number; time?: string; quality?: string };
  suggestedAction: string;
  relatedEntityId?: string;
  relatedEntityType?: 'claim' | 'supplement' | 'interview' | 'document';
  createdAt: string;
  acknowledged: boolean;
}

// GET /api/intelligence/recommendations - Compute recommendations from live data
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const recommendations: Recommendation[] = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Claims waiting on supplements (supplement_required / supplement_submitted)
    const waitingClaims = await db
      .select()
      .from(claims)
      .where(and(
        eq(claims.companyId, context.companyId),
        sql`${claims.status} IN ('supplement_required', 'supplement_submitted', 'waiting_for_carrier')`
      ))
      .orderBy(desc(claims.updatedAt))
      .limit(20);

    for (const claim of waitingClaims) {
      const priority = claim.status === 'waiting_for_carrier' ? 'medium' : 'high';
      recommendations.push({
        id: `rec-claim-${claim.id}`,
        priority,
        type: claim.status === 'waiting_for_carrier' ? 'warning' : 'action',
        title: `Supplement work pending — ${claim.claimNumber}`,
        reason: claim.status === 'waiting_for_carrier'
          ? `Claim ${claim.claimNumber} is waiting for a carrier response. Follow up to keep the claim moving.`
          : `Claim ${claim.claimNumber} needs supplement work. Generate a supplement to keep the workflow moving.`,
        expectedImpact: { quality: 'Keeps claim workflow on track' },
        suggestedAction: claim.status === 'waiting_for_carrier'
          ? `Open claim ${claim.claimNumber} and follow up with the carrier`
          : `Open claim ${claim.claimNumber} and generate a supplement`,
        relatedEntityId: claim.id,
        relatedEntityType: 'claim',
        createdAt: claim.updatedAt.toISOString(),
        acknowledged: false,
      });
    }

    // Supplements awaiting carrier response for >7 days
    const overdueSupplements = await db
      .select()
      .from(supplements)
      .where(and(
        eq(supplements.companyId, context.companyId),
        sql`${supplements.status} IN ('submitted', 'waiting_for_carrier')`,
        lt(supplements.updatedAt, sevenDaysAgo)
      ))
      .limit(20);

    for (const supplement of overdueSupplements) {
      const amount = Number(supplement.requestedAmount) || 0;
      recommendations.push({
        id: `rec-sup-${supplement.id}`,
        priority: 'high',
        type: 'warning',
        title: `Supplement response overdue — ${supplement.supplementNumber}`,
        reason: `Supplement ${supplement.supplementNumber} has been awaiting a carrier response for more than 7 days.`,
        expectedImpact: { financial: amount, time: 'Potential carrier delays' },
        suggestedAction: `Escalate supplement ${supplement.supplementNumber} with the carrier`,
        relatedEntityId: supplement.id,
        relatedEntityType: 'supplement',
        createdAt: supplement.updatedAt.toISOString(),
        acknowledged: false,
      });
    }

    // Revenue opportunity: active claims with approved < estimated (potential supplements)
    const activeClaims = await db
      .select()
      .from(claims)
      .where(and(
        eq(claims.companyId, context.companyId),
        sql`${claims.status} NOT IN ('closed', 'completed', 'denied')`
      ))
      .limit(50);

    for (const claim of activeClaims) {
      const estimated = Number(claim.estimatedValue) || 0;
      const approved = Number(claim.approvedValue) || 0;
      if (estimated > 0 && approved >= 0 && estimated - approved >= 1000) {
        const opportunity = estimated - approved;
        recommendations.push({
          id: `rec-opp-${claim.id}`,
          priority: 'medium',
          type: 'opportunity',
          title: `Revenue opportunity — ${claim.claimNumber}`,
          reason: `Claim ${claim.claimNumber} has an estimated value of $${estimated.toLocaleString()} but only $${approved.toLocaleString()} approved.`,
          expectedImpact: { financial: opportunity },
          suggestedAction: `Review claim ${claim.claimNumber} for supplement opportunities`,
          relatedEntityId: claim.id,
          relatedEntityType: 'claim',
          createdAt: claim.updatedAt.toISOString(),
          acknowledged: false,
        });
      }
    }

    // Limit to most relevant, newest first
    const sorted = recommendations
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 25);

    return NextResponse.json(sorted);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Recommendations GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}
