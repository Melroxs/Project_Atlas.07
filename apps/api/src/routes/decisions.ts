// ==========================================================
// Atlas
// apps/api/src/routes/decisions.ts
// Decision Engine API (Phase 1-5)
// ==========================================================
//
// POST   /decisions/evaluate         — run the full decision pipeline
//                                      for a claim (persisted w/ version)
// GET    /decisions                  — list persisted decisions
// GET    /decisions/:id              — decision + full evidence context
// POST   /decisions/:id/review       — human review (approve/reject/request changes)
// POST   /decisions/:id/regenerate   — re-run the pipeline (new version)
// POST   /decisions/voice/ask        — grounded voice Q&A (Elemental adapter)
// POST   /decisions/outcomes         — record claim-completion outcome (learning)
// GET    /decisions/learning/metrics — learning analytics
//
// The route orchestrates existing modules via the
// DecisionContextCollector (claims, documents, interviews,
// supplements, activity, AI supplement drafts) and runs the pure
// DecisionEngine. Every execution is persisted by the drizzle
// DecisionRepository with version history — never overwritten.

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  DecisionService,
  DecisionRepository,
  DecisionContextSource,
  VoiceService,
  buildExportPackage,
  exportPackageToMarkdown,
} from "../../../../packages/domain/decision";
import type { DecisionPipelineResult } from "../../../../packages/domain/decision";
import { DecisionContextCollector } from "../lib/decision-context";
import { DecisionLearningService } from "../lib/decision-learning";
import { ActivityService } from "../lib/activity";
import { AuthenticatedRequest } from "../types/request";

const evaluateSchema = z.object({
  claimId: z.string().uuid(),
});

const reviewSchema = z.object({
  // The decision id comes from the URL param, not the body.
  action: z.enum(["APPROVED", "REJECTED", "REQUEST_CHANGES"]),
  comments: z.string().optional(),
});

const voiceSchema = z.object({
  claimId: z.string().uuid(),
  question: z.string().min(2).max(500),
});

const outcomeSchema = z.object({
  claimId: z.string().uuid(),
  decisionId: z.string().optional(),
  finalApprovedSupplement: z.any().optional(),
  reviewerEdits: z.any().optional(),
  adjusterOutcome: z.enum(["APPROVED", "PARTIAL", "DENIED", "PENDING"]).optional(),
  amountApproved: z.number().optional(),
  amountDenied: z.number().optional(),
  confidenceAccuracy: z.number().min(0).max(1).optional(),
  evidenceGaps: z.any().optional(),
  timeToApprovalMinutes: z.number().optional(),
});

function sendError(
  fastify: { log: { error: (e: unknown) => void } },
  reply: { code: (n: number) => { send: (o: unknown) => void } },
  error: unknown,
  message: string
) {
  // Client validation errors are 400, not 500.
  if (error instanceof z.ZodError) {
    reply.code(400).send({ error: "Validation failed", details: error.errors });
    return;
  }
  fastify.log.error(error);
  reply.code(500).send({ error: message });
}

