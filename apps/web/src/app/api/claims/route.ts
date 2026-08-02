import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { claims, adjusters } from '@project-atlas/database';
import { eq, and, or, like, desc, count } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const claimSchema = z.object({
  claimNumber: z.string().min(1),
  entryPoint: z.enum(['new_claim', 'existing_claim', 'supplement_only', 'imported']).optional(),
  sourceSystem: z.string().optional(),
  status: z.string().default('new'),
  dateOfLoss: z.string().or(z.date()).optional(),
  dateReported: z.string().or(z.date()).optional(),
  insuranceCompany: z.string().optional(),
  policyNumber: z.string().optional(),
  deductible: z.string().or(z.number()).optional(),
  estimatedValue: z.string().or(z.number()).optional(),
  approvedValue: z.string().or(z.number()).optional(),
  description: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
  customerPhone: z.string().optional(),
  adjusterId: z.string().optional(),
  propertyId: z.string().optional(),
});

// GET /api/claims - List claims with search, filters, and pagination
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
    const search = searchParams.get('search') || '';

    const conditions = [eq(claims.companyId, context.companyId)];
    if (status) conditions.push(eq(claims.status, status));
    if (adjusterId) conditions.push(eq(claims.adjusterId, adjusterId));
    if (search) {
      const searchCondition = or(
        like(claims.claimNumber, `%${search}%`),
        like(claims.customerName, `%${search}%`),
        like(claims.insuranceCompany, `%${search}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [countResult] = await db
      .select({ value: count() })
      .from(claims)
      .where(whereClause);

    const results = await db
      .select({
        id: claims.id,
        companyId: claims.companyId,
        adjusterId: claims.adjusterId,
        propertyId: claims.propertyId,
        claimNumber: claims.claimNumber,
        status: claims.status,
        entryPoint: claims.entryPoint,
        sourceSystem: claims.sourceSystem,
        dateOfLoss: claims.dateOfLoss,
        dateReported: claims.dateReported,
        insuranceCompany: claims.insuranceCompany,
        policyNumber: claims.policyNumber,
        deductible: claims.deductible,
        estimatedValue: claims.estimatedValue,
        approvedValue: claims.approvedValue,
        description: claims.description,
        customerName: claims.customerName,
        customerEmail: claims.customerEmail,
        customerPhone: claims.customerPhone,
        statusHistory: claims.statusHistory,
        financialSummary: claims.financialSummary,
        createdAt: claims.createdAt,
        updatedAt: claims.updatedAt,
        adjuster: {
          id: adjusters.id,
          fullName: adjusters.fullName,
        },
      })
      .from(claims)
      .leftJoin(adjusters, eq(claims.adjusterId, adjusters.id))
      .where(whereClause)
      .orderBy(desc(claims.updatedAt))
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
    console.error('Claims GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch claims' }, { status: 500 });
  }
}

// POST /api/claims - Create claim
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const validated = claimSchema.parse(body);

    const [newClaim] = await db
      .insert(claims)
      .values({
        claimNumber: validated.claimNumber,
        entryPoint: validated.entryPoint || 'new_claim',
        sourceSystem: validated.sourceSystem,
        status: validated.status || 'new',
        companyId: context.companyId,
        dateOfLoss: validated.dateOfLoss ? new Date(validated.dateOfLoss) : null,
        dateReported: validated.dateReported ? new Date(validated.dateReported) : null,
        insuranceCompany: validated.insuranceCompany,
        policyNumber: validated.policyNumber,
        deductible: validated.deductible ? String(validated.deductible) : null,
        estimatedValue: validated.estimatedValue ? String(validated.estimatedValue) : null,
        approvedValue: validated.approvedValue ? String(validated.approvedValue) : null,
        description: validated.description,
        customerName: validated.customerName,
        customerEmail: validated.customerEmail,
        customerPhone: validated.customerPhone,
        adjusterId: validated.adjusterId,
        propertyId: validated.propertyId,
        statusHistory: [{
          status: validated.status || 'new',
          timestamp: new Date().toISOString(),
          userId: context.userId,
          userName: context.userName,
        }],
        createdBy: context.userId,
      })
      .returning();

    return NextResponse.json(newClaim, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Claims POST error:', error);
    return NextResponse.json({ error: 'Failed to create claim' }, { status: 500 });
  }
}
