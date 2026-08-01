// apps/api/src/routes/notes.ts
import { FastifyPluginAsync } from 'fastify';
import { registerCrudRoutes } from './crud';
import { notes } from '@project-atlas/database';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/request';
import { emitClaimEvent } from '../lib/intelligence/claim-intelligence-service';

// Matches the notes table schema (see web route for parity)
const noteSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  content: z.string().min(1),
});

export const notesRoutes: FastifyPluginAsync = async (fastify) => {
  registerCrudRoutes(fastify, {
    basePath: '/',
    table: notes,
    schema: noteSchema,
    afterCreate: async (result, req) => {
      // Notes on a claim are communications → trigger communications intelligence
      const entityType = (result as any).entityType;
      if (entityType === 'claim') {
        const companyId = (req as AuthenticatedRequest).companyId;
        await emitClaimEvent(companyId, (result as any).entityId, 'communication.added', 'note', (result as any).id, {
          content: (result as any).content,
        });
      }
    },
  });
};
