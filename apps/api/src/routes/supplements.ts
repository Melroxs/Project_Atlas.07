// apps/api/src/routes/supplements.ts
import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, sql, like, or } from 'drizzle-orm';
import { db, supplements, claims, adjusters } from '@project-atlas/database';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/request';
import { 
  SupplementsWorkflowService, 
  STATUS_LABELS, 
  STATUS_COLORS,
  SupplementStatus 
} from '../lib/supplements-workflow';
import { ActivityService } from '../lib/activity';

const supplementSchema = z.object({
  companyId: z.string().uuid(),
  claimId: z.string().uuid(),
  adjusterId: z.string().uuid().optional(),
  supplementNumber: z.string().min(1).max(64),
  version: z.number().optional(),
  status: z.enum(['draft', 'ready_for_review', 'submitted', 'waiting_for_carrier', 'needs_revision', 'partially_approved', 'approved', 'denied', 'closed']).optional(),
  carrier: z.string().max(255).optional(),
  requestedAmount: z.number().optional(),
  approvedAmount: z.number().optional(),
  difference: z.number().optional(),
  lineItems: z.array(z.object({
    id: z.string().optional(),
    description: z.string(),
    category: z.string(),
    quantity: z.number(),
    unit: z.string(),
    unitPrice: z.number(),
    total: z.number(),
    depreciation: z.number(),
    tax: z.number(),
    notes: z.string().optional(),
  })).optional(),
  internalNotes: z.string().optional(),
  submissionDate: z.string().optional(),
  responseDate: z.string().optional(),
  approvalDate: z.string().optional(),
  denialReason: z.string().optional(),
});

const statusChangeSchema = z.object({
  status: z.enum(['draft', 'ready_for_review', 'submitted', 'waiting_for_carrier', 'needs_revision', 'partially_approved', 'approved', 'denied', 'closed']),
  reason: z.string().optional(),
});

