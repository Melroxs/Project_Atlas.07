import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { profiles, tenantMembers } from '@project-atlas/database';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';

// GET /api/users - List users (profiles) in the current company with their roles
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const results = await db
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
      .where(eq(tenantMembers.companyId, context.companyId))
      .orderBy(desc(profiles.createdAt));

    return NextResponse.json({
      data: results.map((u) => ({
        id: u.id,
        email: u.email,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        role: u.role,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Users GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
