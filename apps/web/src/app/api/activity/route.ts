import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { activityLogs } from '@project-atlas/database';
import { eq, and, or, like, desc, count, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const activitySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid().optional(),
  entityName: z.string().optional(),
  action: z.string().min(1),
  description: z.string().optional(),
  previousValues: z.record(z.any()).optional(),
  newValues: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
});

// GET /api/activity - List activity logs with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1') || 1;
    const limit = parseInt(searchParams.get('limit') || '50') || 50;
    const offset = (page - 1) * limit;

    const userId = searchParams.get('userId') || '';
    const entityType = searchParams.get('entityType') || '';
    const action = searchParams.get('action') || '';
    const search = searchParams.get('search') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    const conditions = [eq(activityLogs.companyId, context.companyId)];
    if (userId) conditions.push(eq(activityLogs.userId, userId));
    if (entityType) conditions.push(eq(activityLogs.entityType, entityType));
    if (action) conditions.push(eq(activityLogs.action, action));
    if (search) {
      const searchCondition = or(
        like(activityLogs.entityName, `%${search}%`),
        like(activityLogs.description, `%${search}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    if (startDate) {
      const start = new Date(`${startDate}T00:00:00`);
      if (!isNaN(start.getTime())) {
        conditions.push(sql`${activityLogs.createdAt} >= ${start}`);
      }
    }
    if (endDate) {
      const end = new Date(`${endDate}T23:59:59.999`);
      if (!isNaN(end.getTime())) {
        conditions.push(sql`${activityLogs.createdAt} <= ${end}`);
      }
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [countResult] = await db
      .select({ value: count() })
      .from(activityLogs)
      .where(whereClause);

    const results = await db
      .select()
      .from(activityLogs)
      .where(whereClause)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const total = countResult?.value || 0;

    return NextResponse.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Activity GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
  }
}

// POST /api/activity - Create activity log
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const validated = activitySchema.parse(body);

    const [newActivity] = await db
      .insert(activityLogs)
      .values({
        entityType: validated.entityType,
        entityId: validated.entityId,
        entityName: validated.entityName,
        action: validated.action,
        description: validated.description,
        previousValues: validated.previousValues,
        newValues: validated.newValues,
        ipAddress: validated.ipAddress,
        companyId: context.companyId,
        userId: context.userId,
        userName: context.userName || null,
      })
      .returning();

    return NextResponse.json(newActivity, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Activity POST error:', error);
    return NextResponse.json({ error: 'Failed to create activity log' }, { status: 500 });
  }
}
