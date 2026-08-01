// ==========================================================
// Atlas
// apps/api/tests/decision-routes.test.ts
// Fastify decision routes tests (P3) — all dependencies mocked,
// no live DB required.
// ==========================================================

// Shared mock instances (jest allows `mock`-prefixed variables inside
// jest.mock factories). The routes plugin constructs these classes at
// register time; returning the SAME shared objects here means tests can
// stub methods directly instead of fishing through mock.instances
// (which only records the bare `this`, not the returned object).
const mockDecisionService = {
  analyzeClaim: jest.fn(),
  reviewDecision: jest.fn(),
  listDecisions: jest.fn(),
};
const mockDecisionRepository = {
  getLatestDecision: jest.fn(),
  getDecision: jest.fn(),
  buildDecisionContext: jest.fn(),
  listDecisions: jest.fn(),
  recordOutcome: jest.fn(),
};
const mockVoiceService = { ask: jest.fn() };
const mockBuildExportPackage = jest.fn();
const mockExportPackageToMarkdown = jest.fn();

jest.mock("../../../packages/domain/decision", () => ({
  DecisionService: jest.fn(() => mockDecisionService),
  DecisionRepository: jest.fn(() => mockDecisionRepository),
  DecisionContextSource: jest.fn(),
  VoiceService: jest.fn(() => mockVoiceService),
  buildExportPackage: mockBuildExportPackage,
  exportPackageToMarkdown: mockExportPackageToMarkdown,
}));

const mockDecisionContextCollector = {
  loadContext: jest.fn(),
};
jest.mock("../src/lib/decision-context", () => ({
  DecisionContextCollector: jest.fn(() => mockDecisionContextCollector),
}));

const mockLearningService = {
  getMetrics: jest.fn(),
  recordOutcome: jest.fn(),
};
jest.mock("../src/lib/decision-learning", () => ({
  DecisionLearningService: jest.fn(() => mockLearningService),
}));

jest.mock("../src/lib/activity", () => ({
  ActivityService: {
    getUserInfo: jest.fn().mockReturnValue({
      userId: "user-1",
      userName: "User",
      ipAddress: "127.0.0.1",
    }),
    logCreate: jest.fn().mockResolvedValue(undefined),
    logUpdate: jest.fn().mockResolvedValue(undefined),
  },
}));

import Fastify from "fastify";
import { decisionRoutes } from "../src/routes/decisions";
import { ActivityService } from "../src/lib/activity";
const ActivityServiceMock = ActivityService as any;

const VALID_CLAIM_ID = "11111111-2222-3333-4444-555555555555";

const pipelineResult = {
  claimId: VALID_CLAIM_ID,
  organizationId: "org-1",
  generatedAt: new Date().toISOString(),
  evidence: { totalEvidence: 2, coverage: 0.5, byType: {}, bySource: {}, averageConfidence: 0.9, requiredTypes: [], presentTypes: [], missingTypes: [] },
  confidence: { value: 0.78, label: "HIGH", factors: [], details: { evidenceConfidence: 0.7 } },
  risk: { score: 25, level: "MODERATE", factors: [] },
  recommendations: [
    {
      id: "rec-1",
      type: "SUPPLEMENT_OPPORTUNITY",
      title: "Replace roof flashing",
      description: "Supported by photo evidence",
      confidence: 0.82,
      priority: "HIGH",
      supportingEvidenceIds: ["doc-1"],
      missingEvidenceIds: [],
      suggestedActions: ["SUBMIT_SUPPLEMENT"],
      requiresHumanApproval: true,
      rulesApplied: ["SUP-002"],
    },
  ],
  missingEvidence: [],
  compliance: { status: "READY", score: 90, ruleResults: [], violations: [] },
  sufficientEvidence: true,
  requiresHumanApproval: true,
  explanation: "Claim analyzed.",
  reasoningTrace: [],
};

