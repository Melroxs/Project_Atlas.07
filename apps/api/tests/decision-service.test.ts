// ==========================================================
// Atlas
// apps/api/tests/decision-service.test.ts
// DecisionService unit tests (P3)
// ==========================================================

import {
  DecisionService,
  DecisionPipeline,
  type DecisionPipelineInput,
  type DecisionRecord,
} from "../../../packages/domain/decision";

// ==========================================================
// FAKES
// ==========================================================

const pipelineInput: DecisionPipelineInput = {
  claimId: "claim-1",
  organizationId: "org-1",
  claim: {
    claimNumber: "CLM-20240001",
    causeOfLoss: "Hail Damage",
    estimatedValue: 28500,
    deductible: 2500,
  },
  documents: [{ id: "doc-1", type: "POLICY", name: "policy.pdf", confidence: 0.95 }],
  interviews: [{ id: "int-1", status: "completed", templateName: "FNOL" }],
  supplements: [],
  activity: [],
  aiRecommendations: [
    { id: "ai-1", description: "Replace roof flashing", category: "ROOF", amount: 1250, confidence: 0.82 },
  ],
};

const fakeRecord: DecisionRecord = {
  id: "dec-1",
  organizationId: "org-1",
  claimId: "claim-1",
  claimNumber: "CLM-20240001",
  version: 1,
  decisionType: "SUPPLEMENT_OPPORTUNITY",
  status: "GENERATED",
  title: "Replace roof flashing",
  description: "x",
  recommendation: "x",
  confidenceScore: 0.78,
  riskScore: 25,
  priority: "HIGH",
  humanReviewStatus: "PENDING",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeFakeRepo(overrides: any = {}) {
  return {
    saveDecision: jest.fn().mockResolvedValue(fakeRecord),
    getLatestDecision: jest.fn().mockResolvedValue(fakeRecord),
    listDecisions: jest.fn().mockResolvedValue([fakeRecord]),
    updateHumanReviewStatus: jest.fn().mockResolvedValue(fakeRecord),
    createDecision: jest.fn().mockResolvedValue(fakeRecord),
    updateDecisionStatus: jest.fn().mockResolvedValue(fakeRecord),
    createApproval: jest.fn().mockResolvedValue({
      id: "approval-1",
      decisionId: "dec-1",
      reviewerId: "user-1",
      approvalStatus: "APPROVED",
      createdAt: new Date(),
    }),
    getDecision: jest.fn().mockResolvedValue(fakeRecord),
    buildDecisionContext: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

class FakeContextSource {
  loadContext = jest.fn().mockImplementation(async (claimId: string, organizationId: string) => {
    return { ...pipelineInput, claimId, organizationId };
  });
}

// ==========================================================
// TESTS
// ==========================================================

describe("DecisionService", () => {
  it("analyzeClaim throws when no context source is injected", async () => {
    const repo = makeFakeRepo();
    const service = new DecisionService(repo as any);
    await expect(service.analyzeClaim("claim-1", "org-1")).rejects.toThrow(
      "requires a DecisionContextSource"
    );
  });

  it("createSupplementDecision does NOT double-persist (single decision record)", async () => {
    const repo = makeFakeRepo();
    const service = new DecisionService(repo as any, new FakeContextSource() as any);

    const outcome = await service.createSupplementDecision("claim-1", "org-1", "user-1");

    // The pipeline result is persisted exactly once by the engine's store.
    expect(repo.saveDecision).toHaveBeenCalledTimes(1);
    // It must NOT insert a second decision row.
    expect(repo.createDecision).not.toHaveBeenCalled();
    // It returns the persisted decision + the supplement recommendation.
    expect(outcome.decision).toBe(fakeRecord);
    expect(outcome.supplement).not.toBeNull();
    expect(outcome.result.recommendations.length).toBeGreaterThan(0);
  });

  it("evaluateContext runs the pipeline and persists via the store", async () => {
    const repo = makeFakeRepo();
    const service = new DecisionService(repo as any, new FakeContextSource() as any);

    const result = await service.evaluateContext(pipelineInput);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(repo.saveDecision).toHaveBeenCalledTimes(1);
  });

  it("reviewDecision delegates to repository.updateHumanReviewStatus", async () => {
    const repo = makeFakeRepo();
    const service = new DecisionService(repo as any, new FakeContextSource() as any);

    await service.reviewDecision("dec-1", "APPROVED", "user-1", "looks good");
    expect(repo.updateHumanReviewStatus).toHaveBeenCalledWith(
      "dec-1",
      "APPROVED",
      "user-1",
      "looks good"
    );
  });

  it("approveDecision updates status and records an approval", async () => {
    const repo = makeFakeRepo();
    const service = new DecisionService(repo as any, new FakeContextSource() as any);

    await service.approveDecision("dec-1", "user-1", "ok");
    expect(repo.updateDecisionStatus).toHaveBeenCalledWith("dec-1", "APPROVED");
    expect(repo.createApproval).toHaveBeenCalledWith(
      expect.objectContaining({ approvalStatus: "APPROVED", reviewerId: "user-1" })
    );
  });

  it("rejectDecision updates status and records a rejection", async () => {
    const repo = makeFakeRepo();
    const service = new DecisionService(repo as any, new FakeContextSource() as any);

    await service.rejectDecision("dec-1", "user-1", "insufficient evidence");
    expect(repo.updateDecisionStatus).toHaveBeenCalledWith("dec-1", "REJECTED");
    expect(repo.createApproval).toHaveBeenCalledWith(
      expect.objectContaining({ approvalStatus: "REJECTED", comments: "insufficient evidence" })
    );
  });

  it("regenerating via the pipeline produces a NEW version (never overwrite)", async () => {
    const repo = makeFakeRepo();
    const service = new DecisionService(repo as any, new FakeContextSource() as any);

    await service.analyzeClaim("claim-1", "org-1");
    await service.analyzeClaim("claim-1", "org-1");

    // Two pipeline executions -> two persisted rows.
    expect(repo.saveDecision).toHaveBeenCalledTimes(2);
  });

  it("works with a custom pipeline (DI)", async () => {
    const repo = makeFakeRepo();
    const service = new DecisionService(repo as any, new FakeContextSource() as any, new DecisionPipeline());
    const result = await service.evaluateContext(pipelineInput);
    expect(result.claimId).toBe("claim-1");
  });
});
