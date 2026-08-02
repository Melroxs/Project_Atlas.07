import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { claims } from '@project-atlas/database';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const claimUpdateSchema = z.object({
  claimNumber: z.string().min(1).optional(),
  entryPoint: z.enum(['new_claim', 'existing_claim', 'supplement_only', 'imported']).optional(),
  sourceSystem: z.string().optional(),
  status: z.string().optional(),
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

function financialSummary(claim: any) {
  const estimated = claim.estimatedValue ? Number(claim.estimatedValue) : 0;
  const approved = claim.approvedValue ? Number(claim.approvedValue) : 0;
  const deductible = claim.deductible ? Number(claim.deductible) : 0;
  return {
    estimatedValue: estimated,
    approvedValue: approved,
    deductible,
    netApproved: approved - deductible,
    outstanding: Math.max(estimated - approved, 0),
  };
}

// GET /api/claims/[id] - Get claim details with financial summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const [claim] = await db
      .select()
      .from(claims)
      .where(and(eq(claims.id, id), eq(claims.companyId, context.companyId)));

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    return NextResponse.json({ ...claim, financialSummary: financialSummary(claim) });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Claim GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch claim' }, { status: 500 });
  }
}

// PUT /api/claims/[id] - Update claim
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const body = await request.json();
    const validated = claimUpdateSchema.parse(body);

    const updateData: any = { ...validated, updatedBy: context.userId, updatedAt: new Date() };
    if (validated.dateOfLoss) updateData.dateOfLoss = new Date(validated.dateOfLoss);
    if (validated.dateReported) updateData.dateReported = new Date(validated.dateReported);
    if (validated.deductible !== undefined) updateData.deductible = String(validated.deductible);
    if (validated.estimatedValue !== undefined) updateData.estimatedValue = String(validated.estimatedValue);
    if (validated.approvedValue !== undefined) updateData.approvedValue = String(validated.approvedValue);

    const [updatedClaim] = await db
      .update(claims)
      .set(updateData)
      .where(and(eq(claims.id, id), eq(claims.companyId, context.companyId)))
      .returning();

    if (!updatedClaim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    return NextResponse.json(updatedClaim);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Claim PUT error:', error);
    return NextResponse.json({ error: 'Failed to update claim' }, { status: 500 });
  }
}

// DELETE /api/claims/[id] - Delete claim
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const [deletedClaim] = await db
      .delete(claims)
      .where(and(eq(claims.id, id), eq(claims.companyId, context.companyId)))
      .returning();

    if (!deletedClaim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Claim deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Claim DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete claim' }, { status: 500 });
  }
}
