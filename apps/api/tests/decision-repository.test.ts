// ==========================================================
// Atlas
// apps/api/tests/decision-repository.test.ts
// DecisionRepository unit tests (P3) — pure mappers + persistence
// behavior via a mocked @project-atlas/database (no live DB).
// ==========================================================

jest.mock("@project-atlas/database", () => {
  const state: any = {
    selectResults: [] as any[],
    returningQueue: [] as any[],
    deleteCalls: [] as any[],
    inserts: [] as any[],
    executed: [] as any[],
    updateSets: [] as any[],
  };

  // The repository always destructures `const [row] = await ...` / iterates
  // `rows[0]`, so every resolved value must be an ARRAY of rows. The test
  // queues single rows; wrap them consistently.
  function asRows(item: any): any[] {
    if (item === undefined) return [];
    return Array.isArray(item) ? item : [item];
  }

  function chain(opts: { returning?: boolean } = {}) {
    const c: any = {
      from: () => c,
      where: () => c,
      limit: () => c,
      orderBy: () => c,
      set: (v: any) => {
        state.updateSets.push(v);
        return c;
      },
      values: () => c,
      returning: async () => asRows(state.returningQueue.shift()),
      execute: async () => {},
      then: (resolve: any) => resolve(asRows(state.selectResults.shift())),
      catch: (reject: any) => Promise.reject(reject),
    };
    return c;
  }

  const db: any = {
    __state: state,
    transaction: async (fn: any) => fn(db),
    execute: async (s: any) => {
      state.executed.push(s);
    },
    select: jest.fn(() => chain()),
    insert: jest.fn((t: any) => {
      state.inserts.push(`insert:${t}`);
      return chain({ returning: true });
    }),
    update: jest.fn(() => chain({ returning: true })),
    delete: jest.fn((t: any) => {
      state.deleteCalls.push(t);
      return chain();
    }),
  };

  return {
    db,
    pool: {},
    decisions: "decisions",
    decisionScores: "decisionScores",
    decisionEvidenceLinks: "decisionEvidenceLinks",
    decisionRisks: "decisionRisks",
    decisionActions: "decisionActions",
    decisionApprovals: "decisionApprovals",
    decisionReasoningLogs: "decisionReasoningLogs",
    decisionOutcomes: "decisionOutcomes",
  };
});

import {
  DecisionRepository,
  DecisionPipeline,
  toDecisionRecord,
  mapScoreRow,
  evidenceNodesFromInput,
  mapStageToReasoningType,
  type DecisionPipelineInput,
} from "../../../packages/domain/decision";
import { db as mockedDb } from "@project-atlas/database";

// ==========================================================
// FIXTURES
// ==========================================================

const pipelineInput: DecisionPipelineInput = {
  claimId: "claim-1",
  organizationId: "org-1",
  claim: {
    claimNumber: "CLM-20240001",
    insuranceCompany: "State Farm",
    policyNumber: "POL-123456",
    causeOfLoss: "Hail Damage",
    status: "approved",
    estimatedValue: 28500,
    deductible: 2500,
  },
  documents: [{ id: "doc-1", type: "POLICY", name: "policy.pdf", confidence: 0.95 }],
  interviews: [{ id: "int-1", status: "completed", templateName: "FNOL", progress: 100 }],
  supplements: [
    { id: "sup-1", supplementNumber: "SUP-001", status: "submitted", requestedAmount: 4200 },
  ],
  activity: [{ id: "act-1", type: "inspection_completed" }],
  aiRecommendations: [
    { id: "ai-1", description: "Replace roof flashing", category: "ROOF", amount: 1250, confidence: 0.82 },
  ],
};

