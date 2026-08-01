// apps/api/src/routes/claim-intelligence.ts
import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { db, claimIntelligenceSnapshots, communicationExtractions, carrierIntelligence } from '@project-atlas/database';
import { AuthenticatedRequest } from '../types/request';
import {
  computeClaimIntelligence,
  analyzeClaimIntelligence,
  loadClaimBundle,
  emitClaimEvent,
} from '../lib/intelligence/claim-intelligence-service';
import { extractAll } from '@project-atlas/claim-intelligence';

/**
 * Claim Intelligence API — all endpoints are read-only and computed
 * dynamically (or served from the latest persisted snapshot for history).
 */
export const claimIntelligenceRoutes: FastifyPluginAsync = async (fastify) => {
  const getClaimId = (req: any) => (req.params as any).claimId as string;

  // GET /intelligence/claims/:claimId/summary — full intelligence model
  fastify.get('/claims/:claimId/summary', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeClaimIntelligence(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send(result.model);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to analyze claim', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /intelligence/claims/:claimId/recovery-readiness
  fastify.get('/claims/:claimId/recovery-readiness', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeClaimIntelligence(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send({
        score: result.model.recoveryReadiness.score,
        level: result.model.recoveryReadiness.level,
        label: result.model.recoveryReadiness.label,
        factors: result.model.recoveryReadiness.factors,
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to compute recovery readiness', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /intelligence/claims/:claimId/health — health score + alerts (risks)
  fastify.get('/claims/:claimId/health', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeClaimIntelligence(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send({
        health: result.model.health,
        openRisks: result.model.openRisks,
        missingInformation: result.model.missingInformation,
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch claim health', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /intelligence/claims/:claimId/next-best-actions
  fastify.get('/claims/:claimId/next-best-actions', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeClaimIntelligence(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send({ actions: result.model.nextBestActions });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to compute next best actions', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /intelligence/claims/:claimId/knowledge-graph
  fastify.get('/claims/:claimId/knowledge-graph', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeClaimIntelligence(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send(result.model.knowledgeGraph);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to build knowledge graph', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /intelligence/claims/:claimId/history — recommendation / snapshot history
  fastify.get('/claims/:claimId/history', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const claimId = getClaimId(req);
      const snapshots = await db
        .select()
        .from(claimIntelligenceSnapshots)
        .where(and(eq((claimIntelligenceSnapshots as any).claimId, claimId), eq((claimIntelligenceSnapshots as any).companyId, companyId)))
        .orderBy(desc((claimIntelligenceSnapshots as any).analyzedAt))
        .limit(50)
        .catch(() => [] as any[]);
      reply.send({
        count: snapshots.length,
        snapshots: snapshots.map((s: any) => ({
          id: s.id,
          analyzedAt: s.analyzedAt,
          healthScore: s.healthScore,
          recoveryReadiness: s.recoveryReadiness,
          complianceStatus: s.complianceStatus,
          policyAnalysisStatus: s.policyAnalysisStatus,
          actions: (s.model?.nextBestActions || []).map((a: any) => ({
            title: a.title,
            priority: a.priority,
            confidence: a.confidence,
          })),
        })),
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch history', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /intelligence/claims/:claimId/explain/:actionId — explainable AI
  fastify.get('/claims/:claimId/explain/:actionId', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { actionId } = req.params as any;
      const result = await computeClaimIntelligence(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      const action = result.model.nextBestActions.find((a) => a.id === actionId);
      if (!action) {
        reply.code(404).send({ error: 'Recommendation not found' });
        return;
      }
      reply.send(action.explanation);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to explain recommendation', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /intelligence/claims/:claimId/communications — extracted entities
  fastify.get('/claims/:claimId/communications', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const claimId = getClaimId(req);
      const bundle = await loadClaimBundle(companyId, claimId);
      if (!bundle) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      const live = extractAll(bundle);
      const stored = await db
        .select()
        .from(communicationExtractions)
        .where(and(eq((communicationExtractions as any).claimId, claimId), eq((communicationExtractions as any).companyId, companyId)))
        .orderBy(desc((communicationExtractions as any).createdAt))
        .limit(200)
        .catch(() => [] as any[]);
      reply.send({
        extracted: live.map((e) => ({
          entityType: e.entityType,
          value: e.value,
          confidence: e.confidence,
          context: e.context,
        })),
        storedCount: stored.length,
        communications: bundle.communications.map((c) => ({ source: c.source, content: c.content, createdAt: c.createdAt })),
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to extract communications intelligence', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /intelligence/carrier?carrier= — carrier intelligence foundation
  fastify.get('/carrier', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { carrier } = req.query as any;
      const rows = carrier
        ? await db
            .select()
            .from(carrierIntelligence)
            .where(and(eq((carrierIntelligence as any).companyId, companyId), eq((carrierIntelligence as any).carrier, carrier)))
            .catch(() => [] as any[])
        : await db
            .select()
            .from(carrierIntelligence)
            .where(eq((carrierIntelligence as any).companyId, companyId))
            .catch(() => [] as any[]);
      reply.send({ carriers: rows });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch carrier intelligence', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // POST /intelligence/claims/:claimId/analyze — trigger re-analysis (writes snapshot + emits event)
  fastify.post('/claims/:claimId/analyze', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userId = (req as AuthenticatedRequest).userId;
      const claimId = getClaimId(req);
      const result = await analyzeClaimIntelligence(companyId, claimId);
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      await emitClaimEvent(companyId, claimId, 'intelligence.reanalyzed', 'claim', claimId, {
        analyzedBy: userId,
        healthScore: result.model.health.score,
        recoveryReadiness: result.model.recoveryReadiness.score,
      });
      reply.send({ success: true, analyzedAt: result.model.analyzedAt, model: result.model });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to re-analyze claim', details: error instanceof Error ? error.message : String(error) });
    }
  });
};
