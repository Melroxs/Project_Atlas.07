// apps/api/src/routes/claims.ts
import { FastifyPluginAsync } from 'fastify';
import { registerCrudRoutes } from './crud';
import { claims, supplements } from '@project-atlas/database';
import { z } from 'zod';
import { db } from '@project-atlas/database';
import { eq, and, like, or, desc } from 'drizzle-orm';
import { ActivityService } from '../lib/activity';
import { ClaimsWorkflowService, ClaimStatus, STATUS_LABELS } from '../lib/claims-workflow';
import { AuthenticatedRequest } from '../types/request';

// Claim schema for validation
const claimSchema = z.object({
  claimNumber: z.string().min(1).max(64),
  status: z.string().default('new'),
  dateOfLoss: z.string().optional(),
  dateReported: z.string().optional(),
  insuranceCompany: z.string().max(255).optional(),
  policyNumber: z.string().max(100).optional(),
  deductible: z.number().optional(),
  estimatedValue: z.number().optional(),
  approvedValue: z.number().optional(),
  description: z.string().optional(),
  customerName: z.string().max(255).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(50).optional(),
  adjusterId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
});

export const claimsRoutes: FastifyPluginAsync = async (fastify) => {
  // Register generic CRUD routes
  registerCrudRoutes(fastify, {
    basePath: '/',
    table: claims,
    schema: claimSchema,
    skipList: true,
    beforeCreate: async (data, req) => {
      const userId = (req as AuthenticatedRequest).userId;
      const companyId = (req as AuthenticatedRequest).companyId;
      return {
        ...data,
        companyId,
        createdBy: userId,
        updatedBy: userId,
        statusHistory: [{
          status: data.status || 'new',
          timestamp: new Date().toISOString(),
          userId,
          userName: (req as AuthenticatedRequest).userName,
        }],
      };
    },
    afterCreate: async (result, req) => {
      const userInfo = ActivityService.getUserInfo(req);
      const companyId = (req as AuthenticatedRequest).companyId;
      await ActivityService.logCreate({
        companyId,
        userId: userInfo.userId,
        userName: userInfo.userName,
        entityType: 'claim',
        entityId: (result as any).id,
        entityName: (result as any).claimNumber,
        description: `Created claim: ${(result as any).claimNumber}`,
        newValues: { claimNumber: (result as any).claimNumber, status: (result as any).status },
        ipAddress: userInfo.ipAddress,
      });
    },
  });

  // List claims with search, filters, and pagination
  fastify.get('/', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const query = req.query as any;

    // Pagination
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const offset = (page - 1) * limit;

    // Filters
    const status = query.status || '';
    const adjusterId = query.adjusterId || '';
    const search = query.search || '';

    // Build query conditions
    const conditions = [
      eq((claims as any).companyId, companyId),
    ];

    if (status) {
      conditions.push(eq((claims as any).status, status));
    }

    if (adjusterId) {
      conditions.push(eq((claims as any).adjusterId, adjusterId));
    }

    if (search) {
      const searchCondition = or(
        like((claims as any).claimNumber, `%${search}%`),
        like((claims as any).customerName, `%${search}%`),
        like((claims as any).insuranceCompany, `%${search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Get total count
    const [countResult] = await db
      .select({ count: (claims as any).id })
      .from(claims)
      .where(whereClause);

    const total = Array.isArray(countResult) ? countResult.length : 1;

    // Get paginated results
    const results = await db
      .select()
      .from(claims)
      .where(whereClause)
      .orderBy(desc((claims as any).updatedAt))
      .limit(limit)
      .offset(offset);

    reply.send({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch claims' });
    }
  });

  // Update claim status with validation
  fastify.put('/:id/status', async (req, reply) => {
    try {
      const { id } = req.params as any;
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userInfo = ActivityService.getUserInfo(req);

      const { status, reason } = req.body as { status: ClaimStatus; reason?: string };

    // Verify ownership
    const [existing] = await db
      .select()
      .from(claims)
      .where(eq((claims as any).id, id));

    if (!existing) {
      return reply.code(404).send({ error: 'Claim not found' });
    }

    if ((existing as any).companyId !== companyId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // Validate status transition
    const validation = ClaimsWorkflowService.validateTransition(
      (existing as any).status as ClaimStatus,
      status
    );

    if (!validation.allowed) {
      return reply.code(400).send({ error: validation.reason });
    }

    // Update status history
    const currentHistory = (existing as any).statusHistory || [];
    const newHistory = ClaimsWorkflowService.addStatusHistoryEntry(
      currentHistory,
      status,
      userId,
      userInfo.userName,
      reason
    );

    // Update claim
    const [updated] = await db
      .update(claims)
      .set({
        status,
        statusHistory: newHistory,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq((claims as any).id, id))
      .returning();

    // Log activity
    await ActivityService.logStatusChange({
      companyId,
      userId: userInfo.userId,
      userName: userInfo.userName,
      entityType: 'claim',
      entityId: id,
      entityName: (existing as any).claimNumber,
      description: `Changed claim status from ${STATUS_LABELS[(existing as any).status as ClaimStatus]} to ${STATUS_LABELS[status]}`,
      previousValues: { status: (existing as any).status },
      newValues: { status, reason },
      ipAddress: userInfo.ipAddress,
    });

    reply.send(updated);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to change claim status' });
    }
  });

  // Get claim details with related data
  fastify.get('/:id', async (req, reply) => {
    try {
      const { id } = req.params as any;
      const companyId = (req as AuthenticatedRequest).companyId;

    const [claim] = await db
      .select()
      .from(claims)
      .where(and(
        eq((claims as any).id, id),
        eq((claims as any).companyId, companyId)
      ));

    if (!claim) {
      return reply.code(404).send({ error: 'Claim not found' });
    }

    // Calculate financial summary
    const financialSummary = ClaimsWorkflowService.calculateFinancialSummary(claim);

    reply.send({
      ...claim,
      financialSummary,
    });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch claim details' });
    }
  });

  // Get dashboard statistics
  fastify.get('/dashboard/stats', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;

      const allClaims = await db
        .select()
        .from(claims)
        .where(eq((claims as any).companyId, companyId));

      const stats = ClaimsWorkflowService.getDashboardStats(allClaims);

      reply.send(stats);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to get dashboard stats' });
    }
  });

  // Get supplements for a claim
  fastify.get('/:id/supplements', async (req, reply) => {
    try {
      const { id } = req.params as any;
      const companyId = (req as AuthenticatedRequest).companyId;

      const claimSupplements = await db
        .select()
        .from(supplements)
      .where(and(
        eq((supplements as any).claimId, id),
        eq((supplements as any).companyId, companyId)
      ))
      .orderBy(desc((supplements as any).createdAt));

    // Calculate summary
    const summary = {
      count: claimSupplements.length,
      totalRequested: claimSupplements.reduce((sum: number, s: any) => sum + (Number(s.requestedAmount) || 0), 0),
      totalApproved: claimSupplements.reduce((sum: number, s: any) => sum + (Number(s.approvedAmount) || 0), 0),
      totalOutstanding: claimSupplements.reduce((sum: number, s: any) => sum + ((Number(s.requestedAmount) || 0) - (Number(s.approvedAmount) || 0)), 0),
      latestStatus: claimSupplements.length > 0 ? claimSupplements[0].status : null,
      latestCarrierResponse: claimSupplements.length > 0 ? claimSupplements[0].responseDate : null,
    };

    reply.send({
      supplements: claimSupplements,
      summary,
    });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch claim supplements' });
    }
  });

  // Get interviews for a claim
  fastify.get('/:id/interviews', async (req, reply) => {
    try {
      const { id } = req.params as any;
      const companyId = (req as AuthenticatedRequest).companyId;

      const { interviews } = await import('@project-atlas/database');

      const claimInterviews = await db
      .select()
      .from(interviews)
      .where(and(
        eq((interviews as any).claimId, id),
        eq((interviews as any).companyId, companyId)
      ))
      .orderBy(desc((interviews as any).createdAt));

    reply.send({
      interviews: claimInterviews,
      count: claimInterviews.length,
    });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch claim interviews' });
    }
  });

  // Get available status transitions for a claim
  fastify.get('/:id/transitions', async (req, reply) => {
    try {
      const { id } = req.params as any;
      const companyId = (req as AuthenticatedRequest).companyId;

      const [claim] = await db
        .select()
        .from(claims)
      .where(and(
        eq((claims as any).id, id),
        eq((claims as any).companyId, companyId)
      ));

    if (!claim) {
      return reply.code(404).send({ error: 'Claim not found' });
    }

    const nextStatuses = ClaimsWorkflowService.getNextStatuses(
      (claim as any).status as ClaimStatus
    );

    reply.send({
      currentStatus: (claim as any).status,
      nextStatuses: nextStatuses.map(status => ({
        value: status,
        label: STATUS_LABELS[status],
      })),
    });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to get claim transitions' });
    }
  });
};