export const supplementsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /supplements - List with filters, search, pagination
  fastify.get('/', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { status, adjusterId, carrier, search, page = '1', limit = '20' } = req.query as any;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      let conditions = [eq(supplements.companyId, companyId)];

      if (status) {
        conditions.push(eq(supplements.status, status));
      }

      if (adjusterId) {
        conditions.push(eq(supplements.adjusterId, adjusterId));
      }

      if (carrier) {
        conditions.push(like(supplements.carrier, `%${carrier}%`));
      }

      if (search) {
        conditions.push(
          or(
            like(supplements.supplementNumber, `%${search}%`),
            like(supplements.carrier, `%${search}%`)
          )!
        );
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      const [data, countResult] = await Promise.all([
        db
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
          .limit(parseInt(limit))
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(supplements)
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
      reply.code(500).send({ error: 'Failed to fetch supplements' });
    }
  });

  // GET /supplements/:id - Get supplement details
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { id } = req.params;

      const result = await db
        .select()
        .from(supplements)
        .where(and(eq(supplements.id, id), eq(supplements.companyId, companyId)))
        .limit(1);

      if (result.length === 0) {
        reply.code(404).send({ error: 'Supplement not found' });
        return;
      }

      const supplement = result[0];
      const financialSummary = SupplementsWorkflowService.calculateFinancialSummary(supplement);

      reply.send({
        ...supplement,
        financialSummary,
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch supplement' });
    }
  });

  // POST /supplements - Create supplement
  fastify.post('/', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const body = supplementSchema.parse(req.body);

      // Calculate totals from line items if provided
      let requestedAmount = body.requestedAmount;
      if (body.lineItems && body.lineItems.length > 0) {
        const totals = SupplementsWorkflowService.calculateSupplementTotals(body.lineItems);
        requestedAmount = totals.requestedAmount;
      }

      const [newSupplement] = await db
        .insert(supplements)
        .values({
          companyId,
          claimId: body.claimId,
          adjusterId: body.adjusterId || null,
          supplementNumber: body.supplementNumber,
          version: (body.version || 1).toString(),
          status: body.status || 'draft',
          carrier: body.carrier || null,
          requestedAmount: requestedAmount?.toString(),
          approvedAmount: body.approvedAmount?.toString() || null,
          difference: body.difference?.toString() || null,
          lineItems: body.lineItems || [],
          internalNotes: body.internalNotes || null,
          submissionDate: body.submissionDate ? new Date(body.submissionDate) : null,
          responseDate: body.responseDate ? new Date(body.responseDate) : null,
          approvalDate: body.approvalDate ? new Date(body.approvalDate) : null,
          denialReason: body.denialReason || null,
          statusHistory: [],
          revisionHistory: [],
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // Log activity
      await ActivityService.logCreate({
        companyId,
        userId,
        userName,
        entityType: 'supplement',
        entityId: newSupplement.id,
        entityName: newSupplement.supplementNumber,
        description: `Created supplement ${newSupplement.supplementNumber}`,
        ipAddress,
      });

      reply.send(newSupplement);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to create supplement' });
    }
  });

  // PUT /supplements/:id - Update supplement
  fastify.put<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const { id } = req.params;
      const body = supplementSchema.partial().parse(req.body);

      const existing = await db
        .select()
        .from(supplements)
        .where(and(eq(supplements.id, id), eq(supplements.companyId, companyId)))
        .limit(1);

      if (existing.length === 0) {
        reply.code(404).send({ error: 'Supplement not found' });
        return;
      }

      const supplement = existing[0];

      // Calculate totals from line items if provided
      let requestedAmount = body.requestedAmount;
      if (body.lineItems && body.lineItems.length > 0) {
        const totals = SupplementsWorkflowService.calculateSupplementTotals(body.lineItems);
        requestedAmount = totals.requestedAmount;
      }

      // Calculate difference if both amounts are provided
      let difference = body.difference;
      if (requestedAmount && body.approvedAmount) {
        difference = SupplementsWorkflowService.calculateDifference(requestedAmount, body.approvedAmount);
      }

      // Increment version if line items changed
      let version = Number(supplement.version) || 1;
      if (body.lineItems) {
        version = version + 1;
      }

      const [updated] = await db
        .update(supplements)
        .set({
          ...body,
          requestedAmount: requestedAmount?.toString(),
          approvedAmount: body.approvedAmount?.toString(),
          difference: difference?.toString(),
          version: version.toString(),
          submissionDate: body.submissionDate ? new Date(body.submissionDate) : undefined,
          responseDate: body.responseDate ? new Date(body.responseDate) : undefined,
          approvalDate: body.approvalDate ? new Date(body.approvalDate) : undefined,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(supplements.id, id))
        .returning();

      // Add revision history if version changed
      if (version > Number(supplement.version)) {
        const revisionHistory = SupplementsWorkflowService.addRevisionHistoryEntry(
          (supplement.revisionHistory as any) || [],
          version,
          userId,
          userName,
          'Updated line items'
        );
        await db
          .update(supplements)
          .set({ revisionHistory })
          .where(eq(supplements.id, id));
      }

      // Log activity
      await ActivityService.logUpdate({
        companyId,
        userId,
        userName,
        entityType: 'supplement',
        entityId: id,
        entityName: supplement.supplementNumber,
        description: `Updated supplement ${supplement.supplementNumber}`,
        previousValues: supplement,
        newValues: updated,
        ipAddress,
      });

      reply.send(updated);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to update supplement' });
    }
  });

  // DELETE /supplements/:id - Delete supplement
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const { id } = req.params;

      const existing = await db
        .select()
        .from(supplements)
        .where(and(eq(supplements.id, id), eq(supplements.companyId, companyId)))
        .limit(1);

      if (existing.length === 0) {
        reply.code(404).send({ error: 'Supplement not found' });
        return;
      }

      const supplement = existing[0];

      await db.delete(supplements).where(eq(supplements.id, id));

      // Log activity
      await ActivityService.logDelete({
        companyId,
        userId,
        userName,
        entityType: 'supplement',
        entityId: id,
        entityName: supplement.supplementNumber,
        description: `Deleted supplement ${supplement.supplementNumber}`,
        ipAddress,
      });

      reply.send({ success: true });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete supplement' });
    }
  });

  // PUT /supplements/:id/status - Change status
  fastify.put<{ Params: { id: string } }>('/:id/status', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userName = (req as AuthenticatedRequest).userName;
      const ipAddress = (req as AuthenticatedRequest).ipAddress;
      const { id } = req.params;
      const { status, reason } = statusChangeSchema.parse(req.body);

      const existing = await db
        .select()
        .from(supplements)
        .where(and(eq(supplements.id, id), eq(supplements.companyId, companyId)))
        .limit(1);

      if (existing.length === 0) {
        reply.code(404).send({ error: 'Supplement not found' });
        return;
      }

      const supplement = existing[0];
      const currentStatus = supplement.status as SupplementStatus;

      // Validate transition
      const transition = SupplementsWorkflowService.validateTransition(currentStatus, status);
      if (!transition.allowed) {
        reply.code(400).send({ error: transition.reason });
        return;
      }

      // Add status history entry
      const statusHistory = SupplementsWorkflowService.addStatusHistoryEntry(
        (supplement.statusHistory as any) || [],
        status,
        userId,
        userName,
        reason
      );

      // Update dates based on status
      const updates: any = {
        status,
        statusHistory,
        updatedBy: userId,
        updatedAt: new Date(),
      };

      if (status === 'submitted' && !supplement.submissionDate) {
        updates.submissionDate = new Date();
      }

      if (status === 'waiting_for_carrier' && !supplement.responseDate) {
        updates.responseDate = new Date();
      }

      if (status === 'approved' && !supplement.approvalDate) {
        updates.approvalDate = new Date();
      }

      if (status === 'denied') {
        updates.denialReason = reason || null;
      }

      const [updated] = await db
        .update(supplements)
        .set(updates)
        .where(eq(supplements.id, id))
        .returning();

      // Log activity
      await ActivityService.logStatusChange({
        companyId,
        userId,
        userName,
        entityType: 'supplement',
        entityId: id,
        entityName: supplement.supplementNumber,
        description: `Changed supplement status from ${STATUS_LABELS[currentStatus]} to ${STATUS_LABELS[status]}`,
        previousValues: { status: currentStatus },
        newValues: { status, reason },
        ipAddress,
      });

      reply.send(updated);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to change supplement status' });
    }
  });

  // GET /supplements/:id/transitions - Get available status transitions
  fastify.get<{ Params: { id: string } }>('/:id/transitions', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { id } = req.params;

      const result = await db
        .select()
        .from(supplements)
        .where(and(eq(supplements.id, id), eq(supplements.companyId, companyId)))
        .limit(1);

      if (result.length === 0) {
        reply.code(404).send({ error: 'Supplement not found' });
        return;
      }

      const supplement = result[0];
      const currentStatus = supplement.status as SupplementStatus;
      const nextStatuses = SupplementsWorkflowService.getNextStatuses(currentStatus);

      reply.send({
        currentStatus,
        currentStatusLabel: STATUS_LABELS[currentStatus],
        nextStatuses: nextStatuses.map((status) => ({
          value: status,
          label: STATUS_LABELS[status],
          color: STATUS_COLORS[status],
        })),
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to get supplement transitions' });
    }
  });

  // GET /supplements/dashboard/stats - Get dashboard statistics
  fastify.get('/dashboard/stats', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;

      const allSupplements = await db
        .select()
        .from(supplements)
        .where(eq(supplements.companyId, companyId));

      const stats = SupplementsWorkflowService.getDashboardStats(allSupplements);

      reply.send(stats);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to get dashboard stats' });
    }
  });
};
