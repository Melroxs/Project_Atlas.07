import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { supplements } from '@project-atlas/database';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const statusSchema = z.object({
  status: z.enum(['draft', 'ready_for_review', 'submitted', 'waiting_for_carrier', 'needs_revision', 'partially_approved', 'approved', 'denied', 'closed']),
  reason: z.string().optional(),
});

// PUT /api/supplements/[id]/status - Change supplement status
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
      .from(supplements)
      .where(and(eq(supplements.id, id), eq(supplements.companyId, context.companyId)));

    if (!existing) {
      return NextResponse.json({ error: 'Supplement not found' }, { status: 404 });
    }

    const statusHistory = (existing.statusHistory as any[]) || [];
    const newHistory = [
      ...statusHistory,
      {
        status: validated.status,
        timestamp: new Date().toISOString(),
        userId: context.userId,
        userName: context.userName,
        reason: validated.reason,
      },
    ];

    const updates: any = {
      status: validated.status,
      statusHistory: newHistory,
      updatedBy: context.userId,
      updatedAt: new Date(),
    };

    if (validated.status === 'submitted' && !existing.submissionDate) updates.submissionDate = new Date();
    if (validated.status === 'waiting_for_carrier' && !existing.responseDate) updates.responseDate = new Date();
    if (validated.status === 'approved' && !existing.approvalDate) updates.approvalDate = new Date();
    if (validated.status === 'denied') updates.denialReason = validated.reason || null;

    const [updated] = await db
      .update(supplements)
      .set(updates)
      .where(eq(supplements.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Supplement status PUT error:', error);
    return NextResponse.json({ error: 'Failed to change supplement status' }, { status: 500 });
  }
}
