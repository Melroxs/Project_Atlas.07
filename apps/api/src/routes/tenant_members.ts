// apps/api/src/routes/tenant_members.ts
import { FastifyPluginAsync } from 'fastify';
import { registerCrudRoutes } from './crud';
import { tenantMembers } from '@project-atlas/database';
import { z } from 'zod';

// Basic schema for tenant members; adjust fields as needed.
const tenantMemberSchema = z.object({
  userId: z.string().uuid(),
  companyId: z.string().uuid(),
  role: z.string()
});

export const tenantMembersRoutes: FastifyPluginAsync = async (fastify) => {
  registerCrudRoutes(fastify, {
    basePath: '/',
    table: tenantMembers,
    schema: tenantMemberSchema,
  });
};