function decisionRow(overrides: any = {}) {
  return {
    id: "dec-1",
    companyId: "org-1",
    claimId: "claim-1",
    claimNumber: "CLM-20240001",
    version: 1,
    decisionType: "SUPPLEMENT_OPPORTUNITY",
    status: "GENERATED",
    title: "Replace roof flashing",
    description: "explanation",
    recommendation: "explanation",
    confidenceScore: "0.78",
    riskScore: "25",
    priority: "HIGH",
    evidenceSummary: {},
    evidenceNodes: [],
    recommendations: [],
    missingEvidence: [],
    reasoningTrace: [],
    riskFactors: [],
    complianceStatus: "READY",
    complianceScore: "90",
    humanReviewStatus: "PENDING",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function scoreRow(overrides: any = {}) {
  return {
    id: "score-1",
    decisionId: "dec-1",
    evidenceScore: "0.7",
    coverageScore: "0.5",
    complianceScore: "90",
    riskFactorScore: "25",
    finalScore: "0.78",
    calculationDetails: {},
    createdAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ==========================================================
// PURE MAPPER TESTS
// ==========================================================

describe("DecisionRepository — pure mappers", () => {
  it("toDecisionRecord maps numeric strings + voice context fields", () => {
    const rec = toDecisionRecord(
      decisionRow({
        confidenceScore: "0.82",
        riskScore: "37",
        claimNumber: "CLM-77",
        riskFactors: [{ type: "COMPLIANCE_FAILURE", severity: "HIGH", description: "x", points: 40 }],
      })
    );
    expect(rec.confidenceScore).toBe(0.82);
    expect(rec.riskScore).toBe(37);
    expect(rec.claimNumber).toBe("CLM-77");
    expect(rec.riskFactors).toHaveLength(1);
    expect(rec.humanReviewStatus).toBe("PENDING");
    expect(rec.createdAt).toBeInstanceOf(Date);
  });

  it("mapScoreRow converts numeric strings consistently (same as createScore)", () => {
    const row = scoreRow({
      evidenceScore: "0.9",
      coverageScore: "0.75",
      complianceScore: "100",
      riskFactorScore: "10",
      finalScore: "0.85",
    });
    const mapped = mapScoreRow(row);
    expect(mapped.evidenceScore).toBe(0.9);
    expect(mapped.coverageScore).toBe(0.75);
    expect(mapped.complianceScore).toBe(100);
    expect(mapped.riskFactorScore).toBe(10);
    expect(mapped.finalScore).toBe(0.85);
    expect(mapped.createdAt).toBeInstanceOf(Date);
  });

  it("mapScoreRow handles null numeric columns", () => {
    const mapped = mapScoreRow({ ...scoreRow(), evidenceScore: null, finalScore: null });
    expect(mapped.evidenceScore).toBe(0);
    expect(mapped.finalScore).toBe(0);
  });

  it("evidenceNodesFromInput creates nodes for all source kinds", () => {
    const nodes = evidenceNodesFromInput(pipelineInput);
    const types = nodes.map((n) => n.nodeType);
    expect(types).toContain("DOCUMENT");
    expect(types).toContain("INTERVIEW");
    expect(types).toContain("ESTIMATE_ITEM");
    expect(types).toContain("RECOMMENDATION");
    const aiNode = nodes.find((n) => n.nodeType === "RECOMMENDATION")!;
    expect(aiNode.sourceType).toBe("DOCUMENT_AI");
    expect(aiNode.confidenceScore).toBe(0.82);
  });

  it("mapStageToReasoningType maps stages to reasoning types", () => {
    expect(mapStageToReasoningType("COLLECT_EVIDENCE")).toBe("EVIDENCE_ANALYSIS");
    expect(mapStageToReasoningType("EVALUATE_COMPLIANCE")).toBe("COMPLIANCE_CHECK");
    expect(mapStageToReasoningType("CALCULATE_CONFIDENCE")).toBe("SUPPLEMENT_ANALYSIS");
    expect(mapStageToReasoningType("PUBLISH_DECISION")).toBe("RISK_ASSESSMENT");
  });
});

// ==========================================================
// PERSISTENCE TESTS (mocked db)
// ==========================================================

describe("DecisionRepository — saveDecision (transactional, versioned)", () => {
  beforeEach(() => {
    const state = (mockedDb as any).__state;
    state.selectResults = [];
    state.returningQueue = [];
    state.deleteCalls = [];
    state.inserts = [];
    state.executed = [];
    state.updateSets = [];
  });

  it("persists decision + score + risks + reasoning in ONE transaction, never overwrites", async () => {
    const state = (mockedDb as any).__state;
    const repo = new DecisionRepository();
    const result = await new DecisionPipeline().run(pipelineInput);

    // select (nextVersion) -> max 0 => version 1
    state.selectResults = [{ maxVersion: "0" }];
    // inserts in order: decision, score, one per risk factor, one per reasoning stage.
    // The returned decision row carries the risk factors + reasoning trace that
    // saveDecision persisted, so toDecisionRecord reflects them.
    state.returningQueue = [
      decisionRow({ riskFactors: result.risk.factors, reasoningTrace: result.reasoningTrace }),
      scoreRow(),
      ...result.risk.factors.map((f, i) => ({
        id: `risk-${i}`,
        decisionId: "dec-1",
        riskType: f.type,
        severity: f.severity,
        description: f.description,
        mitigation: f.mitigation ?? "",
        createdAt: "2025-01-01T00:00:00Z",
      })),
      ...result.reasoningTrace.map((t, i) => ({
        id: `trace-${i}`,
        decisionId: "dec-1",
        reasoningType: "EVIDENCE_ANALYSIS",
        inputData: {},
        outputData: {},
        createdAt: "2025-01-01T00:00:00Z",
      })),
    ];

    const record = await repo.saveDecision(pipelineInput, result);

    expect(record.version).toBe(1);
    expect(record.claimNumber).toBe("CLM-20240001");
    expect(record.riskFactors).toHaveLength(result.risk.factors.length);

    // advisory lock executed inside the transaction (drizzle SQL object —
    // inspect via serialization to be robust to internal shape changes)
    const lockCall = state.executed.find((s: any) =>
      JSON.stringify(s).includes("pg_advisory_xact_lock")
    );
    expect(lockCall).toBeTruthy();
    // all four write families went through the same transaction client
    expect(state.inserts).toContain("insert:decisions");
    expect(state.inserts).toContain("insert:decisionScores");
    expect(state.inserts).toContain("insert:decisionRisks");
    expect(state.inserts).toContain("insert:decisionReasoningLogs");
    expect(state.inserts.filter((i: string) => i === "insert:decisionRisks")).toHaveLength(
      result.risk.factors.length
    );
    expect(
      state.inserts.filter((i: string) => i === "insert:decisionReasoningLogs")
    ).toHaveLength(result.reasoningTrace.length);
  });

  it("increments version per claim (never overwrites previous decisions)", async () => {
    const state = (mockedDb as any).__state;
    const repo = new DecisionRepository();
    const result = await new DecisionPipeline().run(pipelineInput);

    // First evaluation
    state.selectResults = [{ maxVersion: "0" }];
    state.returningQueue = [
      decisionRow({ version: 1 }),
      scoreRow(),
      ...result.risk.factors.map((f, i) => ({ id: `r${i}` })),
      ...result.reasoningTrace.map((t, i) => ({ id: `t${i}` })),
    ];
    const first = await repo.saveDecision(pipelineInput, result);
    expect(first.version).toBe(1);

    // Second evaluation — nextVersion sees max 1 => version 2
    state.selectResults = [{ maxVersion: "1" }];
    state.returningQueue = [
      decisionRow({ id: "dec-2", version: 2 }),
      scoreRow(),
      ...result.risk.factors.map((f, i) => ({ id: `r${i}` })),
      ...result.reasoningTrace.map((t, i) => ({ id: `t${i}` })),
    ];
    const second = await repo.saveDecision(pipelineInput, result);
    expect(second.version).toBe(2);
    expect(second.id).toBe("dec-2");
  });

  it("getScore returns the shared-mapped shape (numbers, not raw rows)", async () => {
    const state = (mockedDb as any).__state;
    const repo = new DecisionRepository();
    state.selectResults = [scoreRow({ evidenceScore: "0.66", finalScore: "0.72" })];
    const score = await repo.getScore("dec-1");
    expect(score).not.toBeNull();
    expect(score!.evidenceScore).toBe(0.66);
    expect(score!.finalScore).toBe(0.72);
    expect(score!.createdAt).toBeInstanceOf(Date);
  });

  it("updateHumanReviewStatus persists approval record", async () => {
    const state = (mockedDb as any).__state;
    const repo = new DecisionRepository();
    state.returningQueue = [
      decisionRow({ humanReviewStatus: "APPROVED", status: "APPROVED" }),
      { id: "approval-1", decisionId: "dec-1", reviewerId: "user-1", approvalStatus: "APPROVED", createdAt: "2025-01-01T00:00:00Z" },
    ];
    const updated = await repo.updateHumanReviewStatus("dec-1", "APPROVED", "user-1", "ok");
    expect(updated?.humanReviewStatus).toBe("APPROVED");
    expect(state.inserts).toContain("insert:decisionApprovals");
    expect(state.updateSets[0]).toMatchObject({ humanReviewStatus: "APPROVED" });
  });
});
