// apps/api/src/routes/documents.ts
import { FastifyPluginAsync } from 'fastify';
import { registerCrudRoutes } from './crud';
import { documents } from '@project-atlas/database';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { eq } from 'drizzle-orm';
import { db } from '@project-atlas/database';
import { ActivityService } from '../lib/activity';
import { AuthenticatedRequest } from '../types/request';
import { emitClaimEvent } from '../lib/intelligence/claim-intelligence-service';

// Document schema for validation (url is NOT NULL in the documents table)
const documentSchema = z.object({
  claimId: z.string().uuid().optional(),
  url: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(100).optional(),
  sizeBytes: z.number().optional(),
});

export const documentsRoutes: FastifyPluginAsync = async (fastify) => {
  // Register generic CRUD routes
  registerCrudRoutes(fastify, {
    basePath: '/',
    table: documents,
    schema: documentSchema,
    skipDelete: true, // custom DELETE /:id registered below (also removes from storage)
  });

  // Upload document
  fastify.post('/upload', async (req: any, reply) => {
    try {
      const multipart = await req.file();
      if (!multipart) {
        return reply.code(400).send({ error: 'File missing' });
      }

      const { filename, mimetype, file } = multipart;
      const companyId = (req as AuthenticatedRequest).companyId;
      const claimId = (req.body as any).claimId;
      const userInfo = ActivityService.getUserInfo(req);

    // Generate unique file path
    const fileExtension = filename.split('.').pop();
    const documentId = crypto.randomUUID();
    const filePath = `documents/${companyId}/${documentId}.${fileExtension}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file as any, {
        contentType: mimetype,
        upsert: false,
      });

    if (uploadError) {
      return reply.code(500).send({ error: uploadError.message });
    }

    // Get public URL
    const { data } = supabase.storage.from('documents').getPublicUrl(filePath);

    // Save document record to database
    const [document] = await db.insert(documents).values({
      companyId,
      claimId: claimId || null,
      url: data.publicUrl,
      fileName: filename,
      mimeType: mimetype,
      sizeBytes: (file as any).length,
    }).returning();

    // Log activity
    await ActivityService.logUpload({
      companyId,
      userId: userInfo.userId,
      userName: userInfo.userName,
      entityType: 'document',
      entityId: (document as any).id,
      entityName: filename,
      description: `Uploaded document: ${filename}`,
      newValues: { fileName: filename, mimetype, sizeBytes: (file as any).length },
      ipAddress: userInfo.ipAddress,
    });

    reply.code(201).send(document);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to upload document' });
    }
  });

  // Upload document for specific claim
  fastify.post('/claims/:claimId/upload', async (req: any, reply) => {
    try {
      const { claimId } = req.params as any;
      const multipart = await req.file();
      if (!multipart) {
        return reply.code(400).send({ error: 'File missing' });
      }

      const { filename, mimetype, file } = multipart;
      const companyId = (req as AuthenticatedRequest).companyId;
      const userInfo = ActivityService.getUserInfo(req);

    // Generate unique file path
    const fileExtension = filename.split('.').pop();
    const documentId = crypto.randomUUID();
    const filePath = `documents/${companyId}/${claimId}/${documentId}.${fileExtension}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file as any, {
        contentType: mimetype,
        upsert: false,
      });

    if (uploadError) {
      return reply.code(500).send({ error: uploadError.message });
    }

    // Get public URL
    const { data } = supabase.storage.from('documents').getPublicUrl(filePath);

    // Save document record to database
    const [document] = await db.insert(documents).values({
      companyId,
      claimId,
      url: data.publicUrl,
      fileName: filename,
      mimeType: mimetype,
      sizeBytes: (file as any).length,
    }).returning();

    // Log activity
    await ActivityService.logUpload({
      companyId,
      userId: userInfo.userId,
      userName: userInfo.userName,
      entityType: 'document',
      entityId: (document as any).id,
      entityName: filename,
      description: `Uploaded document for claim ${claimId}: ${filename}`,
      newValues: { fileName: filename, mimetype, sizeBytes: (file as any).length, claimId },
      ipAddress: userInfo.ipAddress,
    });

    reply.code(201).send(document);

    // Trigger claim intelligence re-analysis (document/photo/estimate/policy uploaded)
    const eventType = mimetype.startsWith('image/')
      ? 'photo.uploaded'
      : /policy|coverage|declarations/i.test(filename)
        ? 'policy.uploaded'
        : /estimate|xactimate/i.test(filename)
          ? 'estimate.uploaded'
          : 'document.uploaded';
    await emitClaimEvent(companyId, claimId, eventType, 'document', (document as any).id, { fileName: filename });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to upload document for claim' });
    }
  });

  // Get documents for a specific claim
  fastify.get('/claims/:claimId', async (req, reply) => {
    try {
      const { claimId } = req.params as any;
      const companyId = (req as AuthenticatedRequest).companyId;

      const claimDocuments = await db
        .select()
        .from(documents)
        .where(eq((documents as any).claimId, claimId));

      // Filter by company for security
      const filtered = claimDocuments.filter((doc: any) => doc.companyId === companyId);

      reply.send(filtered);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch documents' });
    }
  });

  // Delete document (both from database and storage)
  fastify.delete('/:id', async (req, reply) => {
    try {
      const { id } = req.params as any;
      const companyId = (req as AuthenticatedRequest).companyId;
      const userInfo = ActivityService.getUserInfo(req);

      // Get document first to verify ownership and get URL
      const [document] = await db
        .select()
        .from(documents)
        .where(eq((documents as any).id, id));

      if (!document) {
        return reply.code(404).send({ error: 'Document not found' });
      }

      if ((document as any).companyId !== companyId) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // Log activity before delete
      await ActivityService.logDelete({
        companyId,
        userId: userInfo.userId,
        userName: userInfo.userName,
        entityType: 'document',
        entityId: id,
        entityName: (document as any).fileName,
        description: `Deleted document: ${(document as any).fileName}`,
        previousValues: { fileName: (document as any).fileName, url: (document as any).url },
        ipAddress: userInfo.ipAddress,
      });

      // Delete from Supabase storage
      const url = (document as any).url;
      const filePath = url.split('/documents/')[1];
      if (filePath) {
        await supabase.storage.from('documents').remove([`documents/${filePath}`]);
      }

      // Delete from database
      await db.delete(documents).where(eq((documents as any).id, id));

      reply.code(204).send();
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete document' });
    }
  });

  // Download document (redirect to public URL)
  fastify.get('/:id/download', async (req, reply) => {
    try {
      const { id } = req.params as any;
      const companyId = (req as AuthenticatedRequest).companyId;
      const userInfo = ActivityService.getUserInfo(req);

      // Get document to verify ownership
      const [document] = await db
        .select()
        .from(documents)
        .where(eq((documents as any).id, id));

      if (!document) {
        return reply.code(404).send({ error: 'Document not found' });
      }

      if ((document as any).companyId !== companyId) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // Log activity
      await ActivityService.logDownload({
        companyId,
        userId: userInfo.userId,
        userName: userInfo.userName,
        entityType: 'document',
        entityId: id,
        entityName: (document as any).fileName,
        description: `Downloaded document: ${(document as any).fileName}`,
        ipAddress: userInfo.ipAddress,
      });

      // Redirect to the public URL
      reply.redirect((document as any).url);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to download document' });
    }
  });
};