const decisionRecord = {
  id: "dec-1",
  organizationId: "org-1",
  claimId: VALID_CLAIM_ID,
  claimNumber: "CLM-20240001",
  version: 1,
  decisionType: "SUPPLEMENT_OPPORTUNITY",
  status: "GENERATED",
  title: "Replace roof flashing",
  confidenceScore: 0.78,
  riskScore: 25,
  priority: "HIGH",
  humanReviewStatus: "PENDING",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

async function buildApp() {
  const app = Fastify();
  app.addHook("onRequest", async (req: any) => {
    req.companyId = "org-1";
    req.userId = "user-1";
  });
  await app.register(decisionRoutes, { prefix: "/decisions" });
  await app.ready();
  return app;
}

describe("Decision routes (Fastify)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default implementations after clearAllMocks.
    ActivityServiceMock.getUserInfo.mockReturnValue({
      userId: "user-1",
      userName: "User",
      ipAddress: "127.0.0.1",
    });
    ActivityServiceMock.logCreate.mockResolvedValue(undefined);
    ActivityServiceMock.logUpdate.mockResolvedValue(undefined);
    mockLearningService.getMetrics.mockResolvedValue({});
    mockLearningService.recordOutcome.mockResolvedValue({ id: "outcome-1" });
  });

  it("POST /evaluate runs the engine and returns the persisted decision", async () => {
    const app = await buildApp();
    mockDecisionService.analyzeClaim.mockResolvedValue(pipelineResult);
    mockDecisionRepository.getLatestDecision.mockResolvedValue(decisionRecord);

    const res = await app.inject({
      method: "POST",
      url: "/decisions/evaluate",
      payload: { claimId: VALID_CLAIM_ID },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.decision.id).toBe("dec-1");
    expect(body.recommendations[0].title).toBe("Replace roof flashing");
    expect(mockDecisionService.analyzeClaim).toHaveBeenCalledWith(VALID_CLAIM_ID, "org-1");
    expect(ActivityServiceMock.logCreate).toHaveBeenCalled();
    await app.close();
  });

  it("POST /evaluate returns 400 on invalid body (no 500 for client errors)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/decisions/evaluate",
      payload: { claimId: "not-a-uuid" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("GET / lists decisions", async () => {
    const app = await buildApp();
    mockDecisionService.listDecisions.mockResolvedValue([decisionRecord]);
    const res = await app.inject({ method: "GET", url: "/decisions/" });
    expect(res.statusCode).toBe(200);
    expect(res.json().decisions).toHaveLength(1);
    await app.close();
  });

  it("GET /:id returns full context", async () => {
    const app = await buildApp();
    mockDecisionRepository.buildDecisionContext.mockResolvedValue({ decision: decisionRecord });
    const res = await app.inject({ method: "GET", url: "/decisions/dec-1" });
    expect(res.statusCode).toBe(200);
    expect(res.json().decision.id).toBe("dec-1");
    await app.close();
  });

  it("GET /:id returns 404 when the decision does not exist", async () => {
    const app = await buildApp();
    mockDecisionRepository.buildDecisionContext.mockResolvedValue(null);
    const res = await app.inject({ method: "GET", url: "/decisions/missing" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("POST /:id/review approves and records activity", async () => {
    const app = await buildApp();
    mockDecisionService.reviewDecision.mockResolvedValue({
      ...decisionRecord,
      humanReviewStatus: "APPROVED",
    });
    const res = await app.inject({
      method: "POST",
      url: "/decisions/dec-1/review",
      payload: { action: "APPROVED", comments: "ok" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().decision.humanReviewStatus).toBe("APPROVED");
    expect(ActivityServiceMock.logUpdate).toHaveBeenCalled();
    await app.close();
  });

  it("POST /voice/ask returns a grounded explanation", async () => {
    const app = await buildApp();
    mockVoiceService.ask.mockResolvedValue({
      answer: "Grounded answer",
      provider: "grounded-text",
      grounded: true,
      sources: { decisionId: "dec-1", version: 1, claimId: VALID_CLAIM_ID, confidence: 0.78, risk: 25, evidenceCount: 2, reasoningStages: [] },
    });
    const res = await app.inject({
      method: "POST",
      url: "/decisions/voice/ask",
      payload: { claimId: VALID_CLAIM_ID, question: "Why this recommendation?" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().grounded).toBe(true);
    expect(mockVoiceService.ask).toHaveBeenCalled();
    await app.close();
  });

  it("GET /:id/export returns JSON package and markdown", async () => {
    const app = await buildApp();
    mockDecisionRepository.buildDecisionContext.mockResolvedValue({ decision: decisionRecord });
    mockBuildExportPackage.mockReturnValue({ packageId: "PKG-1", claimId: VALID_CLAIM_ID, version: 1 });
    mockExportPackageToMarkdown.mockReturnValue("# Atlas Decision Package");

    const json = await app.inject({ method: "GET", url: "/decisions/dec-1/export" });
    expect(json.statusCode).toBe(200);
    expect(json.json().package.packageId).toBe("PKG-1");

    const md = await app.inject({ method: "GET", url: "/decisions/dec-1/export?format=markdown" });
    expect(md.statusCode).toBe(200);
    expect(md.headers["content-type"]).toContain("text/markdown");
    expect(md.body).toContain("# Atlas Decision Package");
    await app.close();
  });

  it("GET /:id/export returns 404 when the decision does not exist", async () => {
    const app = await buildApp();
    mockDecisionRepository.buildDecisionContext.mockResolvedValue(null);
    const res = await app.inject({ method: "GET", url: "/decisions/dec-1/export" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("POST /outcomes records a learning outcome", async () => {
    const app = await buildApp();
    mockLearningService.recordOutcome.mockResolvedValue({ id: "outcome-1" });
    const res = await app.inject({
      method: "POST",
      url: "/decisions/outcomes",
      payload: {
        claimId: VALID_CLAIM_ID,
        adjusterOutcome: "APPROVED",
        amountApproved: 1250,
        confidenceAccuracy: 0.8,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    await app.close();
  });

  it("POST /outcomes returns 400 on invalid body", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/decisions/outcomes",
      payload: { claimId: "nope" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("GET /learning/metrics computes analytics", async () => {
    const app = await buildApp();
    mockLearningService.getMetrics.mockResolvedValue({ recommendationAccuracy: { total: 3 } });
    const res = await app.inject({ method: "GET", url: "/decisions/learning/metrics" });
    expect(res.statusCode).toBe(200);
    expect(res.json().recommendationAccuracy.total).toBe(3);
    await app.close();
  });
});
