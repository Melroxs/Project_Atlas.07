// apps/api/src/routes/evidence-links.ts
import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@project-atlas/database';
import { evidenceLinks, documents } from '@project-atlas/database';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/request';

const createEvidenceLinkSchema = z.object({
  recommendationId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  photoId: z.string().uuid().optional(),
  interviewAnswerId: z.string().uuid().optional(),
  relevance: z.enum(['high', 'medium', 'low']),
  description: z.string().min(1).max(500),
  strengthScore: z.number().min(0).max(1).optional(),
});

const updateEvidenceLinkSchema = z.object({
  relevance: z.enum(['high', 'medium', 'low']).optional(),
  description: z.string().min(1).max(500).optional(),
  strengthScore: z.number().min(0).max(1).optional(),
});

export const evidenceLinksRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /evidence-links - Create evidence link
  fastify.post('/', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const body = createEvidenceLinkSchema.parse(req.body);

      // Validate that at least one evidence type is provided
      if (!body.documentId && !body.photoId && !body.interviewAnswerId) {
        reply.code(400).send({ error: 'At least one of documentId, photoId, or interviewAnswerId must be provided' });
        return;
      }

      // If documentId is provided, verify it exists and belongs to company
      if (body.documentId) {
        const [document] = await db
          .select()
          .from(documents)
          .where(and(
            eq(documents.id, body.documentId),
            eq(documents.companyId, companyId)
          ))
          .limit(1);

        if (!document) {
          reply.code(404).send({ error: 'Document not found' });
          return;
        }
      }

      const [evidenceLink] = await db
        .insert(evidenceLinks)
        .values({
          recommendationId: body.recommendationId,
          documentId: body.documentId,
          photoId: body.photoId,
          interviewAnswerId: body.interviewAnswerId,
          relevance: body.relevance,
          description: body.description,
          strengthScore: body.strengthScore?.toString() || '0.50',
          createdBy: userId,
          updatedAt: new Date(),
        })
        .returning();

      reply.send(evidenceLink);
    } catch (error) {
      reply.code(500).send({ 
        error: 'Failed to create evidence link',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /evidence-links/:recommendationId - Get evidence for recommendation
  fastify.get('/:recommendationId', async (req, reply) => {
    try {
      const { recommendationId } = req.params as { recommendationId: string };

      const evidence = await db
        .select({
          id: evidenceLinks.id,
          recommendationId: evidenceLinks.recommendationId,
          documentId: evidenceLinks.documentId,
          photoId: evidenceLinks.photoId,
          interviewAnswerId: evidenceLinks.interviewAnswerId,
          relevance: evidenceLinks.relevance,
          description: evidenceLinks.description,
          strengthScore: evidenceLinks.strengthScore,
          createdAt: evidenceLinks.createdAt,
          documentName: documents.fileName,
          documentUrl: documents.url,
        })
        .from(evidenceLinks)
        .leftJoin(documents, eq(evidenceLinks.documentId, documents.id))
        .where(eq(evidenceLinks.recommendationId, recommendationId))
        .orderBy(desc(evidenceLinks.createdAt));

      reply.send({ evidence });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch evidence links' });
    }
  });

  // PUT /evidence-links/:id - Update evidence link
  fastify.put('/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = updateEvidenceLinkSchema.parse(req.body);

      const [updatedLink] = await db
        .update(evidenceLinks)
        .set({
          ...body,
          strengthScore: body.strengthScore?.toString(),
          updatedAt: new Date(),
        })
        .where(eq(evidenceLinks.id, id))
        .returning();

      if (!updatedLink) {
        reply.code(404).send({ error: 'Evidence link not found' });
        return;
      }

      reply.send(updatedLink);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to update evidence link' });
    }
  });

  // DELETE /evidence-links/:id - Remove evidence link
  fastify.delete('/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };

      const [deletedLink] = await db
        .delete(evidenceLinks)
        .where(eq(evidenceLinks.id, id))
        .returning();

      if (!deletedLink) {
        reply.code(404).send({ error: 'Evidence link not found' });
        return;
      }

      reply.send({ message: 'Evidence link deleted successfully' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete evidence link' });
    }
  });
};
