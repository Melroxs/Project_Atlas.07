import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { activityLogs } from '@project-atlas/database';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';

// GET /api/activity/actions - Distinct actions recorded in this company
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const results = await db
      .select({ action: activityLogs.action })
      .from(activityLogs)
      .where(eq(activityLogs.companyId, context.companyId));

    const seen = new Set<string>();
    const actions: Array<{ action: string }> = [];
    for (const row of results) {
      if (!row.action || seen.has(row.action)) continue;
      seen.add(row.action);
      actions.push({ action: row.action });
    }

    return NextResponse.json(actions);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Activity actions GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity actions' }, { status: 500 });
  }
}
