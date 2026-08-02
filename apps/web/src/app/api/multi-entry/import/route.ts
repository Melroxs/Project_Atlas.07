import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { claims, supplements, documents, properties } from '@project-atlas/database';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const importProjectSchema = z.object({
  claimNumber: z.string().min(1).max(64),
  carrier: z.string().max(255).optional(),
  policyNumber: z.string().max(100).optional(),
  dateOfLoss: z.string().optional(),
  description: z.string().optional(),
  customer: z.object({
    name: z.string().max(255).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
  }).optional(),
  property: z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    ownerName: z.string().optional(),
  }).optional(),
  photos: z.array(z.object({ url: z.string(), fileName: z.string().optional(), mimeType: z.string().optional() })).optional(),
  documents: z.array(z.object({ url: z.string(), fileName: z.string().optional(), mimeType: z.string().optional() })).optional(),
  estimates: z.array(z.object({
    carrierEstimateAmount: z.number().optional(),
    contractorEstimateAmount: z.number().optional(),
    lineItems: z.array(z.any()).optional(),
  })).optional(),
  sourceSystem: z.string().max(255).optional(),
});

// POST /api/multi-entry/import - Import an in-progress project
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const validated = importProjectSchema.parse(body);

    // Create property if provided
    let propertyId: string | null = null;
    if (validated.property && (validated.property.address || validated.property.ownerName)) {
      const [property] = await db
        .insert(properties)
        .values({
          companyId: context.companyId,
          address: validated.property.address || null,
          city: validated.property.city || null,
          state: validated.property.state || null,
          zip: validated.property.zip || null,
          ownerName: validated.property.ownerName || null,
          createdBy: context.userId,
        } as any)
        .returning();
      propertyId = property.id;
    }

    // Create the claim shell (entry point: imported)
    const [claim] = await db
      .insert(claims)
      .values({
        companyId: context.companyId,
        claimNumber: validated.claimNumber,
        entryPoint: 'imported',
        sourceSystem: validated.sourceSystem || 'external',
        status: 'estimate_submitted',
        insuranceCompany: validated.carrier || null,
        policyNumber: validated.policyNumber || null,
        dateOfLoss: validated.dateOfLoss ? new Date(validated.dateOfLoss) : null,
        customerName: validated.customer?.name || null,
        customerEmail: validated.customer?.email || null,
        customerPhone: validated.customer?.phone || null,
        description: validated.description || null,
        propertyId,
        statusHistory: [{
          status: 'estimate_submitted',
          timestamp: new Date().toISOString(),
          userId: context.userId,
          userName: context.userName,
          reason: `Imported project${validated.sourceSystem ? ` from ${validated.sourceSystem}` : ''}`,
        }],
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

    // Create supplements from imported estimates
    const supplementsCreated: any[] = [];
    for (const [idx, est] of (validated.estimates || []).entries()) {
      const supplementNumber = `SUP-${claim.claimNumber}-${idx + 1}`;
      const [sup] = await db
        .insert(supplements)
        .values({
          companyId: context.companyId,
          claimId: claim.id,
          supplementNumber,
          status: 'draft',
          carrier: validated.carrier || null,
          requestedAmount: est.contractorEstimateAmount ? String(est.contractorEstimateAmount) : null,
          approvedAmount: est.carrierEstimateAmount ? String(est.carrierEstimateAmount) : null,
          lineItems: est.lineItems || [],
          statusHistory: [],
          revisionHistory: [],
          createdBy: context.userId,
        } as any)
        .returning();
      supplementsCreated.push(sup);
    }

    return NextResponse.json(
      {
        claim,
        propertyId,
        supplements: supplementsCreated,
        documentsAttached: attachments.length,
        message: 'Project imported. Claim Workspace reconstructed.',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Import POST error:', error);
    return NextResponse.json(
      { error: 'Failed to import project', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
