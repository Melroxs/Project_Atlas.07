// apps/api/src/routes/users.ts
import { FastifyPluginAsync } from 'fastify';
import { registerCrudRoutes } from './crud';
import { profiles } from '../../../../packages/database/src/schema/users';
import { z } from 'zod';

// Basic schema; extend as needed.
// id maps to auth.users.id (profiles.id has no default). Optional so callers
// can create a profile for an existing auth user.
const userSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional()
});

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  registerCrudRoutes(fastify, {
    basePath: '/',
    table: profiles,
    schema: userSchema,
    // profiles is a tenant-level table: no company_id column
    companyScoped: false,
  });
};
