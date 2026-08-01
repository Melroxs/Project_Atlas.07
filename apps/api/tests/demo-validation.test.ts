// ==========================================================
// Atlas
// apps/api/tests/demo-validation.test.ts
// End-to-end demo workflow validation (Phase 4)
// ==========================================================
//
// Validates the complete demo chain using the pure domain engine
// and in-memory fakes (no DB required):
//
//   claim → pipeline (evidence, confidence, risk, compliance,
//   recommendations) → human review → export package → voice
//   explanation (grounded fallback).
//
// Mirrors the DB-backed flow: the repository fake stands in for
// the drizzle DecisionRepository.

import {
  DecisionPipeline,
  DecisionEngine,
  DecisionService,
  buildExportPackage,
  exportPackageToMarkdown,
  VoiceService,
  GroundedTextProvider,
  computeLearningMetrics,
  type DecisionPipelineInput,
  type DecisionRecord,
  type DecisionStore,
  type VoiceProvider,
  type VoiceGenerationRequest,
  type VoiceGenerationResponse,
} from "../../../packages/domain/decision";

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
    dateOfLoss: "2025-03-01",
    causeOfLoss: "Hail Damage",
    status: "approved",
    estimatedValue: 28500,
    deductible: 2500,
    customerName: "John Mitchell",
  },
  documents: [
    { id: "doc-1", type: "POLICY", name: "policy.pdf", confidence: 0.95 },
    { id: "doc-2", type: "REPORT", name: "inspection.pdf", confidence: 0.9 },
  ],
  interviews: [
    { id: "int-1", status: "completed", templateName: "FNOL", progress: 100 },
  ],
  supplements: [
    {
      id: "sup-1",
      supplementNumber: "SUP-001",
      status: "submitted",
      requestedAmount: 4200,
      lineItems: [
        { description: "Roof decking", quantity: 40, unitPrice: 8, total: 320 },
      ],
    },
  ],
  activity: [
    { id: "act-1", type: "inspection_completed", description: "Inspection done" },
  ],
  aiRecommendations: [
    {
      id: "ai-1",
      description: "Replace roof flashing (supported by photo evidence)",
      category: "ROOF",
      amount: 1250,
      confidence: 0.82,
      evidence: ["photo-1"],
    },
  ],
};

// ==========================================================
// IN-MEMORY STORE (stands in for the drizzle repository)
// ==========================================================

class InMemoryStore implements DecisionStore {
  records: DecisionRecord[] = [];

  async saveDecision(
    _input: DecisionPipelineInput,
    result: any
  ): Promise<DecisionRecord> {
    const record: DecisionRecord = {
      id: `decision-${this.records.length + 1}`,
      organizationId: _input.organizationId,
      claimId: _input.claimId,
      version: this.records.filter((r) => r.claimId === _input.claimId).length + 1,
      decisionType: result.recommendations[0]?.type ?? "CLAIM_REVIEW",
      status: "GENERATED",
      title: result.recommendations[0]?.title ?? "Claim Analysis",
      description: result.explanation,
      recommendation: result.recommendations[0]?.description ?? result.explanation,
      confidenceScore: result.confidence.value,
      riskScore: result.risk.score,
      priority: result.recommendations[0]?.priority ?? "MEDIUM",
      evidenceSummary: result.evidence,
      evidenceNodes: [
        {
          id: "doc-1",
          nodeType: "DOCUMENT",
          sourceType: "DOCUMENT_AI",
          sourceId: "doc-1",
          title: "policy.pdf",
          confidenceScore: 0.95,
        },
        {
          id: "doc-2",
          nodeType: "DOCUMENT",
          sourceType: "DOCUMENT_AI",
          sourceId: "doc-2",
          title: "inspection.pdf",
          confidenceScore: 0.9,
        },
      ],
      recommendations: result.recommendations,
      missingEvidence: result.missingEvidence,
      reasoningTrace: result.reasoningTrace,
      complianceStatus: result.compliance.status,
      complianceScore: result.compliance.score,
      humanReviewStatus: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.records.push(record);
    return record;
  }

  async getLatestDecision(
    claimId: string,
    _organizationId: string
  ): Promise<DecisionRecord | null> {
    const matches = this.records
      .filter((r) => r.claimId === claimId)
      .sort((a, b) => b.version - a.version);
    return matches[0] ?? null;
  }

  async listDecisions(_organizationId: string): Promise<DecisionRecord[]> {
    return this.records;
  }

  async updateHumanReviewStatus(
    decisionId: string,
    status: DecisionRecord["humanReviewStatus"]
  ): Promise<DecisionRecord | null> {
    const record = this.records.find((r) => r.id === decisionId);
    if (!record) return null;
    record.humanReviewStatus = status;
    record.status =
      status === "APPROVED" ? "APPROVED" : status === "REJECTED" ? "REJECTED" : "UNDER_REVIEW";
    return record;
  }
}

// ==========================================================
// FAKE CONTEXT SOURCE
// ==========================================================

class FakeContextSource {
  async loadContext(claimId: string, organizationId: string) {
    return { ...pipelineInput, claimId, organizationId };
  }
}

// ==========================================================
// PHASE 4 — END-TO-END WORKFLOW
// ==========================================================

describe("Demo workflow (end-to-end)", () => {
  it("runs the full chain: pipeline → review → export → voice", async () => {
    const store = new InMemoryStore();
    const engine = new DecisionEngine(new DecisionPipeline(), store);

    // 1. Decision Engine runs
    const result = await engine.analyze(pipelineInput);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.sufficientEvidence).toBe(true);
    expect(result.compliance.status).toBeDefined();
    expect(result.requiresHumanApproval).toBe(true);

    // 2. The store persisted it
    const latest = await store.getLatestDecision("claim-1", "org-1");
    expect(latest).not.toBeNull();
    expect(latest!.version).toBe(1);

    // 3. Human review approves
    const reviewed = await store.updateHumanReviewStatus(latest!.id, "APPROVED");
    expect(reviewed!.humanReviewStatus).toBe("APPROVED");

    // 4. Export package is built from the decision context
    const context = {
      decision: latest!,
      score: null,
      evidence: [],
      risks: [],
      actions: [],
      approvals: [
        {
          id: "approval-1",
          decisionId: latest!.id,
          reviewerId: "user-1",
          approvalStatus: "APPROVED" as const,
          comments: "Looks good",
          createdAt: new Date(),
        },
      ],
      reasoning: [],
    };
    const pkg = buildExportPackage(context);
    expect(pkg.packageId).toContain("v1");
    expect(pkg.recommendations?.length ?? 0).toBeGreaterThan(0);
    expect(pkg.reviewHistory.length).toBe(1);
    const md = exportPackageToMarkdown(pkg);
    expect(md).toContain("# Atlas Decision Package");
    expect(md).toContain("Recommendations");

    // 5. Atlas Voice explains with the grounded fallback (no API key)
    const voice = new VoiceService();
    const explanation = await voice.ask(
      "claim-1",
      "org-1",
      "Why did Atlas recommend this?",
      store
    );
    expect(explanation.grounded).toBe(true);
    expect(explanation.answer.length).toBeGreaterThan(50);
    expect(explanation.sources.decisionId).toBe(latest!.id);
    expect(explanation.sources.version).toBe(1);
  });

  it("produces a second version on regenerate — never overwrites", async () => {
    const store = new InMemoryStore();
    const service = new DecisionService(
      store as any,
      new FakeContextSource() as any
    );

    await service.analyzeClaim("claim-1", "org-1");
    await service.analyzeClaim("claim-1", "org-1");

    const versions = store.records.filter((r) => r.claimId === "claim-1");
    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe(1);
    expect(versions[1].version).toBe(2);
  });

  it("records learning outcomes and computes metrics", async () => {
    const store = new InMemoryStore();
    const service = new DecisionService(
      store as any,
      new FakeContextSource() as any
    );
    await service.analyzeClaim("claim-1", "org-1");

    const metrics = computeLearningMetrics([
      { adjusterOutcome: "APPROVED", confidenceAccuracy: 0.8 },
      { adjusterOutcome: "DENIED", confidenceAccuracy: 0.95 },
    ]);
    expect(metrics.recommendationAccuracy.total).toBe(2);
    expect(metrics.confidenceCalibration.overconfident).toBe(true);
  });
});

