// apps/api/src/routes/operations.ts
import { FastifyPluginAsync } from 'fastify';
import { AuthenticatedRequest } from '../types/request';
import {
  computeOperations,
  computeCompanyOperations,
  analyzeOperationsAndPersist,
} from '../lib/operations/operations-service';

/**
 * Operations Intelligence API (Phase 3).
 * All GET endpoints are read-only and computed dynamically from live claim
 * data. The only write path is POST /refresh which persists the digital twin
 * (and the event bus refreshes twins automatically on claim events).
 */
export const operationsRoutes: FastifyPluginAsync = async (fastify) => {
  const getClaimId = (req: any) => (req.params as any).claimId as string;

  // GET /operations/claims/:claimId — full operations model (twin + lifecycle +
  // financial + opportunities + recommendations + case manager)
  fastify.get('/claims/:claimId', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeOperations(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send(result.model);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to compute operations model', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /operations/claims/:claimId/lifecycle
  fastify.get('/claims/:claimId/lifecycle', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeOperations(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send(result.model.lifecycle);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to compute lifecycle', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /operations/claims/:claimId/financial
  fastify.get('/claims/:claimId/financial', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeOperations(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send(result.model.financial);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to compute financial intelligence', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /operations/claims/:claimId/case-manager
  fastify.get('/claims/:claimId/case-manager', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeOperations(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send(result.model.caseManager);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to run case manager', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /operations/claims/:claimId/opportunities
  fastify.get('/claims/:claimId/opportunities', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeOperations(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send({ opportunities: result.model.opportunities });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to detect revenue opportunities', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /operations/claims/:claimId/recommendations
  fastify.get('/claims/:claimId/recommendations', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeOperations(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send({ recommendations: result.model.recommendations });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to generate operational recommendations', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /operations/claims/:claimId/twin — persisted digital twin
  fastify.get('/claims/:claimId/twin', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeOperations(companyId, getClaimId(req));
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send({ twin: result.model.digitalTwin, live: true });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to build digital twin', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /operations/company/overview — revenue + executive + portfolio dashboards
  fastify.get('/company/overview', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeCompanyOperations(companyId);
      if (!result.overview) {
        reply.code(200).send({ empty: true, reason: result.reason });
        return;
      }
      reply.send(result.overview);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to compute company operations overview', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /operations/company/revenue — Revenue Recovery Dashboard
  fastify.get('/company/revenue', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeCompanyOperations(companyId);
      if (!result.overview) {
        reply.code(200).send({ empty: true, reason: result.reason });
        return;
      }
      reply.send(result.overview.revenue);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to compute revenue dashboard', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /operations/company/executive — Executive Operations Dashboard
  fastify.get('/company/executive', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeCompanyOperations(companyId);
      if (!result.overview) {
        reply.code(200).send({ empty: true, reason: result.reason });
        return;
      }
      reply.send(result.overview.executive);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to compute executive dashboard', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /operations/company/portfolio — Portfolio Intelligence
  fastify.get('/company/portfolio', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const result = await computeCompanyOperations(companyId);
      if (!result.overview) {
        reply.code(200).send({ empty: true, reason: result.reason });
        return;
      }
      reply.send(result.overview.portfolio);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to compute portfolio intelligence', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // POST /operations/claims/:claimId/refresh — persist digital twin + emit event
  fastify.post('/claims/:claimId/refresh', async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const claimId = getClaimId(req);
      const result = await analyzeOperationsAndPersist(companyId, claimId);
      if (!result.model) {
        reply.code(404).send({ error: 'Claim not found' });
        return;
      }
      reply.send({ success: true, generatedAt: result.model.generatedAt });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to refresh digital twin', details: error instanceof Error ? error.message : String(error) });
    }
  });
};
