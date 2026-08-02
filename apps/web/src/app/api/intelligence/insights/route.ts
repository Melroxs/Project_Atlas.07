import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { claims, supplements, activityLogs, adjusters } from '@project-atlas/database';
import { eq, and, count, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';

interface BusinessInsight {
  id: string;
  title: string;
  value: number | string;
  trend: 'up' | 'down' | 'stable';
  trendValue?: number;
  description: string;
  category: 'revenue' | 'claims' | 'supplements' | 'operations' | 'ai';
  priority: 'high' | 'medium' | 'low';
  lastUpdated: string;
}

// GET /api/intelligence/insights - Compute business insights from live data
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const insights: BusinessInsight[] = [];
    const now = new Date();

    // Claims counts by status
    const [claimsCount] = await db.select({ value: count() }).from(claims).where(eq(claims.companyId, context.companyId));
    const statusCounts = await db
      .select({ status: claims.status, value: count() })
      .from(claims)
      .where(eq(claims.companyId, context.companyId))
      .groupBy(claims.status);

    const totalClaims = claimsCount?.value || 0;
    const byStatus: Record<string, number> = {};
    for (const row of statusCounts) byStatus[row.status] = row.value;
    const activeClaims = totalClaims - (byStatus['closed'] || 0) - (byStatus['completed'] || 0) - (byStatus['denied'] || 0);

    // Supplement financial totals
    const [amounts] = await db
      .select({
        totalRequested: sql<string>`COALESCE(SUM(CAST(${supplements.requestedAmount} AS NUMERIC)), 0)`,
        totalApproved: sql<string>`COALESCE(SUM(CAST(${supplements.approvedAmount} AS NUMERIC)), 0)`,
      })
      .from(supplements)
      .where(eq(supplements.companyId, context.companyId));

    const [supCount] = await db.select({ value: count() }).from(supplements).where(eq(supplements.companyId, context.companyId));
    const totalSupplements = supCount?.value || 0;

    // Activity today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [todayCount] = await db
      .select({ value: count() })
      .from(activityLogs)
      .where(and(eq(activityLogs.companyId, context.companyId), sql`${activityLogs.createdAt} >= ${todayStart}`));

    // Adjusters count
    const [adjustersCount] = await db.select({ value: count() }).from(adjusters).where(eq(adjusters.companyId, context.companyId));

    const lastUpdated = now.toISOString();

    insights.push(
      {
        id: 'ins-total-claims',
        title: 'Total Claims',
        value: totalClaims,
        trend: 'stable',
        description: 'All claims created in your organization',
        category: 'claims',
        priority: 'medium',
        lastUpdated,
      },
      {
        id: 'ins-active-claims',
        title: 'Active Claims',
        value: activeClaims,
        trend: 'stable',
        description: 'Claims currently in progress (not closed/completed/denied)',
        category: 'claims',
        priority: 'high',
        lastUpdated,
      },
      {
        id: 'ins-supplements',
        title: 'Total Supplements',
        value: totalSupplements,
        trend: 'stable',
        description: 'Supplements generated across all claims',
        category: 'supplements',
        priority: 'medium',
        lastUpdated,
      },
      {
        id: 'ins-requested',
        title: 'Requested Revenue',
        value: `$${Number(amounts?.totalRequested || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        trend: 'up',
        description: 'Total supplement amounts requested',
        category: 'revenue',
        priority: 'high',
        lastUpdated,
      },
      {
        id: 'ins-approved',
        title: 'Approved Revenue',
        value: `$${Number(amounts?.totalApproved || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        trend: 'up',
        description: 'Total supplement amounts approved',
        category: 'revenue',
        priority: 'high',
        lastUpdated,
      },
      {
        id: 'ins-today-activity',
        title: "Today's Activity",
        value: todayCount?.value || 0,
        trend: 'stable',
        description: 'Events logged in the activity timeline today',
        category: 'operations',
        priority: 'low',
        lastUpdated,
      },
      {
        id: 'ins-adjusters',
        title: 'Adjusters',
        value: adjustersCount?.value || 0,
        trend: 'stable',
        description: 'Adjusters tracked in your organization',
        category: 'operations',
        priority: 'low',
        lastUpdated,
      },
      {
        id: 'ins-ai',
        title: 'AI Engine',
        value: 'Active',
        trend: 'stable',
        description: 'Decision Engine and Claim Intelligence configured',
        category: 'ai',
        priority: 'low',
        lastUpdated,
      }
    );

    return NextResponse.json(insights);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Insights GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}