// ==========================================================
// VOICE FALLBACK (Phase 2)
// ==========================================================

class FailingProvider implements VoiceProvider {
  async generate(): Promise<VoiceGenerationResponse> {
    throw new Error("upstream unavailable");
  }
  isConfigured(): boolean {
    return true;
  }
  getProviderName(): string {
    return "failing";
  }
}

describe("Voice fallback", () => {
  it("falls back to grounded text when the provider throws", async () => {
    const store = new InMemoryStore();
    const engine = new DecisionEngine(new DecisionPipeline(), store);
    await engine.analyze(pipelineInput);

    const voice = new VoiceService(new FailingProvider());
    const explanation = await voice.ask(
      "claim-1",
      "org-1",
      "What evidence supports this?",
      store
    );
    expect(explanation.grounded).toBe(true);
    expect(explanation.provider).toBe("grounded-text");
    expect(explanation.answer).toContain("policy.pdf");
  });

  it("grounded provider always works without configuration", async () => {
    const store = new InMemoryStore();
    const engine = new DecisionEngine(new DecisionPipeline(), store);
    await engine.analyze(pipelineInput);
    const decision = (await store.getLatestDecision("claim-1", "org-1"))!;

    const provider = new GroundedTextProvider();
    expect(provider.isConfigured()).toBe(true);
    const response = await provider.generate({
      question: "What is the confidence?",
      systemPrompt: "",
      context: {
        claimId: "claim-1",
        claimNumber: "CLM-20240001",
        decision,
        recommendations: decision.recommendations ?? [],
        evidenceNodes: decision.evidenceNodes ?? [],
        evidenceSummary: decision.evidenceSummary,
        missingEvidence: decision.missingEvidence ?? [],
        compliance: { status: decision.complianceStatus, score: decision.complianceScore },
        reasoningStages: decision.reasoningTrace?.map((t) => t.stage) ?? [],
      },
    });
    expect(response.grounded).toBe(true);
    expect(response.provider).toBe("grounded-text");
    expect(response.answer).toContain("confidence");
  });
});

// ==========================================================
// EXPORT PACKAGE (Phase 3)
// ==========================================================

describe("Export package", () => {
  it("marks the package as requiring human approval before final", async () => {
    const store = new InMemoryStore();
    const engine = new DecisionEngine(new DecisionPipeline(), store);
    const result = await engine.analyze(pipelineInput);
    const latest = (await store.getLatestDecision("claim-1", "org-1"))!;
    const pkg = buildExportPackage({
      decision: latest,
      score: null,
      evidence: [],
      risks: [],
      actions: [],
      approvals: [],
      reasoning: [],
    });

    expect(pkg.decision.humanReviewStatus).toBe("PENDING");
    expect(result.requiresHumanApproval).toBe(true);
    expect(pkg.decision.confidenceScore).toBe(result.confidence.value);
    expect(pkg.evidence.summary?.totalEvidence).toBeGreaterThan(0);
  });
});
