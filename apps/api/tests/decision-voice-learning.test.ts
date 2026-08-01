// ==========================================================
// Atlas
// apps/api/tests/decision-voice-learning.test.ts
// Unit tests: VoiceService (grounded explanations), Elemental
// voice provider adapter, and continuous-learning metrics.
// ==========================================================

import {
  VoiceService,
  ElementalVoiceProvider,
  computeLearningMetrics,
  type DecisionRecord,
  type DecisionStore,
  type VoiceProvider,
  type VoiceGenerationRequest,
  type VoiceGenerationResponse,
} from "../../../packages/domain/decision";

// ==========================================================
// FAKES
// ==========================================================

function makeRecord(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: "decision-1",
    organizationId: "org-1",
    claimId: "claim-1",
    version: 3,
    decisionType: "SUPPLEMENT_OPPORTUNITY",
    status: "GENERATED",
    title: "Replace roof flashing",
    description: "Flashing replacement is supported by photo evidence.",
    recommendation: "Add flashing replacement line item ($1,250).",
    confidenceScore: 0.82,
    riskScore: 35,
    priority: "HIGH",
    evidenceSummary: {
      totalEvidence: 3,
      byType: { PHOTO: 2, DOCUMENT: 1 },
      bySource: { COMPUTER_VISION: 2, DOCUMENT_AI: 1 },
      averageConfidence: 0.88,
      coverage: 0.8,
      requiredTypes: ["CLAIM", "DOCUMENT", "PHOTO", "INTERVIEW"],
      presentTypes: ["CLAIM", "DOCUMENT", "PHOTO"],
      missingTypes: ["INTERVIEW"],
    },
    evidenceNodes: [
      {
        id: "photo-1",
        nodeType: "PHOTO",
        sourceType: "COMPUTER_VISION",
        sourceId: "photo-1",
        title: "North roof slope flashing damage",
        confidenceScore: 0.92,
      },
      {
        id: "doc-1",
        nodeType: "DOCUMENT",
        sourceType: "DOCUMENT_AI",
        sourceId: "doc-1",
        title: "Original estimate",
        confidenceScore: 0.84,
      },
    ],
    recommendations: [
      {
        id: "rec-1",
        type: "SUPPLEMENT_OPPORTUNITY",
        title: "Replace roof flashing",
        description: "Add flashing replacement to the supplement.",
        confidence: 0.82,
        priority: "HIGH",
        supportingEvidenceIds: ["photo-1", "doc-1"],
        missingEvidenceIds: ["interview-1"],
        suggestedActions: ["UPDATE_ESTIMATE", "SUBMIT_SUPPLEMENT"],
        requiresHumanApproval: true,
        rulesApplied: ["SUP-001", "SUP-003"],
      },
    ],
    missingEvidence: [
      {
        type: "INTERVIEW",
        description: "No completed adjuster interview on record.",
        severity: "MEDIUM",
        impact: "MEDIUM",
      },
    ],
    reasoningTrace: [
      { stage: "COLLECT_EVIDENCE", input: {}, output: { count: 3 } },
      { stage: "CALCULATE_CONFIDENCE", input: {}, output: { value: 0.82 } },
    ],
    complianceStatus: "NEEDS_REVIEW",
    complianceScore: 72,
    humanReviewStatus: "PENDING",
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

function makeStore(record: DecisionRecord | null): DecisionStore {
  return {
    async saveDecision(): Promise<any> {
      throw new Error("not used in tests");
    },
    async getLatestDecision(): Promise<DecisionRecord | null> {
      return record;
    },
    async listDecisions(): Promise<DecisionRecord[]> {
      return record ? [record] : [];
    },
    async updateHumanReviewStatus(): Promise<DecisionRecord | null> {
      return record;
    },
  };
}

class FakeProvider implements VoiceProvider {
  lastRequest?: VoiceGenerationRequest;
  constructor(private answer = "Grounded answer from fake provider.") {}

  async generate(
    request: VoiceGenerationRequest
  ): Promise<VoiceGenerationResponse> {
    this.lastRequest = request;
    return {
      answer: this.answer,
      provider: "fake",
      grounded: true,
      trace: {
        decisionId: request.context.decision.id,
        version: request.context.decision.version,
        evidenceCount: request.context.evidenceNodes.length,
        reasoningStages: request.context.reasoningStages,
      },
    };
  }

  isConfigured(): boolean {
    return true;
  }

  getProviderName(): string {
    return "fake";
  }
}

// ==========================================================
// VOICE SERVICE
// ==========================================================

describe("VoiceService", () => {
  it("returns a grounded 'no decision' response when none exists", async () => {
    const service = new VoiceService(new FakeProvider());
    const result = await service.ask(
      "claim-1",
      "org-1",
      "Why was this recommendation made?",
      makeStore(null)
    );

    expect(result.grounded).toBe(true);
    expect(result.answer).toContain("No decision has been generated");
    expect(result.sources.decisionId).toBe("none");
    expect(result.sources.version).toBe(0);
  });

  it("passes the grounded context to the provider and returns its answer", async () => {
    const provider = new FakeProvider("Flashing replacement is supported by photo-1.");
    const service = new VoiceService(provider);
    const record = makeRecord();
    const result = await service.ask(
      "claim-1",
      "org-1",
      "Why did Atlas recommend replacing the flashing?",
      makeStore(record)
    );

    expect(provider.lastRequest).toBeDefined();
    // The grounded context must contain the persisted decision facts.
    expect(provider.lastRequest!.context.decision.id).toBe("decision-1");
    expect(provider.lastRequest!.context.evidenceNodes).toHaveLength(2);
    expect(provider.lastRequest!.context.recommendations[0].title).toBe(
      "Replace roof flashing"
    );
    expect(result.answer).toBe("Flashing replacement is supported by photo-1.");
    expect(result.sources.decisionId).toBe("decision-1");
    expect(result.sources.version).toBe(3);
    expect(result.sources.evidenceCount).toBe(2);
    expect(result.sources.reasoningStages).toContain("COLLECT_EVIDENCE");
  });

  it("explainRecommendation targets the matching recommendation", async () => {
    const provider = new FakeProvider();
    const service = new VoiceService(provider);
    await service.explainRecommendation(
      "claim-1",
      "org-1",
      "Replace roof flashing",
      makeStore(makeRecord())
    );

    expect(provider.lastRequest!.question).toContain("Replace roof flashing");
    expect(provider.lastRequest!.question).toContain("supporting evidence");
  });

  it("explainRecommendation handles an unknown recommendation title gracefully", async () => {
    const provider = new FakeProvider();
    const service = new VoiceService(provider);
    await service.explainRecommendation(
      "claim-1",
      "org-1",
      "Paint the house",
      makeStore(makeRecord())
    );

    expect(provider.lastRequest!.question).toContain(
      'No recommendation matching "Paint the house"'
    );
  });

  it("explainConfidence embeds the decision confidence into the question", async () => {
    const provider = new FakeProvider();
    const service = new VoiceService(provider);
    await service.explainConfidence(
      "claim-1",
      "org-1",
      makeStore(makeRecord({ confidenceScore: 0.64 }))
    );

    expect(provider.lastRequest!.question).toContain("64%");
  });

  it("explainCompliance embeds the compliance status into the question", async () => {
    const provider = new FakeProvider();
    const service = new VoiceService(provider);
    await service.explainCompliance(
      "claim-1",
      "org-1",
      makeStore(makeRecord())
    );

    expect(provider.lastRequest!.question).toContain("NEEDS_REVIEW");
  });
});

// ==========================================================
// ELEMENTAL VOICE PROVIDER
// ==========================================================

describe("ElementalVoiceProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("is not configured without an API key", () => {
    const provider = new ElementalVoiceProvider({ apiKey: "" });
    expect(provider.isConfigured()).toBe(false);
    expect(provider.getProviderName()).toBe("elemental");
  });

  it("throws when generating without configuration", async () => {
    const provider = new ElementalVoiceProvider({ apiKey: "" });
    await expect(
      provider.generate({
        question: "Why?",
        systemPrompt: "Be grounded.",
        context: {
          claimId: "claim-1",
          claimNumber: "CLM-1",
          decision: makeRecord(),
          recommendations: [],
          evidenceNodes: [],
          evidenceSummary: undefined,
          missingEvidence: [],
          compliance: { status: "READY", score: 90 },
          reasoningStages: [],
        },
      })
    ).rejects.toThrow("not configured");
  });

  it("calls the Elemental chat-completions endpoint with the grounded context", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Elemental says the flashing is covered." } }],
      }),
    });
    globalThis.fetch = fetchMock as any;

    const provider = new ElementalVoiceProvider({
      apiKey: "test-key",
      baseUrl: "https://elemental.test/v1",
      model: "elemental-voice-1",
    });

    const result = await provider.generate({
      question: "Why replace the flashing?",
      systemPrompt: "Answer only from context.",
      context: {
        claimId: "claim-1",
        claimNumber: "CLM-1",
        decision: makeRecord(),
        recommendations: makeRecord().recommendations ?? [],
        evidenceNodes: makeRecord().evidenceNodes ?? [],
        evidenceSummary: makeRecord().evidenceSummary,
        missingEvidence: makeRecord().missingEvidence,
        compliance: { status: "NEEDS_REVIEW", score: 72 },
        reasoningStages: ["COLLECT_EVIDENCE", "CALCULATE_CONFIDENCE"],
      },
      temperature: 0.2,
      maxTokens: 300,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://elemental.test/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("elemental-voice-1");
    expect(body.messages).toHaveLength(3); // system + context + question
    // The serialized context must carry decision facts.
    expect(body.messages[1].content).toContain("decision-1");
    expect(body.messages[1].content).toContain("Replace roof flashing");
    expect(result.answer).toBe("Elemental says the flashing is covered.");
    expect(result.grounded).toBe(true);
    expect(result.trace.version).toBe(3);
  });

  it("throws a helpful error when the endpoint fails", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    }) as any;

    const provider = new ElementalVoiceProvider({
      apiKey: "bad-key",
      baseUrl: "https://elemental.test/v1",
    });

    await expect(
      provider.generate({
        question: "Why?",
        systemPrompt: "Be grounded.",
        context: {
          claimId: "claim-1",
          claimNumber: "CLM-1",
          decision: makeRecord(),
          recommendations: [],
          evidenceNodes: [],
          evidenceSummary: undefined,
          missingEvidence: [],
          compliance: { status: "READY", score: 90 },
          reasoningStages: [],
        },
      })
    ).rejects.toThrow("Elemental voice provider error (401)");
  });
});

