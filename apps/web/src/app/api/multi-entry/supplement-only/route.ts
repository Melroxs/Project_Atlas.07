import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { claims, supplements, documents } from '@project-atlas/database';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const supplementOnlySchema = z.object({
  claimNumber: z.string().min(1).max(64),
  carrier: z.string().max(255).optional(),
  policyNumber: z.string().max(100).optional(),
  dateOfLoss: z.string().optional(),
  customerName: z.string().max(255).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(50).optional(),
  description: z.string().optional(),
  carrierEstimateAmount: z.number().optional(),
  contractorEstimateAmount: z.number().optional(),
  lineItems: z.array(z.any()).optional(),
  photos: z.array(z.object({ url: z.string(), fileName: z.string().optional(), mimeType: z.string().optional() })).optional(),
  documents: z.array(z.object({ url: z.string(), fileName: z.string().optional(), mimeType: z.string().optional() })).optional(),
  internalNotes: z.string().optional(),
});

// POST /api/multi-entry/supplement-only - Create claim + supplement (no claim package required)
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const validated = supplementOnlySchema.parse(body);

    // Create the claim shell (entry point: supplement_only)
    const [claim] = await db
      .insert(claims)
      .values({
        companyId: context.companyId,
        claimNumber: validated.claimNumber,
        entryPoint: 'supplement_only',
        status: 'supplement_required',
        insuranceCompany: validated.carrier || null,
        policyNumber: validated.policyNumber || null,
        dateOfLoss: validated.dateOfLoss ? new Date(validated.dateOfLoss) : null,
        customerName: validated.customerName || null,
        customerEmail: validated.customerEmail || null,
        customerPhone: validated.customerPhone || null,
        description: validated.description || null,
        statusHistory: [{
          status: 'supplement_required',
          timestamp: new Date().toISOString(),
          userId: context.userId,
          userName: context.userName,
          reason: 'Entered via Supplement-Only workflow',
        }],
        createdBy: context.userId,
      } as any)
      .returning();

    // Create the supplement draft directly
    const requestedAmount = validated.contractorEstimateAmount ?? validated.carrierEstimateAmount ?? 0;
    const approvedAmount = validated.carrierEstimateAmount ?? 0;
    const supplementNumber = `SUP-${claim.claimNumber}-1`;

    const [supplement] = await db
      .insert(supplements)
      .values({
        companyId: context.companyId,
        claimId: claim.id,
        supplementNumber,
        status: 'draft',
        carrier: validated.carrier || null,
        requestedAmount: requestedAmount ? String(requestedAmount) : null,
        approvedAmount: approvedAmount ? String(approvedAmount) : null,
        lineItems: validated.lineItems || [],
        internalNotes: validated.internalNotes || null,
        statusHistory: [],
        revisionHistory: [],
        createdBy: context.userId,
      } as any)
      .returning();

    // Attach photos + documents
    const attachments = [...(validated.photos || []), ...(validated.documents || [])];
    for (const att of attachments) {
      await db
        .insert(documents)
        .values({
          companyId: context.companyId,
          claimId: claim.id,
          url: att.url,
          fileName: att.fileName || att.url.split('/').pop() || 'attachment',
          mimeType: att.mimeType || null,
          createdBy: context.userId,
        } as any);
    }

    return NextResponse.json(
      { claim, supplement, message: 'Claim and supplement created. Supplement-Only workflow active.' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Supplement-only POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create supplement-only project', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
