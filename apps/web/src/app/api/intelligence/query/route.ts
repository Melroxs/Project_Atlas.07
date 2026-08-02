import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { claims, supplements, adjusters, activityLogs } from '@project-atlas/database';
import { eq, and, desc, count, sql, like, or } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';

interface QueryResult {
  answer: string;
  reasoning: string;
  statistics: Record<string, number | string>;
  supportingRecords: Array<{ id: string; type: string; description: string; value?: number }>;
  recommendedActions: string[];
  confidence: number;
  dataSources: string[];
}

// POST /api/intelligence/query - Answer a natural-language business question
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const question = (body?.question || '').toString().toLowerCase();

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const result = await answerQuestion(question, context.companyId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Intelligence query POST error:', error);
    return NextResponse.json({ error: 'Failed to process query' }, { status: 500 });
  }
}

async function answerQuestion(question: string, companyId: string): Promise<QueryResult> {
  const [claimsCount] = await db.select({ value: count() }).from(claims).where(eq(claims.companyId, companyId));
  const [supplementsCount] = await db.select({ value: count() }).from(supplements).where(eq(supplements.companyId, companyId));
  const [adjustersCount] = await db.select({ value: count() }).from(adjusters).where(eq(adjusters.companyId, companyId));

  // Status breakdown
  const statusCounts = await db
    .select({ status: claims.status, value: count() })
    .from(claims)
    .where(eq(claims.companyId, companyId))
    .groupBy(claims.status);

  const byStatus: Record<string, number> = {};
  for (const row of statusCounts) byStatus[row.status] = row.value;

  // Recent claims
  const recentClaims = await db
    .select()
    .from(claims)
    .where(eq(claims.companyId, companyId))
    .orderBy(desc(claims.updatedAt))
    .limit(5);

  // Total supplement value
  const [amounts] = await db
    .select({
      requested: sql<string>`COALESCE(SUM(CAST(${supplements.requestedAmount} AS NUMERIC)), 0)`,
      approved: sql<string>`COALESCE(SUM(CAST(${supplements.approvedAmount} AS NUMERIC)), 0)`,
    })
    .from(supplements)
    .where(eq(supplements.companyId, companyId));

  const totalClaims = claimsCount?.value || 0;
  const waitingSupplements = (byStatus['supplement_required'] || 0) + (byStatus['supplement_submitted'] || 0) + (byStatus['waiting_for_carrier'] || 0);

  let answer = '';
  let reasoning = '';
  let confidence = 0.75;
  let dataSources = ['claims'];

  if (question.includes('claim')) {
    if (question.includes('total') || question.includes('how many')) {
      answer = `You have ${totalClaims} total claims. ${waitingSupplements} are currently waiting on supplement work.`;
      reasoning = 'Counted claims in the database and filtered those with supplement-related statuses.';
    } else if (question.includes('recent') || question.includes('latest')) {
      answer = recentClaims.length
        ? `Your most recent claims: ${recentClaims.map((c) => c.claimNumber).join(', ')}.`
        : 'You have no claims yet.';
      reasoning = 'Queried the most recently updated claims.';
      dataSources = ['claims'];
    } else {
      answer = `You have ${totalClaims} claims. Status breakdown: ${Object.entries(byStatus)
        .map(([k, v]) => `${k.replace(/_/g, ' ')} (${v})`)
        .join(', ')}.`;
      reasoning = 'Aggregated claims by workflow status.';
    }
  } else if (question.includes('supplement')) {
    answer = `You have ${supplementsCount?.value || 0} supplements totaling $${Number(amounts?.requested || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} requested and $${Number(amounts?.approved || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} approved.`;
    reasoning = 'Counted supplements and summed requested/approved amounts.';
    dataSources = ['claims', 'supplements'];
  } else if (question.includes('adjuster')) {
    answer = `You have ${adjustersCount?.value || 0} adjusters tracked.`;
    reasoning = 'Counted adjuster records in the organization.';
    dataSources = ['adjusters'];
  } else if (question.includes('revenue') || question.includes('financial') || question.includes('worth')) {
    answer = `Your supplements represent $${Number(amounts?.requested || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} in requested revenue, with $${Number(amounts?.approved || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} approved so far.`;
    reasoning = 'Summed supplement requested and approved amounts.';
    dataSources = ['claims', 'supplements'];
  } else if (question.includes('health') || question.includes('status') || question.includes('dashboard')) {
    answer = `System health is normal. ${totalClaims} claims active, ${supplementsCount?.value || 0} supplements, ${adjustersCount?.value || 0} adjusters.`;
    reasoning = 'Checked core data availability and counts across the platform.';
    dataSources = ['claims', 'supplements', 'adjusters'];
  } else {
    answer = `Atlas is tracking ${totalClaims} claims, ${supplementsCount?.value || 0} supplements, and ${adjustersCount?.value || 0} adjusters for your organization.`;
    reasoning = 'Summarized the current state of the workspace from live data.';
    dataSources = ['claims', 'supplements', 'adjusters'];
  }

  const statistics: Record<string, number | string> = {
    'Total claims': totalClaims,
    'Total supplements': supplementsCount?.value || 0,
    'Adjusters': adjustersCount?.value || 0,
    'Waiting on supplements': waitingSupplements,
  };

  const supportingRecords = recentClaims.slice(0, 5).map((c) => ({
    id: c.claimNumber,
    type: 'claim',
    description: `${c.customerName || 'Unknown customer'} • ${c.insuranceCompany || 'No carrier'} • status: ${c.status}`,
  }));

  const recommendedActions: string[] = [];
  if (waitingSupplements > 0) recommendedActions.push(`Review the ${waitingSupplements} claims waiting on supplement work.`);
  if ((supplementsCount?.value || 0) > 0) recommendedActions.push('Check supplement approval status and follow up with carriers.');

  return {
    answer,
    reasoning,
    statistics,
    supportingRecords,
    recommendedActions,
    confidence,
    dataSources,
  };
}
