import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { claims } from '@project-atlas/database';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';
import { STATUS_LABELS } from '@/lib/claims-workflow';

const statusSchema = z.object({
  status: z.string().min(1),
  reason: z.string().optional(),
});

// PUT /api/claims/[id]/status - Change claim status with history
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const body = await request.json();
    const validated = statusSchema.parse(body);

    const [existing] = await db
      .select()
      .from(claims)
      .where(and(eq(claims.id, id), eq(claims.companyId, context.companyId)));

    if (!existing) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const currentHistory = (existing.statusHistory as any[]) || [];
    const newHistory = [
      ...currentHistory,
      {
        status: validated.status,
        timestamp: new Date().toISOString(),
        userId: context.userId,
        userName: context.userName,
        reason: validated.reason,
      },
    ];

    const [updated] = await db
      .update(claims)
      .set({
        status: validated.status,
        statusHistory: newHistory,
        updatedBy: context.userId,
        updatedAt: new Date(),
      })
      .where(eq(claims.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Claim status PUT error:', error);
    return NextResponse.json({ error: 'Failed to change claim status' }, { status: 500 });
  }
}
