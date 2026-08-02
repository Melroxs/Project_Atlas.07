import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { activityLogs } from '@project-atlas/database';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';

// GET /api/activity/entity-types - Distinct entity types with activity in this company
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const results = await db
      .select({ entityType: activityLogs.entityType })
      .from(activityLogs)
      .where(eq(activityLogs.companyId, context.companyId));

    const seen = new Set<string>();
    const entityTypes: Array<{ entityType: string }> = [];
    for (const row of results) {
      if (!row.entityType || seen.has(row.entityType)) continue;
      seen.add(row.entityType);
      entityTypes.push({ entityType: row.entityType });
    }

    return NextResponse.json(entityTypes);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Activity entity-types GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity entity types' }, { status: 500 });
  }
}
