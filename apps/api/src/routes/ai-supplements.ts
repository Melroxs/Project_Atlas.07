// apps/api/src/routes/ai-supplements.ts
import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@project-atlas/database';
import { supplements, supplementDrafts, claims, properties, interviews, documents, activityLogs } from '@project-atlas/database';
import { z } from 'zod';
import { 
  AIProvider,
  SupplementGenerationContext, 
  SupplementRecommendations 
} from '../lib/ai-supplement/types';
import { SupplementPromptBuilder as PB } from '../lib/ai-supplement/prompt-builder';
import { UnifiedAIProvider, isAIConfigured, getActiveProvider, getActiveModel } from '@project-atlas/ai';
import { SupplementResultParser as RP } from '../lib/ai-supplement/result-parser';
import { SupplementValidationService as VS } from '../lib/ai-supplement/validation';
import { SupplementRecommendationEngine as RE } from '../lib/ai-supplement/engine';
import { ActivityService } from '../lib/activity';
import { AuthenticatedRequest } from '../types/request';

const generateSupplementSchema = z.object({
  supplementId: z.string().uuid(),
});

const approveDraftSchema = z.object({
  draftId: z.string().uuid(),
  modifications: z.object({
    modifiedLineItems: z.array(z.object({
      id: z.string(),
      originalDescription: z.string(),
      modifiedDescription: z.string(),
      originalQuantity: z.number(),
      modifiedQuantity: z.number(),
      originalUnitPrice: z.number(),
      modifiedUnitPrice: z.number(),
      reason: z.string(),
    })).optional(),
    addedLineItems: z.array(z.any()).optional(),
    removedLineItems: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }).optional(),
});

const rejectDraftSchema = z.object({
  draftId: z.string().uuid(),
  reason: z.string(),
});

