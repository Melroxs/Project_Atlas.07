import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { interviews, claims } from '@project-atlas/database';
import { eq, and, like } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';

// POST /api/interviews/[id]/generate-claim - Link or create a claim from an interview.
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

    // Demo-seeded interviews already carry a claim - return it (idempotent).
    const existingId = interview.claimId ?? interview.generatedClaimId;
    if (existingId) {
      const [existing] = await db
        .select()
        .from(claims)
        .where(eq(claims.id, existingId))
        .limit(1);
      if (existing) {
        return NextResponse.json({
          success: true,
          claimId: existing.id,
          claimNumber: existing.claimNumber,
          alreadyGenerated: true,
        });
      }
    }

    // No claim yet (real-UI interview): create one from the FNOL responses.
    const responses = (interview.responses || {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const lossRaw = str(responses['date-of-loss']);
    const lossDate =
      lossRaw && !isNaN(new Date(lossRaw).getTime()) ? new Date(lossRaw) : null;

    const claimNumber = await nextClaimNumber(context.companyId);
    const [claimRow] = await db
      .insert(claims)
      .values({
        companyId: context.companyId,
        claimNumber,
        entryPoint: 'new_claim',
        status: 'new',
        customerName: str(responses['customer-name']) || null,
        insuranceCompany: str(responses['insurance-company']) || null,
        policyNumber: str(responses['policy-number']) || null,
        dateOfLoss: lossDate,
        deductible: str(responses['deductible']).replace(/[$,]/g, '') || null,
        description: str(responses['cause-of-loss']) || null,
        statusHistory: [
          {
            status: 'new',
            timestamp: new Date().toISOString(),
            userId: context.userId,
            userName: context.userName,
            reason: 'Claim generated from FNOL interview',
          },
        ],
        createdBy: context.userId,
      })
      .returning();

    await db
      .update(interviews)
      .set({
        claimId: claimRow.id,
        generatedClaimId: claimRow.id,
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: context.userId,
      })
      .where(eq(interviews.id, id));

    return NextResponse.json({
      success: true,
      claimId: claimRow.id,
      claimNumber,
      alreadyGenerated: false,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Interview generate-claim POST error:', error);
    return NextResponse.json({ error: 'Failed to generate claim from interview' }, { status: 500 });
  }
}

/** Next company claim number: CL-<year>-<seq>, avoiding collisions with existing claims. */
async function nextClaimNumber(companyId: string): Promise<string> {
  const prefix = `CL-${new Date().getFullYear()}-`;
  const rows = await db
    .select({ claimNumber: claims.claimNumber })
    .from(claims)
    .where(and(eq(claims.companyId, companyId), like(claims.claimNumber, `${prefix}%`)));
  const used = new Set(rows.map((r) => r.claimNumber));
  let seq = rows.length + 1;
  while (used.has(`${prefix}${String(seq).padStart(4, '0')}`)) seq += 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}
