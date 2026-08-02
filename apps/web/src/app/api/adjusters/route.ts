import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { adjusters } from '@project-atlas/database';
import { eq, and, or, like, desc, count } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const adjusterSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  insuranceCompany: z.string().optional(),
  office: z.string().optional(),
  territory: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
});

// GET /api/adjusters - List adjusters with search, filters, and pagination
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1') || 1;
    const limit = parseInt(searchParams.get('limit') || '20') || 20;
    const offset = (page - 1) * limit;

    const search = searchParams.get('search') || '';
    const active = searchParams.get('active') || '';

    const conditions = [eq(adjusters.companyId, context.companyId)];
    if (active === 'true') conditions.push(eq(adjusters.active, true));
    if (active === 'false') conditions.push(eq(adjusters.active, false));
    if (search) {
      const searchCondition = or(
        like(adjusters.fullName, `%${search}%`),
        like(adjusters.email, `%${search}%`),
        like(adjusters.phone, `%${search}%`),
        like(adjusters.insuranceCompany, `%${search}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [countResult] = await db
      .select({ value: count() })
      .from(adjusters)
      .where(whereClause);

    const results = await db
      .select()
      .from(adjusters)
      .where(whereClause)
      .orderBy(desc(adjusters.createdAt))
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
    console.error('Adjusters GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch adjusters' }, { status: 500 });
  }
}

// POST /api/adjusters - Create adjuster
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const validated = adjusterSchema.parse(body);

    const [newAdjuster] = await db
      .insert(adjusters)
      .values({
        fullName: validated.fullName,
        email: validated.email,
        phone: validated.phone,
        insuranceCompany: validated.insuranceCompany,
        office: validated.office,
        territory: validated.territory,
        notes: validated.notes,
        active: validated.active ?? true,
        companyId: context.companyId,
        createdBy: context.userId,
      })
      .returning();

    return NextResponse.json(newAdjuster, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Adjusters POST error:', error);
    return NextResponse.json({ error: 'Failed to create adjuster' }, { status: 500 });
  }
}