export const aiSupplementsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /ai-supplements/generate - Generate AI supplement recommendations
  fastify.post('/generate', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const body = generateSupplementSchema.parse(req.body);

      // Get supplement details
      const [supplement] = await db
        .select()
        .from(supplements)
        .where(and(
          eq((supplements as any).id, body.supplementId),
          eq((supplements as any).companyId, companyId)
        ))
        .limit(1);

      if (!supplement) {
        reply.code(404).send({ error: 'Supplement not found' });
        return;
      }

      // Get claim details
      const [claim] = await db
        .select()
        .from(claims)
        .where(eq((claims as any).id, (supplement as any).claimId))
        .limit(1);

      if (!claim) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }

      // Get property details
      const [property] = await db
        .select()
        .from(properties)
        .where(eq((properties as any).id, (claim as any).propertyId))
        .limit(1);

      // Get customer details (from claim)
      const customer = {
        id: (claim as any).customerId || '',
        name: (claim as any).customerName || '',
        phone: (claim as any).customerPhone || '',
        email: (claim as any).customerEmail || '',
        address: (claim as any).customerAddress || '',
      };

      // Get interview responses
      const interviewResponses = await db
        .select()
        .from(interviews)
        .where(and(
          eq((interviews as any).claimId, claim.id),
          eq((interviews as any).companyId, companyId),
          eq((interviews as any).status, 'completed')
        ))
        .orderBy(desc((interviews as any).completedAt))
        .limit(1);

      // Get documents
      const docs = await db
        .select()
        .from(documents)
        .where(and(
          eq((documents as any).claimId, claim.id),
          eq((documents as any).companyId, companyId)
        ));

      // Get existing supplements for this claim (context for the AI engine)
      const existingSupplements = await db
        .select()
        .from(supplements)
        .where(and(
          eq((supplements as any).claimId, claim.id),
          eq((supplements as any).companyId, companyId)
        ))
        .limit(20);

      // Get activities
      const activityTimeline = await db
        .select()
        .from(activityLogs)
        .where(eq((activityLogs as any).claimId, claim.id))
        .orderBy(desc((activityLogs as any).createdAt))
        .limit(20);

      // Build context
      const context: SupplementGenerationContext = {
        claim: {
          id: claim.id,
          claimNumber: (claim as any).claimNumber,
          insuranceCompany: (claim as any).insuranceCompany,
          policyNumber: (claim as any).policyNumber,
          dateOfLoss: (claim as any).dateOfLoss,
          causeOfLoss: (claim as any).causeOfLoss,
          description: (claim as any).description,
          status: (claim as any).status,
          deductible: (claim as any).deductible ? Number((claim as any).deductible) : undefined,
          totalApproved: (claim as any).totalApproved ? Number((claim as any).totalApproved) : undefined,
          totalRequested: (claim as any).totalRequested ? Number((claim as any).totalRequested) : undefined,
        },
        property: property ? {
          id: property.id,
          address: (property as any).address,
          type: (property as any).type,
        yearBuilt: (property as any).yearBuilt ? Number((property as any).yearBuilt) : undefined,
        squareFootage: (property as any).squareFootage ? Number((property as any).squareFootage) : undefined,
        occupancy: (property as any).occupancy,
      } : { id: '', address: '', type: '' },
      customer: customer ? {
        id: customer.id,
        name: (customer as any).name,
        phone: (customer as any).phone,
        email: (customer as any).email,
        address: (customer as any).address,
      } : { id: '', name: '', phone: '', email: '' },
      interviewResponses: interviewResponses.length > 0 ? {
        interviewId: interviewResponses[0].id,
        interviewNumber: (interviewResponses[0] as any).interviewNumber,
        templateName: (interviewResponses[0] as any).templateName,
        responses: (interviewResponses[0] as any).responses || {},
        completedAt: (interviewResponses[0] as any).completedAt || interviewResponses[0].createdAt,
      } : { interviewId: '', interviewNumber: '', templateName: '', responses: {}, completedAt: '' },
      adjuster: (claim as any).adjusterId ? {
        id: (claim as any).adjusterId,
        name: (claim as any).adjusterName || '',
        phone: (claim as any).adjusterPhone || '',
        email: (claim as any).adjusterEmail || '',
        company: (claim as any).adjusterCompany || '',
      } : undefined,
      documents: docs.map(doc => ({
        id: doc.id,
        type: (doc as any).type,
        name: (doc as any).name,
        uploadedAt: (doc as any).uploadedAt,
        url: (doc as any).url,
      })),
      // Photos are documents with image MIME types / extensions (no separate photos table).
      photos: docs
        .filter(doc => {
          const mime = String((doc as any).mimeType || '').toLowerCase();
          const name = String((doc as any).fileName || (doc as any).name || '').toLowerCase();
          return mime.startsWith('image/') || /\.(jpg|jpeg|png|heic|webp|gif)$/.test(name);
        })
        .map(doc => ({
          id: doc.id,
          type: 'photo',
          name: (doc as any).fileName || (doc as any).name,
          uploadedAt: (doc as any).uploadedAt,
          url: (doc as any).url,
        })),
      existingSupplements: existingSupplements.map(sup => ({
        id: sup.id,
        supplementNumber: (sup as any).supplementNumber,
        status: (sup as any).status,
        requestedAmount: Number((sup as any).requestedAmount) || 0,
        approvedAmount: Number((sup as any).approvedAmount) || 0,
        lineItems: ((sup as any).lineItems as any[]) ?? [],
        createdAt: (sup as any).createdAt || new Date().toISOString(),
        submittedAt: (sup as any).submissionDate || undefined,
        responseDate: (sup as any).responseDate || undefined,
      })),
      activityTimeline: activityTimeline.map(act => ({
        id: act.id,
        type: (act as any).type,
        description: (act as any).description,
        createdAt: (act as any).createdAt,
        userId: (act as any).userId,
        userName: (act as any).userName,
      })),
    };

    // Initialize AI components (free AI layer: Gemini primary, Groq fallback)
    if (!isAIConfigured()) {
      reply.code(500).send({ error: 'AI provider not configured. Set GOOGLE_API_KEY and/or GROQ_API_KEY.' });
      return;
    }

    const promptBuilder = new PB();
    const aiProvider = new UnifiedAIProvider();
    const resultParser = new RP();
    const validationService = new VS();
    const engine = new RE(
      promptBuilder,
      aiProvider,
      resultParser,
      validationService
    );

    // Generate recommendations
    const recommendations = await engine.generateRecommendations(context);

    // Calculate estimated revenue
    const estimatedRevenue = recommendations.recommendedLineItems.reduce(
      (sum: number, item: any) => sum + item.suggestedTotalPrice,
      0
    );

    // Get next version number
    const [maxVersion] = await db
      .select({ max: sql<number>`MAX(version)` })
      .from(supplementDrafts)
      .where(eq((supplementDrafts as any).supplementId, body.supplementId));
    
    const nextVersion = (maxVersion?.max || 0) + 1;

    // Save draft
    const [draft] = await db
      .insert(supplementDrafts)
      .values({
        supplementId: body.supplementId,
        version: nextVersion.toString(),
        status: 'draft',
        generatedAt: new Date(),
        recommendations: recommendations as any,
        // Records the intended provider (pre-fallback); actual serving provider
        // and fallback events are captured by the AI layer logger at runtime.
        aiProvider: getActiveProvider() === 'groq' ? 'Groq' : 'Gemini',
        aiModel: getActiveModel(),
        confidenceScore: recommendations.confidenceScore.toString(),
        riskScore: recommendations.riskScore.toString(),
        estimatedRevenue: estimatedRevenue.toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Log activity
    await ActivityService.logCreate({
      companyId,
      userId,
      userName,
      entityType: 'supplement_draft',
      entityId: draft.id,
      entityName: `Draft v${nextVersion}`,
      description: `Generated AI supplement draft v${nextVersion} for supplement ${(supplement as any).supplementNumber}`,
      ipAddress,
    });

    reply.send({
      draft,
      recommendations,
    });
    } catch (error) {
      reply.code(500).send({ 
        error: 'Failed to generate supplement recommendations',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // PUT /ai-supplements/approve - Approve a supplement draft
  fastify.put('/approve', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const body = approveDraftSchema.parse(req.body);

      const [draft] = await db
        .select()
        .from(supplementDrafts)
        .where(eq((supplementDrafts as any).id, body.draftId))
        .limit(1);

      if (!draft) {
        reply.code(404).send({ error: 'Draft not found' });
        return;
      }

      // Update draft status
      const [updatedDraft] = await db
      .update(supplementDrafts)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: userId,
        userModifications: body.modifications as any,
        updatedAt: new Date(),
      })
      .where(eq((supplementDrafts as any).id, body.draftId))
      .returning();

    // Apply the approved recommendations to the supplement record (line items +
    // requested amount), honoring any user modifications. Approval itself is
    // already recorded above; a failure here must not 500 a successful approval.
    try {
      const recommendations = (draft as any).recommendations as SupplementRecommendations | undefined;
      let lineItems: any[] = [...(recommendations?.recommendedLineItems ?? [])];
      const mods = body.modifications;
      if (mods) {
        if (mods.removedLineItems?.length) {
          const removed = new Set(mods.removedLineItems);
          lineItems = lineItems.filter((item) => !removed.has(item.id));
        }
        if (mods.modifiedLineItems?.length) {
          lineItems = lineItems.map((item) => {
            const mod = mods!.modifiedLineItems!.find((m) => m.id === item.id);
            return mod ? { ...item, ...mod } : item;
          });
        }
        if (mods.addedLineItems?.length) {
          lineItems = [...lineItems, ...mods.addedLineItems];
        }
      }
      const approvedTotal = lineItems.reduce(
        (sum: number, item: any) => sum + (Number(item.suggestedTotalPrice ?? item.total ?? 0) || 0),
        0
      );
      await db
        .update(supplements)
        .set({
          lineItems: lineItems as any,
          requestedAmount: approvedTotal > 0 ? approvedTotal.toString() : undefined,
          approvalDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq((supplements as any).id, (draft as any).supplementId));
    } catch (applyError) {
      fastify.log?.warn?.(`Failed to apply approved recommendations: ${applyError instanceof Error ? applyError.message : String(applyError)}`);
    }

    // Log activity
    await ActivityService.logUpdate({
      companyId,
      userId,
      userName,
      entityType: 'supplement_draft',
      entityId: body.draftId,
      entityName: `Draft v${(draft as any).version}`,
      description: `Approved supplement draft v${(draft as any).version}`,
      previousValues: { status: (draft as any).status },
      newValues: { status: 'approved' },
      ipAddress,
    });

    reply.send(updatedDraft);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to approve supplement draft' });
    }
  });

  // PUT /ai-supplements/reject - Reject a supplement draft
  fastify.put('/reject', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const body = rejectDraftSchema.parse(req.body);

    const [draft] = await db
      .select()
      .from(supplementDrafts)
      .where(eq((supplementDrafts as any).id, body.draftId))
      .limit(1);

    if (!draft) {
      reply.code(404).send({ error: 'Draft not found' });
      return;
    }

    // Update draft status
    const [updatedDraft] = await db
      .update(supplementDrafts)
      .set({
        status: 'rejected',
        reviewedAt: new Date(),
        rejectedAt: new Date(),
        rejectedBy: userId,
        userModifications: { notes: body.reason } as any,
        updatedAt: new Date(),
      })
      .where(eq((supplementDrafts as any).id, body.draftId))
      .returning();

    // Log activity
    await ActivityService.logUpdate({
      companyId,
      userId,
      userName,
      entityType: 'supplement_draft',
      entityId: body.draftId,
      entityName: `Draft v${(draft as any).version}`,
      description: `Rejected supplement draft v${(draft as any).version}: ${body.reason}`,
      previousValues: { status: (draft as any).status },
      newValues: { status: 'rejected' },
      ipAddress,
    });

    reply.send(updatedDraft);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to reject supplement draft' });
    }
  });

  // GET /ai-supplements/:supplementId/drafts - Get all drafts for a supplement
  fastify.get('/:supplementId/drafts', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { supplementId } = req.params as any;

    // Verify supplement belongs to company
    const [supplement] = await db
      .select()
      .from(supplements)
      .where(and(
        eq((supplements as any).id, supplementId),
        eq((supplements as any).companyId, companyId)
      ))
      .limit(1);

    if (!supplement) {
      reply.code(404).send({ error: 'Supplement not found' });
      return;
    }

    const drafts = await db
      .select()
      .from(supplementDrafts)
      .where(eq((supplementDrafts as any).supplementId, supplementId))
      .orderBy(desc((supplementDrafts as any).version));

    reply.send({ drafts });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch supplement drafts' });
    }
  });

  // GET /ai-supplements/drafts/:draftId - Get a specific draft
  fastify.get('/drafts/:draftId', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { draftId } = req.params as any;

      const [draft] = await db
        .select()
        .from(supplementDrafts)
        .where(eq((supplementDrafts as any).id, draftId))
        .limit(1);

    if (!draft) {
      reply.code(404).send({ error: 'Draft not found' });
      return;
    }

    // Verify company access
    const [supplement] = await db
      .select()
      .from(supplements)
      .where(and(
        eq((supplements as any).id, (draft as any).supplementId),
        eq((supplements as any).companyId, companyId)
      ))
      .limit(1);

    if (!supplement) {
      reply.code(403).send({ error: 'Access denied' });
      return;
    }

    reply.send(draft);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch draft' });
    }
  });

  // POST /ai-supplements/drafts/compare - Compare two draft versions
  fastify.post('/drafts/compare', async (req, reply) => {
    try {
      const { draftId1, draftId2 } = req.body as { draftId1: string; draftId2: string };

      const [draft1] = await db
        .select()
        .from(supplementDrafts)
        .where(eq((supplementDrafts as any).id, draftId1))
      .limit(1);

    const [draft2] = await db
      .select()
      .from(supplementDrafts)
      .where(eq((supplementDrafts as any).id, draftId2))
      .limit(1);

    if (!draft1 || !draft2) {
      reply.code(404).send({ error: 'One or both drafts not found' });
      return;
    }

    const resultParser = new RP();
    const validationService = new VS();
    const engine = new RE(
      new PB(),
      new UnifiedAIProvider(),
      resultParser,
      validationService
    );

    const recommendations1 = (draft1 as any).recommendations as SupplementRecommendations;
    const recommendations2 = (draft2 as any).recommendations as SupplementRecommendations;

    const comparison = engine.compareVersions(recommendations1, recommendations2);

    reply.send(comparison);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to compare drafts' });
    }
  });
};
