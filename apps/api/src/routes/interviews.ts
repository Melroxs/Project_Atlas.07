// apps/api/src/routes/interviews.ts
import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, sql } from 'drizzle-orm';
import { interviews, claims, properties } from '@project-atlas/database';
import { db } from '@project-atlas/database';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/request';
import { 
  InterviewWorkflowService, 
  InterviewStatus 
} from '../lib/interviews-workflow';
import { FNOL_TEMPLATE } from '../lib/fnol-template';
import { ActivityService } from '../lib/activity';

const interviewSchema = z.object({
  companyId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  claimId: z.string().uuid().optional(),
  templateId: z.string().min(1),
  templateName: z.string().min(1),
  status: z.enum(['draft', 'in_progress', 'completed', 'archived']).optional(),
  currentSection: z.string().optional(),
  responses: z.record(z.any()).optional(),
  conversationHistory: z.array(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

const updateResponseSchema = z.object({
  questionId: z.string(),
  value: z.any(),
  sectionId: z.string(),
});

const statusChangeSchema = z.object({
  status: z.enum(['draft', 'in_progress', 'completed', 'archived']),
});

export const interviewsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /interviews - List interviews
  fastify.get('/', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { status, templateId, page = '1', limit = '20' } = req.query as any;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      let conditions = [eq((interviews as any).companyId, companyId)];

      if (status) {
        conditions.push(eq((interviews as any).status, status));
      }

      if (templateId) {
        conditions.push(eq((interviews as any).templateId, templateId));
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      const [data, countResult] = await Promise.all([
        db
          .select()
          .from(interviews)
          .where(whereClause)
          .orderBy(desc((interviews as any).updatedAt))
          .limit(parseInt(limit))
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(interviews)
          .where(whereClause),
      ]);

      const total = countResult[0]?.count || 0;
      const totalPages = Math.ceil(total / parseInt(limit));

      reply.send({
        data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
        },
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch interviews' });
    }
  });

  // GET /interviews/:id - Get interview details
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { id } = req.params;

      const [interview] = await db
        .select()
        .from(interviews)
        .where(and(
          eq((interviews as any).id, id),
          eq((interviews as any).companyId, companyId)
        ))
        .limit(1);

      if (!interview) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      // Calculate progress
      const template = interview.templateId === 'fnol-v1' ? FNOL_TEMPLATE : null;
      const progress = template 
        ? InterviewWorkflowService.calculateProgress(template, (interview as any).responses || {})
        : Number((interview as any).progress) || 0;

      reply.send({
        ...interview,
        progress,
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch interview' });
    }
  });

  // POST /interviews - Create interview
  fastify.post('/', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const body = interviewSchema.parse(req.body);

      const interviewNumber = InterviewWorkflowService.generateInterviewNumber();

      const [newInterview] = await db
        .insert(interviews)
        .values({
          companyId,
          propertyId: body.propertyId || null,
          claimId: body.claimId || null,
          createdBy: userId,
          updatedBy: userId,
          interviewNumber,
          templateId: body.templateId,
          templateName: body.templateName,
          status: body.status || 'draft',
          currentSection: body.currentSection || null,
          responses: body.responses || {},
          conversationHistory: body.conversationHistory || [],
        metadata: body.metadata || {},
        progress: '0',
        startedAt: new Date(),
      })
      .returning();

      // Log activity
      await ActivityService.logCreate({
        companyId,
        userId,
        userName,
        entityType: 'interview',
        entityId: newInterview.id,
        entityName: interviewNumber,
        description: `Created interview ${interviewNumber}`,
        ipAddress,
      });

      reply.send(newInterview);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to create interview' });
    }
  });

  // PUT /interviews/:id - Update interview
  fastify.put<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const { id } = req.params;
      const body = interviewSchema.partial().parse(req.body);

      const existing = await db
        .select()
        .from(interviews)
        .where(and(
          eq((interviews as any).id, id),
          eq((interviews as any).companyId, companyId)
        ))
        .limit(1);

      if (existing.length === 0) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      const [updated] = await db
        .update(interviews)
        .set({
          ...body,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq((interviews as any).id, id))
        .returning();

      // Log activity
      await ActivityService.logUpdate({
        companyId,
        userId,
        userName,
        entityType: 'interview',
        entityId: id,
        entityName: (existing as any).interviewNumber,
        description: `Updated interview ${(existing as any).interviewNumber}`,
        previousValues: existing,
        newValues: updated,
        ipAddress,
      });

      reply.send(updated);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to update interview' });
    }
  });

  // DELETE /interviews/:id - Delete interview
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const { id } = req.params;

      const existing = await db
        .select()
        .from(interviews)
        .where(and(
          eq((interviews as any).id, id),
          eq((interviews as any).companyId, companyId)
        ))
        .limit(1);

      if (existing.length === 0) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      await db.delete(interviews).where(eq((interviews as any).id, id));

      // Log activity
      await ActivityService.logDelete({
        companyId,
        userId,
        userName,
        entityType: 'interview',
        entityId: id,
        entityName: (existing as any).interviewNumber,
        description: `Deleted interview ${(existing as any).interviewNumber}`,
        ipAddress,
      });

      reply.send({ success: true });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete interview' });
    }
  });

  // PUT /interviews/:id/responses - Update interview responses (autosave)
  fastify.put<{ Params: { id: string } }>('/:id/responses', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { id } = req.params;
      const { questionId, value, sectionId } = updateResponseSchema.parse(req.body);

      const existing = await db
        .select()
        .from(interviews)
        .where(and(
          eq((interviews as any).id, id),
          eq((interviews as any).companyId, companyId)
        ))
        .limit(1);

      if (existing.length === 0) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      const interview = existing[0];
      const responses = (interview as any).responses || {};
      responses[questionId] = value;

      // Calculate progress
      const template = (interview as any).templateId === 'fnol-v1' ? FNOL_TEMPLATE : null;
      const progress = template 
        ? InterviewWorkflowService.calculateProgress(template, responses)
        : 0;

      const [updated] = await db
        .update(interviews)
        .set({
          responses,
          currentSection: sectionId,
          progress: progress.toString(),
          updatedAt: new Date(),
        })
      .where(eq((interviews as any).id, id))
      .returning();

      reply.send(updated);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to update interview responses' });
    }
  });

  // PUT /interviews/:id/status - Change interview status
  fastify.put<{ Params: { id: string } }>('/:id/status', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const { id } = req.params;
      const { status } = statusChangeSchema.parse(req.body);

      const existing = await db
        .select()
        .from(interviews)
        .where(and(
          eq((interviews as any).id, id),
          eq((interviews as any).companyId, companyId)
        ))
        .limit(1);

      if (existing.length === 0) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      const updates: any = {
        status,
        updatedBy: userId,
        updatedAt: new Date(),
      };

      if (status === 'in_progress' && !(existing as any).startedAt) {
        updates.startedAt = new Date();
      }

      if (status === 'completed' && !(existing as any).completedAt) {
        updates.completedAt = new Date();
      }

      if (status === 'archived' && !(existing as any).archivedAt) {
        updates.archivedAt = new Date();
      }

      const [updated] = await db
        .update(interviews)
        .set(updates)
        .where(eq((interviews as any).id, id))
        .returning();

      // Log activity
      await ActivityService.logStatusChange({
        companyId,
        userId,
        userName,
        entityType: 'interview',
        entityId: id,
        entityName: (existing as any).interviewNumber,
        description: `Changed interview status to ${status}`,
        previousValues: { status: (existing as any).status },
        newValues: { status },
        ipAddress,
      });

      reply.send(updated);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to change interview status' });
    }
  });

  // GET /interviews/:id/template - Get interview template
  fastify.get<{ Params: { id: string } }>('/:id/template', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { id } = req.params;

      const [interview] = await db
        .select()
        .from(interviews)
        .where(and(
          eq((interviews as any).id, id),
          eq((interviews as any).companyId, companyId)
        ))
        .limit(1);

      if (!interview) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      const template = (interview as any).templateId === 'fnol-v1' ? FNOL_TEMPLATE : null;

      if (!template) {
        reply.code(404).send({ error: 'Template not found' });
        return;
      }

      reply.send(template);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to get interview template' });
    }
  });

  // GET /interviews/:id/progress - Get interview progress
  fastify.get<{ Params: { id: string } }>('/:id/progress', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { id } = req.params;

      const [interview] = await db
        .select()
        .from(interviews)
        .where(and(
          eq((interviews as any).id, id),
          eq((interviews as any).companyId, companyId)
        ))
        .limit(1);

      if (!interview) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      const template = (interview as any).templateId === 'fnol-v1' ? FNOL_TEMPLATE : null;
      const responses = (interview as any).responses || {};

      if (!template) {
        reply.code(404).send({ error: 'Template not found' });
        return;
      }

      const progress = InterviewWorkflowService.calculateProgress(template, responses);
      const isComplete = InterviewWorkflowService.isInterviewComplete(template, responses);
      const missingFields = InterviewWorkflowService.getMissingRequiredFields(template, responses);

      reply.send({
        progress,
        isComplete,
        missingFields,
        currentSection: (interview as any).currentSection,
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to get interview progress' });
    }
  });

  // GET /interviews/templates/fnol - Get FNOL template
  fastify.get('/templates/fnol', async (req, reply) => {
    try {
      reply.send(FNOL_TEMPLATE);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to get FNOL template' });
    }
  });

  // POST /interviews/:id/generate-claim - Generate claim from completed interview
  fastify.post<{ Params: { id: string } }>('/:id/generate-claim', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const { id } = req.params;

      const [interview] = await db
        .select()
        .from(interviews)
        .where(and(
          eq((interviews as any).id, id),
          eq((interviews as any).companyId, companyId)
        ))
        .limit(1);

      if (!interview) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      if ((interview as any).status !== 'completed') {
        reply.code(400).send({ error: 'Interview must be completed before generating claim' });
        return;
      }

      const template = (interview as any).templateId === 'fnol-v1' ? FNOL_TEMPLATE : null;
      if (!template) {
        reply.code(400).send({ error: 'Template not found' });
        return;
      }

      const responses = (interview as any).responses || {};
      const claimData = InterviewWorkflowService.extractClaimData(responses, template);
      const customer = (claimData.customer || {}) as Record<string, any>;
      const property = (claimData.property || {}) as Record<string, any>;
      const claimFields = (claimData.claim || {}) as Record<string, any>;

      // Idempotent: if a claim was already generated from this interview, return it.
      if ((interview as any).generatedClaimId) {
        const [existingClaim] = await db
          .select()
          .from(claims)
          .where(eq((claims as any).id, (interview as any).generatedClaimId))
          .limit(1);
        if (existingClaim) {
          reply.send({ claim: existingClaim, alreadyGenerated: true });
          return;
        }
      }

      // 1. Create the property from the interview when one wasn't linked already.
      let propertyId = (interview as any).propertyId ?? null;
      const propertyAddress = property.address ? String(property.address).trim() : '';
      if (!propertyId && propertyAddress) {
        const [newProperty] = await db
          .insert(properties)
          .values({
            companyId,
            address: propertyAddress,
            ownerName: customer.name ? String(customer.name) : null,
            createdBy: userId,
          })
          .returning();
        propertyId = newProperty.id;
      }

      // 2. Build the claim from the extracted interview responses.
      const claimNumber = `CLM-${new Date().getFullYear()}${Date.now().toString().slice(-6)}`;
      const descriptionParts = [
        claimFields.cause ? `Cause of loss: ${String(claimFields.cause)}` : null,
        claimFields.description ? String(claimFields.description) : null,
      ].filter((p): p is string => Boolean(p));

      const [newClaim] = await db
        .insert(claims)
        .values({
          companyId,
          claimNumber,
          entryPoint: 'new_claim',
          sourceSystem: 'fnol-interview',
          status: 'new',
          propertyId,
          dateOfLoss: claimFields.date ? new Date(String(claimFields.date)) : new Date(),
          dateReported: new Date(),
          insuranceCompany: claimFields.insurance ? String(claimFields.insurance) : null,
          policyNumber: claimFields.policy ? String(claimFields.policy) : null,
          deductible: claimFields.deductible
            ? String(claimFields.deductible).replace(/[^0-9.]/g, '')
            : null,
          description:
            descriptionParts.join('. ') || 'Claim generated from FNOL interview.',
          customerName: customer.name ? String(customer.name) : null,
          customerEmail: customer.email ? String(customer.email) : null,
          customerPhone: customer.phone ? String(customer.phone) : null,
          statusHistory: [
            {
              status: 'new',
              timestamp: new Date().toISOString(),
              userId,
              reason: 'Generated from FNOL interview',
            },
          ],
          createdBy: userId,
        })
        .returning();

      // 3. Link the generated claim back to the interview.
      await db
        .update(interviews)
        .set({
          claimId: newClaim.id,
          generatedClaimId: newClaim.id,
          updatedAt: new Date(),
        })
        .where(eq((interviews as any).id, id));

      reply.send({
        claim: newClaim,
        claimData,
        message: 'Claim generated from interview',
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to generate claim from interview' });
    }
  });
};
