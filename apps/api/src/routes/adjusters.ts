// apps/api/src/routes/adjusters.ts
import { FastifyPluginAsync } from 'fastify';
import { registerCrudRoutes } from './crud';
import { adjusters } from '@project-atlas/database';
import { z } from 'zod';
import { db } from '@project-atlas/database';
import { eq, or, like, and, desc } from 'drizzle-orm';
import { ActivityService } from '../lib/activity';
import { AuthenticatedRequest } from '../types/request';

// Adjuster schema for validation
const adjusterSchema = z.object({
  fullName: z.string().min(1).max(255),
  insuranceCompany: z.string().max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  office: z.string().max(255).optional(),
  territory: z.string().max(255).optional(),
  notes: z.string().optional(),
  active: z.boolean().default(true),
});

export const adjustersRoutes: FastifyPluginAsync = async (fastify) => {
  // Register generic CRUD routes
  registerCrudRoutes(fastify, {
    basePath: '/',
    table: adjusters,
    schema: adjusterSchema,
    skipList: true,
    beforeCreate: async (data, req) => {
      const userId = (req as AuthenticatedRequest).userId;
      const companyId = (req as AuthenticatedRequest).companyId;
      return {
        ...data,
        createdBy: userId,
        updatedBy: userId,
      };
    },
    afterCreate: async (result, req) => {
      const userInfo = ActivityService.getUserInfo(req);
      const companyId = (req as AuthenticatedRequest).companyId;
      await ActivityService.logCreate({
        companyId,
        userId: userInfo.userId,
        userName: userInfo.userName,
        entityType: 'adjuster',
        entityId: (result as any).id,
        entityName: (result as any).fullName,
        description: `Created adjuster: ${(result as any).fullName}`,
        newValues: { fullName: (result as any).fullName },
        ipAddress: userInfo.ipAddress,
      });
    },
  });

  // List adjusters with search, pagination, and filtering
  fastify.get('/', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const query = req.query as any;
    
    // Pagination
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const offset = (page - 1) * limit;

    // Search
    const search = query.search || '';
    const activeFilter = query.active !== undefined ? query.active === 'true' : undefined;

    // Build query conditions
    const conditions = [
      eq((adjusters as any).companyId, companyId),
    ];

    if (search) {
      const searchCondition = or(
        like((adjusters as any).fullName, `%${search}%`),
        like((adjusters as any).email, `%${search}%`),
        like((adjusters as any).phone, `%${search}%`),
        like((adjusters as any).insuranceCompany, `%${search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (activeFilter !== undefined) {
      conditions.push(eq((adjusters as any).active, activeFilter));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Get total count
    const [countResult] = await db
      .select({ count: (adjusters as any).id })
      .from(adjusters)
      .where(whereClause);
    
    const total = Array.isArray(countResult) ? countResult.length : 1;

    // Get paginated results
    const results = await db
      .select()
      .from(adjusters)
      .where(whereClause)
      .orderBy(desc((adjusters as any).createdAt))
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
      reply.code(500).send({ error: 'Failed to fetch adjusters' });
    }
  });

  // Update adjuster with activity logging
  fastify.put('/:id', async (req, reply) => {
    try {
      const { id } = req.params as any;
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userInfo = ActivityService.getUserInfo(req);

      const parsed = adjusterSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.format() });
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(adjusters)
      .where(eq((adjusters as any).id, id));

    if (!existing) {
      return reply.code(404).send({ error: 'Adjuster not found' });
    }

    if ((existing as any).companyId !== companyId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // Update
    const [updated] = await db
      .update(adjusters)
      .set({
        ...parsed.data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq((adjusters as any).id, id))
      .returning();

    // Log activity
    await ActivityService.logUpdate({
      companyId,
      userId: userInfo.userId,
      userName: userInfo.userName,
      entityType: 'adjuster',
      entityId: id,
      entityName: (updated as any).fullName,
      description: `Updated adjuster: ${(updated as any).fullName}`,
      previousValues: { fullName: (existing as any).fullName },
      newValues: { fullName: (updated as any).fullName, changes: parsed.data },
      ipAddress: userInfo.ipAddress,
    });

    reply.send(updated);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to update adjuster' });
    }
  });

  // Delete adjuster with activity logging
  fastify.delete('/:id', async (req, reply) => {
    try {
      const { id } = req.params as any;
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const userInfo = ActivityService.getUserInfo(req);

      // Verify ownership
      const [existing] = await db
        .select()
        .from(adjusters)
        .where(eq((adjusters as any).id, id));

      if (!existing) {
        return reply.code(404).send({ error: 'Adjuster not found' });
      }

      if ((existing as any).companyId !== companyId) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // Log activity before delete
      await ActivityService.logDelete({
        companyId,
        userId: userInfo.userId,
        userName: userInfo.userName,
        entityType: 'adjuster',
        entityId: id,
        entityName: (existing as any).fullName,
        description: `Deleted adjuster: ${(existing as any).fullName}`,
        previousValues: { fullName: (existing as any).fullName },
        ipAddress: userInfo.ipAddress,
      });

      // Delete
      await db.delete(adjusters).where(eq((adjusters as any).id, id));

    reply.code(204).send();
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete adjuster' });
    }
  });
};
