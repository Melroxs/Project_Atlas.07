// apps/api/src/routes/tenants.ts
import { FastifyPluginAsync } from 'fastify';
import { registerCrudRoutes } from './crud';
import { tenants } from '../../../../packages/database/src/schema/tenants';
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
    // tenants is a tenant-level table: no company_id column
    companyScoped: false,
  });
};
