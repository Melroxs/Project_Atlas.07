// apps/api/src/routes/multi-entry.ts
import { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db, claims, documents, supplements, interviews, properties, supplementDrafts } from '@project-atlas/database';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/request';
import { ActivityService } from '../lib/activity';
import {
  EntryPoint,
  EvidenceContext,
  WorkspaceState,
  AI_TASKS,
  AITask,
  emptyEvidenceContext,
  evaluateTaskReadiness,
  getWorkspaceState,
} from '../lib/workflow-engine';

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
  photos: z.array(z.object({
    url: z.string(),
    fileName: z.string().optional(),
    mimeType: z.string().optional(),
  })).optional(),
  documents: z.array(z.object({
    url: z.string(),
    fileName: z.string().optional(),
    mimeType: z.string().optional(),
  })).optional(),
  internalNotes: z.string().optional(),
});

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
  photos: z.array(z.object({
    url: z.string(),
    fileName: z.string().optional(),
    mimeType: z.string().optional(),
  })).optional(),
  documents: z.array(z.object({
    url: z.string(),
    fileName: z.string().optional(),
    mimeType: z.string().optional(),
  })).optional(),
  estimates: z.array(z.object({
    carrierEstimateAmount: z.number().optional(),
    contractorEstimateAmount: z.number().optional(),
    lineItems: z.array(z.any()).optional(),
  })).optional(),
  sourceSystem: z.string().max(255).optional(),
});

const taskCheckSchema = z.object({
  task: z.enum(AI_TASKS as [AITask, ...AITask[]]),
});

/**
 * Build the evidence context for a claim from live DB data.
 * Every feature validates only the information it actually needs — a missing
 * Claim Package or Carrier Response is recorded as optional, never a blocker.
 */
async function buildEvidenceContext(
  claimId: string,
  companyId: string
): Promise<EvidenceContext> {
  const [claim] = await db
    .select()
    .from(claims)
    .where(and(eq((claims as any).id, claimId), eq((claims as any).companyId, companyId)))
    .limit(1);

  if (!claim) {
    throw new Error('Claim not found');
  }

  // Neither evidence_links nor supplement_drafts has a claim_id column, so
  // AI-analysis evidence is scoped by joining supplement_drafts through
  // supplements (which are claim-scoped). The .catch below is intentional
  // resilience: the drafts query is a read-only heuristic, not a critical path.
  const [docs, sups, drafts, ivs] = await Promise.all([
    db.select().from(documents).where(and(
      eq((documents as any).claimId, claimId),
      eq((documents as any).companyId, companyId)
    )),
    db.select().from(supplements).where(and(
      eq((supplements as any).claimId, claimId),
      eq((supplements as any).companyId, companyId)
    )),
    db
      .select({ id: supplementDrafts.id })
      .from(supplementDrafts)
      .innerJoin(supplements, eq(supplementDrafts.supplementId, supplements.id))
      .where(eq((supplements as any).claimId, claimId))
      .catch(() => [] as any[]),
    db.select().from(interviews).where(and(
      eq((interviews as any).claimId, claimId),
      eq((interviews as any).companyId, companyId)
    )),
  ]);

  const hasPhotos = docs.some((d: any) => (d.mimeType || '').startsWith('image/'));
  const hasCarrierEstimate = sups.some((s: any) => s.approvedAmount) || docs.some((d: any) =>
    /estimate|carrier|xactimate|adjuster/i.test(d.fileName || ''));
  const hasCarrierResponse = sups.some((s: any) => !!s.responseDate || ['approved', 'denied', 'partially_approved', 'needs_revision'].includes(s.status));

  return {
    ...emptyEvidenceContext(),
    claim: true,
    customer: !!claim.customerName || !!claim.customerEmail,
    property: !!claim.propertyId,
    insurance: !!claim.insuranceCompany || !!claim.policyNumber,
    inspection: ivs.length > 0 && ivs.some((i: any) => i.status === 'completed'),
    photos: hasPhotos,
    documents: docs.length > 0,
    policy: !!claim.policyNumber || docs.some((d: any) => /policy/i.test(d.fileName || '')),
    carrierEstimate: hasCarrierEstimate,
    contractorEstimate: docs.some((d: any) => /contractor|our|own estimate/i.test(d.fileName || '')) || sups.length > 0,
    existingSupplements: sups.length > 0,
    claimPackage: false, // Claim Package is optional; never required for other tasks
    carrierResponse: hasCarrierResponse,
    interviews: ivs.length > 0,
    aiAnalysis: drafts.length > 0,
    // Evidence section lights up as evidence accumulates (documents/photos),
    // not only after an AI run produces drafts.
    evidence: docs.length > 0 || hasPhotos || drafts.length > 0,
  };
}

