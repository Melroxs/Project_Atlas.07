import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { supplements, claims, adjusters } from '@project-atlas/database';
import { eq, and, or, like, desc, count, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const supplementSchema = z.object({
  claimId: z.string().uuid(),
  supplementNumber: z.string().min(1),
  version: z.string().or(z.number()).default('1'),
  status: z.string().default('draft'),
  carrier: z.string().optional(),
  requestedAmount: z.string().or(z.number()).optional(),
  approvedAmount: z.string().or(z.number()).optional(),
  difference: z.string().or(z.number()).optional(),
  lineItems: z.record(z.any()).optional(),
  internalNotes: z.string().optional(),
  submissionDate: z.string().or(z.date()).optional(),
  responseDate: z.string().or(z.date()).optional(),
  approvalDate: z.string().or(z.date()).optional(),
  denialReason: z.string().optional(),
  revisionHistory: z.record(z.any()).optional(),
  statusHistory: z.record(z.any()).optional(),
  adjusterId: z.string().uuid().optional(),
});

// GET /api/supplements - List supplements with filters, search, pagination
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1') || 1;
    const limit = parseInt(searchParams.get('limit') || '20') || 20;
    const offset = (page - 1) * limit;

    const status = searchParams.get('status') || '';
    const adjusterId = searchParams.get('adjusterId') || '';
    const carrier = searchParams.get('carrier') || '';
    const search = searchParams.get('search') || '';

    const conditions = [eq(supplements.companyId, context.companyId)];
    if (status) conditions.push(eq(supplements.status, status));
    if (adjusterId) conditions.push(eq(supplements.adjusterId, adjusterId));
    if (carrier) conditions.push(like(supplements.carrier, `%${carrier}%`));
    if (search) {
      const searchCondition = or(
        like(supplements.supplementNumber, `%${search}%`),
        like(supplements.carrier, `%${search}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [countResult] = await db
      .select({ value: count() })
      .from(supplements)
      .where(whereClause);

    const results = await db
      .select({
        id: supplements.id,
        supplementNumber: supplements.supplementNumber,
        version: supplements.version,
        status: supplements.status,
        carrier: supplements.carrier,
        requestedAmount: supplements.requestedAmount,
        approvedAmount: supplements.approvedAmount,
        difference: supplements.difference,
        submissionDate: supplements.submissionDate,
        responseDate: supplements.responseDate,
        approvalDate: supplements.approvalDate,
        createdAt: supplements.createdAt,
        updatedAt: supplements.updatedAt,
        claimId: supplements.claimId,
        claimNumber: claims.claimNumber,
        adjusterId: supplements.adjusterId,
        adjusterName: adjusters.fullName,
      })
      .from(supplements)
      .leftJoin(claims, eq(supplements.claimId, claims.id))
      .leftJoin(adjusters, eq(supplements.adjusterId, adjusters.id))
      .where(whereClause)
      .orderBy(desc(supplements.updatedAt))
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
    console.error('Supplements GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch supplements' }, { status: 500 });
  }
}

// POST /api/supplements - Create supplement
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const validated = supplementSchema.parse(body);

    const [newSupplement] = await db
      .insert(supplements)
      .values({
        claimId: validated.claimId,
        supplementNumber: validated.supplementNumber,
        version: validated.version ? String(validated.version) : '1',
        status: validated.status || 'draft',
        carrier: validated.carrier,
        requestedAmount: validated.requestedAmount !== undefined && validated.requestedAmount !== null && validated.requestedAmount !== '' ? String(validated.requestedAmount) : null,
        approvedAmount: validated.approvedAmount !== undefined && validated.approvedAmount !== null && validated.approvedAmount !== '' ? String(validated.approvedAmount) : null,
        difference: validated.difference !== undefined && validated.difference !== null && validated.difference !== '' ? String(validated.difference) : null,
        lineItems: validated.lineItems,
        internalNotes: validated.internalNotes,
        submissionDate: validated.submissionDate ? new Date(validated.submissionDate) : null,
        responseDate: validated.responseDate ? new Date(validated.responseDate) : null,
        approvalDate: validated.approvalDate ? new Date(validated.approvalDate) : null,
        denialReason: validated.denialReason,
        revisionHistory: validated.revisionHistory || [],
        statusHistory: validated.statusHistory || [],
        adjusterId: validated.adjusterId,
        companyId: context.companyId,
        createdBy: context.userId,
      })
      .returning();

    return NextResponse.json(newSupplement, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Supplements POST error:', error);
    return NextResponse.json({ error: 'Failed to create supplement' }, { status: 500 });
  }
}