export const decisionRoutes: FastifyPluginAsync = async (fastify) => {
  // Collector doubles as the DecisionContextSource for the service
  const collector = new DecisionContextCollector();
  const repository = new DecisionRepository();
  const service = new DecisionService(repository, collector as DecisionContextSource);
  const voiceService = new VoiceService();
  const learningService = new DecisionLearningService(repository);

  // POST /decisions/evaluate — run the full decision pipeline
  fastify.post("/evaluate", async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const userInfo = ActivityService.getUserInfo(req);
      const { claimId } = evaluateSchema.parse(req.body);

      const result = await service.analyzeClaim(claimId, companyId);

      // Include the persisted decision record so clients can navigate to
      // the newly created decision without reading stale state.
      const decision = await repository.getLatestDecision(claimId, companyId);

      // Log activity timeline entry
      await ActivityService.logCreate({
        companyId,
        userId: userInfo.userId,
        userName: userInfo.userName,
        entityType: "decision",
        entityId: claimId,
        entityName: result.recommendations[0]?.title ?? "Claim Analysis",
        description: `Decision generated for claim: ${result.recommendations[0]?.title ?? "Claim Analysis"}`,
        newValues: {
          confidence: result.confidence.value,
          risk: result.risk.score,
          requiresHumanApproval: result.requiresHumanApproval,
          recommendations: result.recommendations.map((r) => r.type),
        },
        ipAddress: userInfo.ipAddress,
      });

      reply.send({ ...result, decision });
    } catch (error) {
      sendError(fastify as any, reply as any, error, "Failed to evaluate claim");
    }
  });

  // GET /decisions — list persisted decisions
  fastify.get("/", async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const decisions = await service.listDecisions(companyId);
      reply.send({ decisions });
    } catch (error) {
      sendError(fastify as any, reply as any, error, "Failed to list decisions");
    }
  });

  // GET /decisions/learning/metrics — learning analytics
  fastify.get("/learning/metrics", async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const metrics = await learningService.getMetrics(companyId);
      reply.send(metrics);
    } catch (error) {
      sendError(fastify as any, reply as any, error, "Failed to compute learning metrics");
    }
  });

  // GET /decisions/:id — decision + full evidence context
  fastify.get("/:id", async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { id } = req.params as { id: string };

      const context = await repository.buildDecisionContext(id, companyId);
      if (!context) {
        reply.code(404).send({ error: "Decision not found" });
        return;
      }
      reply.send(context);
    } catch (error) {
      sendError(fastify as any, reply as any, error, "Failed to fetch decision");
    }
  });

  // POST /decisions/:id/review — human review workflow
  fastify.post("/:id/review", async (req, reply) => {
    try {
      const userInfo = ActivityService.getUserInfo(req);
      const companyId = (req as AuthenticatedRequest).companyId;
      const { id } = req.params as { id: string };
      const { action, comments } = reviewSchema.parse(req.body);

      const record = await service.reviewDecision(
        id,
        action,
        userInfo.userId || "system",
        comments
      );

      await ActivityService.logUpdate({
        companyId,
        userId: userInfo.userId,
        userName: userInfo.userName,
        entityType: "decision",
        entityId: id,
        entityName: `Decision ${id}`,
        description: `Decision ${action.toLowerCase().replace("_", " ")}`,
        newValues: { humanReviewStatus: action, comments },
        ipAddress: userInfo.ipAddress,
      });

      reply.send({ success: true, decision: record });
    } catch (error) {
      sendError(fastify as any, reply as any, error, "Failed to review decision");
    }
  });

  // POST /decisions/:id/regenerate — re-run the pipeline (new version)
  fastify.post("/:id/regenerate", async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { id } = req.params as { id: string };

      const existing = await repository.getDecision(id, companyId);
      if (!existing) {
        reply.code(404).send({ error: "Decision not found" });
        return;
      }

      const result = await service.analyzeClaim(existing.claimId, companyId);
      reply.send(result);
    } catch (error) {
      sendError(fastify as any, reply as any, error, "Failed to regenerate decision");
    }
  });

  // POST /decisions/voice/ask — grounded voice Q&A
  fastify.post("/voice/ask", async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { claimId, question } = voiceSchema.parse(req.body);

      const explanation = await voiceService.ask(claimId, companyId, question, repository);
      reply.send(explanation);
    } catch (error) {
      sendError(fastify as any, reply as any, error, "Failed to generate voice explanation");
    }
  });

  // GET /decisions/:id/export — structured export package (JSON or markdown)
  fastify.get("/:id/export", async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const { id } = req.params as { id: string };
      const format = ((req.query as any)?.format ?? "json") as string;

      const context = await repository.buildDecisionContext(id, companyId);
      if (!context) {
        reply.code(404).send({ error: "Decision not found" });
        return;
      }

      const pkg = buildExportPackage(context);
      if (format === "markdown") {
        reply.header("Content-Type", "text/markdown; charset=utf-8");
        reply.header(
          "Content-Disposition",
          `attachment; filename="${pkg.packageId}.md"`
        );
        reply.send(exportPackageToMarkdown(pkg));
        return;
      }

      reply.send({ package: pkg, markdown: exportPackageToMarkdown(pkg) });
    } catch (error) {
      sendError(fastify as any, reply as any, error, "Failed to export decision package");
    }
  });

  // POST /decisions/outcomes — record claim-completion outcome (learning)
  fastify.post("/outcomes", async (req, reply) => {
    try {
      const companyId = (req as AuthenticatedRequest).companyId;
      const body = outcomeSchema.parse(req.body);

      const outcome = await learningService.recordOutcome({
        organizationId: companyId,
        ...body,
      });
      reply.send({ success: true, outcome });
    } catch (error) {
      sendError(fastify as any, reply as any, error, "Failed to record outcome");
    }
  });
};