// ==========================================================
// LEARNING METRICS (pure)
// ==========================================================

describe("computeLearningMetrics", () => {
  it("returns zeroed metrics for no outcomes", () => {
    const metrics = computeLearningMetrics([]);
    expect(metrics.confidenceCalibration.sampleCount).toBe(0);
    expect(metrics.recommendationAccuracy.total).toBe(0);
    expect(metrics.evidenceQualityTrends.total).toBe(0);
    expect(metrics.humanOverrideFrequency.overrideRate).toBe(0);
  });

  it("computes confidence calibration from recorded accuracy", () => {
    const metrics = computeLearningMetrics([
      {
        adjusterOutcome: "APPROVED",
        confidenceAccuracy: 0.8,
      },
      {
        adjusterOutcome: "APPROVED",
        confidenceAccuracy: 0.6,
      },
    ]);

    expect(metrics.confidenceCalibration.sampleCount).toBe(2);
    expect(metrics.confidenceCalibration.averagePredicted).toBe(0.7);
    expect(metrics.confidenceCalibration.averageActual).toBe(1);
    expect(metrics.confidenceCalibration.calibrationError).toBe(0.3);
    expect(metrics.confidenceCalibration.overconfident).toBe(false);
  });

  it("flags overconfidence when predicted exceeds actual", () => {
    const metrics = computeLearningMetrics([
      { adjusterOutcome: "DENIED", confidenceAccuracy: 0.95 },
      { adjusterOutcome: "DENIED", confidenceAccuracy: 0.9 },
    ]);

    expect(metrics.confidenceCalibration.overconfident).toBe(true);
    expect(metrics.confidenceCalibration.averageActual).toBe(0);
  });

  it("computes recommendation accuracy rates", () => {
    const metrics = computeLearningMetrics([
      { adjusterOutcome: "APPROVED" },
      { adjusterOutcome: "APPROVED" },
      { adjusterOutcome: "PARTIAL" },
      { adjusterOutcome: "DENIED" },
    ]);

    expect(metrics.recommendationAccuracy.total).toBe(4);
    expect(metrics.recommendationAccuracy.approved).toBe(2);
    expect(metrics.recommendationAccuracy.partial).toBe(1);
    expect(metrics.recommendationAccuracy.denied).toBe(1);
    expect(metrics.recommendationAccuracy.accuracyRate).toBe(0.5);
    expect(metrics.recommendationAccuracy.denialRate).toBe(0.25);
  });

  it("computes evidence gap trends and most common gaps", () => {
    const metrics = computeLearningMetrics([
      { evidenceGaps: ["POLICY", "PHOTO"] },
      { evidenceGaps: [{ type: "POLICY" }] },
      { evidenceGaps: [] },
      {},
    ]);

    expect(metrics.evidenceQualityTrends.total).toBe(4);
    expect(metrics.evidenceQualityTrends.withGaps).toBe(2);
    expect(metrics.evidenceQualityTrends.gapRate).toBe(0.5);
    expect(metrics.evidenceQualityTrends.mostCommonGaps[0]).toEqual({
      type: "POLICY",
      count: 2,
    });
  });

  it("computes human override frequency from reviewer edits", () => {
    const metrics = computeLearningMetrics([
      { reviewerEdits: { lineItems: ["added flashing"] } },
      { reviewerEdits: {} },
      {},
    ]);

    expect(metrics.humanOverrideFrequency.total).toBe(3);
    expect(metrics.humanOverrideFrequency.overridden).toBe(1);
    expect(metrics.humanOverrideFrequency.overrideRate).toBe(0.33);
  });

  it("computes average time to approval", () => {
    const metrics = computeLearningMetrics([
      { timeToApprovalMinutes: 120 },
      { timeToApprovalMinutes: 180 },
      {},
    ]);

    expect(metrics.evidenceQualityTrends.averageTimeToApprovalMinutes).toBe(150);
  });

  it("tolerates null reviewerEdits without crashing", () => {
    const metrics = computeLearningMetrics([
      { reviewerEdits: null },
      { reviewerEdits: undefined },
      {},
    ]);

    expect(metrics.humanOverrideFrequency.overridden).toBe(0);
  });
});
