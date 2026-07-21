// apps/api/src/routes/tenants.ts
import { FastifyPluginAsync } from 'fastify';
import { registerCrudRoutes } from './crud';
import { tenants } from '@project-atlas/database';
import { z } from 'zod';

// Basic schema; extend as needed.
const tenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1)
});

export const tenantsRoutes: FastifyPluginAsync = async (fastify) => {
  registerCrudRoutes(fastify, {
    basePath: '/',
    table: tenants,
    schema: tenantSchema,
  });
};
