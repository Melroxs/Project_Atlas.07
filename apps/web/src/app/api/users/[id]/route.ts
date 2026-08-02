import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { tenantMembers, profiles } from '@project-atlas/database';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const roleSchema = z.object({
  role: z.enum(['Owner', 'Admin', 'Member']),
});

// GET /api/users/[id] - Get a user in the current company
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const [result] = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        role: tenantMembers.role,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .innerJoin(tenantMembers, eq(tenantMembers.userId, profiles.id))
      .where(and(eq(tenantMembers.companyId, context.companyId), eq(profiles.id, id)));

    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: result.id,
      email: result.email,
      name: [result.firstName, result.lastName].filter(Boolean).join(' ') || result.email,
      role: result.role,
      createdAt: result.createdAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('User GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PUT /api/users/[id] - Update user role in the current company
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const body = await request.json();
    const validated = roleSchema.parse(body);

    const [updated] = await db
      .update(tenantMembers)
      .set({ role: validated.role, updatedBy: context.userId, updatedAt: new Date() })
      .where(and(eq(tenantMembers.userId, id), eq(tenantMembers.companyId, context.companyId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ id, role: validated.role, message: 'User role updated' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('User PUT error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Remove a user from the current company
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const [deleted] = await db
      .delete(tenantMembers)
      .where(and(eq(tenantMembers.userId, id), eq(tenantMembers.companyId, context.companyId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User removed from company' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('User DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}
