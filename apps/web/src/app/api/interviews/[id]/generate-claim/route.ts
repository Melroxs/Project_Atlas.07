import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { interviews, claims, properties } from '@project-atlas/database';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';

// POST /api/interviews/[id]/generate-claim - Generate a claim from interview responses
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const [interview] = await db
      .select()
      .from(interviews)
      .where(eq(interviews.id, id));

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    // Idempotent: if a claim was already generated from this interview, return it.
    if (interview.generatedClaimId) {
      const [existing] = await db
        .select()
        .from(claims)
        .where(eq(claims.id, interview.generatedClaimId));
      if (existing) {
        return NextResponse.json({ claim: existing, alreadyGenerated: true });
      }
    }

    const responses: Record<string, any> =
      (interview.responses ?? {}) as Record<string, any>;

    const str = (v: any): string | undefined => {
      if (v === null || v === undefined || v === '') return undefined;
      const s = String(v).trim();
      return s.length > 0 ? s : undefined;
    };

    const customerName = str(responses['customer-name']);
    const customerPhone = str(responses['customer-phone']);
    const customerEmail = str(responses['customer-email']);
    const propertyAddress = str(responses['property-address']);
    const insuranceCompany = str(responses['insurance-company']);
    const policyNumber = str(responses['policy-number']);
    const causeOfLoss = str(responses['cause-of-loss']);
    const causeDescription = str(responses['cause-description']);
    const dateOfLoss = str(responses['date-of-loss']);
    const deductible = str(responses['deductible']);

    // 1. Create the property from the interview when one wasn't linked already.
    let propertyId: string | null = interview.propertyId ?? null;
    if (!propertyId && propertyAddress) {
      const [property] = await db
        .insert(properties)
        .values({
          companyId: context.companyId,
          address: propertyAddress,
          ownerName: customerName,
          createdBy: context.userId,
        })
        .returning();
      propertyId = property.id;
    }

    // 2. Build the claim from extracted interview responses.
    const claimNumber = `CLM-${new Date().getFullYear()}${Date.now()
      .toString()
      .slice(-6)}`;

    const descriptionParts = [
      causeOfLoss ? `Cause of loss: ${causeOfLoss}` : null,
      causeDescription,
    ].filter((p): p is string => Boolean(p));

    const [newClaim] = await db
      .insert(claims)
      .values({
        companyId: context.companyId,
        claimNumber,
        entryPoint: 'new_claim',
        sourceSystem: 'fnol-interview',
        status: 'new',
        propertyId,
        dateOfLoss: dateOfLoss ? new Date(dateOfLoss) : new Date(),
        dateReported: new Date(),
        insuranceCompany,
        policyNumber,
        deductible: deductible
          ? deductible.replace(/[^0-9.]/g, '')
          : null,
        description:
          descriptionParts.join('. ') || 'Claim generated from FNOL interview.',
        customerName,
        customerEmail,
        customerPhone,
        statusHistory: [
          {
            status: 'new',
            timestamp: new Date().toISOString(),
            userId: context.userId,
            userName: context.userName,
            reason: 'Generated from FNOL interview',
          },
        ],
        createdBy: context.userId,
      })
      .returning();

    // 3. Link the generated claim back to the interview.
    await db
      .update(interviews)
      .set({
        claimId: newClaim.id,
        generatedClaimId: newClaim.id,
        updatedBy: context.userId,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, id));

    return NextResponse.json(
      { claim: newClaim, message: 'Claim generated from interview' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Interview generate-claim POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate claim from interview' },
      { status: 500 }
    );
  }
}
