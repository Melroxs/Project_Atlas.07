import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { activityLogs } from '@project-atlas/database';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';

// GET /api/activity/users - Distinct users who have activity in this company
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const results = await db
      .select({
        userId: activityLogs.userId,
        userName: activityLogs.userName,
      })
      .from(activityLogs)
      .where(eq(activityLogs.companyId, context.companyId))
      .orderBy(desc(activityLogs.createdAt));

    const seen = new Set<string>();
    const users: Array<{ userId: string | null; userName: string | null }> = [];
    for (const row of results) {
      const key = row.userId ?? 'system';
      if (seen.has(key)) continue;
      seen.add(key);
      users.push(row);
    }

    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Activity users GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity users' }, { status: 500 });
  }
}
