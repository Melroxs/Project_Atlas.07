// apps/api/src/routes/users.ts
import { FastifyPluginAsync } from 'fastify';
import { registerCrudRoutes } from './crud';
import { profiles } from '@project-atlas/database';
import { z } from 'zod';

// Basic schema; extend as needed.
const userSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional()
});

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  registerCrudRoutes(fastify, {
    basePath: '/',
    table: profiles,
    schema: userSchema,
  });
};
