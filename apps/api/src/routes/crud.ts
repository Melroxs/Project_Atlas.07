import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, z } from 'zod';
import { db } from '@project-atlas/database';
import { eq, and } from 'drizzle-orm';
import { AuthenticatedRequest } from '../types/request';

/**
 * Register a set of standard CRUD routes for a given table.
 *
 * @param server Fastify instance
 * @param opts Options containing table name, zod schema for validation, and optional custom handlers
 */
export function registerCrudRoutes(
  server: FastifyInstance,
  opts: {
    basePath: string; // e.g. '/companies'
    table: any; // drizzle table reference
    schema: ZodSchema<any>;
    // optional hooks to run before/after create/update/delete
    beforeCreate?: (data: any, req: FastifyRequest) => Promise<any>;
    afterCreate?: (result: any, req: FastifyRequest) => Promise<void>;
    skipList?: boolean; // set true when a custom list route is registered separately
  }
) {
  const { basePath, table, schema, beforeCreate, afterCreate, skipList } = opts;

  if (!skipList) {
    // List all rows (company‑scoped)
    server.get(basePath, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const rows = await db.select().from(table).where(eq((table as any).companyId, companyId));
      reply.send(rows);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch records' });
    }
  });
  }

  // Get by id (ensuring same company)
  server.get(`${basePath}/:id`, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = req.params;
      const companyId = (req as AuthenticatedRequest).companyId;
      const rows = await db.select().from(table).where(
        and(eq((table as any).id, id), eq((table as any).companyId, companyId))
      );
      if (!rows || rows.length === 0) return reply.code(404).send({ error: 'Not found' });
      reply.send(rows[0]);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch record' });
    }
  });

  // Create
  server.post(basePath, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.format() });
      let payload = parsed.data;
      const companyId = (req as AuthenticatedRequest).companyId;
      payload = { ...payload, companyId };
      if (beforeCreate) payload = await beforeCreate(payload, req);
      const created = await db.insert(table).values(payload).returning();
      if (afterCreate) await afterCreate((created as any)[0], req);
      reply.code(201).send((created as any)[0]);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to create record' });
    }
  });

  // Update (partial)
  server.patch(`${basePath}/:id`, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = req.params;
      const companyId = (req as AuthenticatedRequest).companyId;
      const parsed = (schema as any).partial().safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.format() });
      const updated = await db
        .update(table)
        .set(parsed.data)
        .where(and(eq((table as any).id, id), eq((table as any).companyId, companyId)))
        .returning();
      // @ts-ignore
      if (!updated || updated.length === 0) return reply.code(404).send({ error: 'Not found' });
      // @ts-ignore
      reply.send(updated[0]);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to update record' });
    }
  });

  // Delete
  server.delete(`${basePath}/:id`, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = req.params;
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await db.delete(table).where(and(eq((table as any).id, id), eq((table as any).companyId, companyId)));
      reply.code(204).send();
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete record' });
    }
  });
}