export const multiEntryRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /multi-entry/supplement-only — Entry Point 3.
  // Creates a claim + supplement from just: claim number, carrier, estimates,
  // photos, documents. No customer intake / claim package / full inspection.
  fastify.post('/supplement-only', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const parsed = supplementOnlySchema.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid supplement-only data', details: parsed.error.errors });
        return;
      }
      const body = parsed.data;

      // Create the claim shell (entry point: supplement_only)
      const [claim] = await db
        .insert(claims)
        .values({
          companyId,
          claimNumber: body.claimNumber,
          entryPoint: 'supplement_only',
          status: 'supplement_required',
          insuranceCompany: body.carrier || null,
          policyNumber: body.policyNumber || null,
          dateOfLoss: body.dateOfLoss ? new Date(body.dateOfLoss) : null,
          customerName: body.customerName || null,
          customerEmail: body.customerEmail || null,
          customerPhone: body.customerPhone || null,
          description: body.description || null,
          statusHistory: [{
            status: 'supplement_required',
            timestamp: new Date().toISOString(),
            userId,
            userName,
            reason: 'Entered via Supplement-Only workflow',
          }],
          createdBy: userId,
          updatedBy: userId,
        } as any)
        .returning();

      // Create the supplement draft directly (no claim package required)
      const requestedAmount = body.contractorEstimateAmount ?? body.carrierEstimateAmount ?? 0;
      const approvedAmount = body.carrierEstimateAmount ?? 0;
      const supplementNumber = `SUP-${claim.claimNumber}-1`;

      const [supplement] = await db
        .insert(supplements)
        .values({
          companyId,
          claimId: claim.id,
          supplementNumber,
          status: 'draft',
          carrier: body.carrier || null,
          requestedAmount: requestedAmount ? requestedAmount.toString() : null,
          approvedAmount: approvedAmount ? approvedAmount.toString() : null,
          lineItems: body.lineItems || [],
          internalNotes: body.internalNotes || null,
          statusHistory: [],
          revisionHistory: [],
          createdBy: userId,
          updatedBy: userId,
        } as any)
        .returning();

      // Attach photos + documents
      const attachments = [...(body.photos || []), ...(body.documents || [])];
      for (const att of attachments) {
        await db
          .insert(documents)
          .values({
            companyId,
            claimId: claim.id,
            url: att.url,
            fileName: att.fileName || att.url.split('/').pop() || 'attachment',
            mimeType: att.mimeType || null,
            createdBy: userId,
            updatedBy: userId,
          } as any);
      }

      await ActivityService.logCreate({
        companyId,
        userId,
        userName,
        entityType: 'claim',
        entityId: claim.id,
        entityName: claim.claimNumber,
        description: `Created claim ${claim.claimNumber} via Supplement-Only workflow`,
        ipAddress,
      });

      reply.code(201).send({
        claim,
        supplement,
        message: 'Claim and supplement created. Supplement-Only workflow active.',
      });
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to create supplement-only project',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /multi-entry/import — Entry Point 4.
  // Import an in-progress project: customer, property, claim, photos, docs,
  // estimates. Reconstructs the Claim Workspace automatically.
  fastify.post('/import', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const parsed = importProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid import data', details: parsed.error.errors });
        return;
      }
      const body = parsed.data;

      // Create property if provided
      let propertyId: string | null = null;
      if (body.property && (body.property.address || body.property.ownerName)) {
        const [property] = await db
          .insert(properties)
          .values({
            companyId,
            address: body.property.address || null,
            city: body.property.city || null,
            state: body.property.state || null,
            zip: body.property.zip || null,
            ownerName: body.property.ownerName || null,
            createdBy: userId,
            updatedBy: userId,
          } as any)
          .returning();
        propertyId = property.id;
      }

      // Create the claim shell (entry point: imported)
      const [claim] = await db
        .insert(claims)
        .values({
          companyId,
          claimNumber: body.claimNumber,
          entryPoint: 'imported',
          sourceSystem: body.sourceSystem || 'external',
          status: 'estimate_submitted',
          insuranceCompany: body.carrier || null,
          policyNumber: body.policyNumber || null,
          dateOfLoss: body.dateOfLoss ? new Date(body.dateOfLoss) : null,
          customerName: body.customer?.name || null,
          customerEmail: body.customer?.email || null,
          customerPhone: body.customer?.phone || null,
          description: body.description || null,
          propertyId,
          statusHistory: [{
            status: 'estimate_submitted',
            timestamp: new Date().toISOString(),
            userId,
            userName,
            reason: `Imported project${body.sourceSystem ? ` from ${body.sourceSystem}` : ''}`,
          }],
          createdBy: userId,
          updatedBy: userId,
        } as any)
        .returning();

      // Attach photos + documents
      const attachments = [...(body.photos || []), ...(body.documents || [])];
      for (const att of attachments) {
        await db
          .insert(documents)
          .values({
            companyId,
            claimId: claim.id,
            url: att.url,
            fileName: att.fileName || att.url.split('/').pop() || 'attachment',
            mimeType: att.mimeType || null,
            createdBy: userId,
            updatedBy: userId,
          } as any);
      }

      // Create supplements from imported estimates
      const supplementsCreated: any[] = [];
      for (const [idx, est] of (body.estimates || []).entries()) {
        const supplementNumber = `SUP-${claim.claimNumber}-${idx + 1}`;
        const [sup] = await db
          .insert(supplements)
          .values({
            companyId,
            claimId: claim.id,
            supplementNumber,
            status: 'draft',
            carrier: body.carrier || null,
            requestedAmount: est.contractorEstimateAmount ? est.contractorEstimateAmount.toString() : null,
            approvedAmount: est.carrierEstimateAmount ? est.carrierEstimateAmount.toString() : null,
            lineItems: est.lineItems || [],
            statusHistory: [],
            revisionHistory: [],
            createdBy: userId,
            updatedBy: userId,
          } as any)
          .returning();
        supplementsCreated.push(sup);
      }

      await ActivityService.logCreate({
        companyId,
        userId,
        userName,
        entityType: 'claim',
        entityId: claim.id,
        entityName: claim.claimNumber,
        description: `Imported claim ${claim.claimNumber}${body.sourceSystem ? ` from ${body.sourceSystem}` : ''}`,
        ipAddress,
      });

      reply.code(201).send({
        claim,
        propertyId,
        supplements: supplementsCreated,
        documentsAttached: attachments.length,
        message: 'Project imported. Claim Workspace reconstructed.',
      });
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to import project',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /multi-entry/workspace/:claimId — dynamic Claim Workspace state.
  fastify.get('/workspace/:claimId', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { claimId } = req.params as any;

      const ctx = await buildEvidenceContext(claimId, companyId);

      const [claim] = await db
        .select()
        .from(claims)
        .where(and(eq((claims as any).id, claimId), eq((claims as any).companyId, companyId)))
        .limit(1);

      if (!claim) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }

      const entryPoint = ((claim as any).entryPoint || 'new_claim') as EntryPoint;
      const workspace: WorkspaceState = getWorkspaceState(entryPoint, ctx);

      reply.send({ ...workspace, evidenceContext: ctx });
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to build claim workspace',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /multi-entry/ai-tasks/:task/check — evidence-based AI task readiness.
  // Asks "do I have enough verified evidence for THIS task?", never
  // "has the claim package been created?".
  fastify.post('/ai-tasks/:task/check', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { task } = req.params as any;
      const body = taskCheckSchema.safeParse({ task });
      if (!body.success) {
        reply.code(400).send({ error: 'Unknown AI task' });
        return;
      }
      const aTask = body.data.task;

      const { claimId } = req.body as { claimId: string };
      if (!claimId) {
        reply.code(400).send({ error: 'claimId is required' });
        return;
      }

      // Verify the claim exists and belongs to this company (404, not 500)
      const [existingClaim] = await db
        .select()
        .from(claims)
        .where(and(eq((claims as any).id, claimId), eq((claims as any).companyId, companyId)))
        .limit(1);
      if (!existingClaim) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }

      const ctx = await buildEvidenceContext(claimId, companyId);
      const readiness = evaluateTaskReadiness(aTask, ctx);

      reply.send({
        task: readiness.task,
        label: readiness.label,
        ready: readiness.ready,
        missingRequired: readiness.missingRequired,
        missingOptional: readiness.missingOptional,
        satisfied: readiness.satisfied,
        message: readiness.ready
          ? `${readiness.label} can run — required evidence present.`
          : `${readiness.label} needs: ${readiness.missingRequired.map((m) => m.label).join(', ') || 'required evidence'}.`,
      });
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to check AI task readiness',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
