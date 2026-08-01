// ==========================================================
// Atlas
// apps/api/tests/decision-engine.test.ts
// Unit tests for the Decision Engine
// ==========================================================
//
// Covers:
//   - Confidence scoring
//   - Risk scoring
//   - Decision pipeline (full run)
//   - Recommendation validation
//   - Evidence completeness

import {
  ConfidenceScorer,
  RiskScorer,
  EvidenceCollector,
  RecommendationValidator,
  RecommendationBuilder,
  DecisionPipeline,
  SUPPLEMENT_CONFIDENCE_THRESHOLD,
} from "../../../packages/domain/decision";
import type {
  DecisionPipelineInput,
  EvidenceInput,
  Recommendation,
} from "../../../packages/domain/decision";

//
// FIXTURES
//

function buildEvidence(count: number, sourceType = "DOCUMENT_AI"): EvidenceInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ev-${i}`,
    nodeType: "DOCUMENT",
    sourceType,
    sourceId: `src-${i}`,
    title: `Evidence ${i}`,
    confidenceScore: 0.9,
  }));
}

function buildPipelineInput(overrides: Partial<DecisionPipelineInput> = {}): DecisionPipelineInput {
  return {
    claimId: "11111111-1111-1111-1111-111111111111",
    organizationId: "22222222-2222-2222-2222-222222222222",
    claim: {
      id: "11111111-1111-1111-1111-111111111111",
      claimNumber: "CLM-001",
      insuranceCompany: "ABC Insurance",
      policyNumber: "POL-123",
      causeOfLoss: "WATER",
      status: "new",
      estimatedValue: 25000,
      approvedValue: 10000,
      customerName: "Jane Doe",
    },
    documents: [
      { id: "doc-1", name: "contract.pdf", mimeType: "application/pdf", type: "PDF" },
      { id: "doc-2", name: "roof-photo.jpg", mimeType: "image/jpeg", type: "JPG" },
    ],
    interviews: [
      { id: "int-1", status: "completed", templateName: "FNOL", progress: 100 },
    ],
    supplements: [
      {
        id: "sup-1",
        supplementNumber: "SUP-001",
        status: "draft",
        requestedAmount: 5000,
        approvedAmount: 0,
        lineItems: [
          { id: "li-1", description: "Roof flashing", quantity: 1, unitPrice: 2500, total: 2500 },
        ],
      },
    ],
    activity: [{ id: "act-1", type: "create", description: "Claim created" }],
    aiRecommendations: [
      {
        id: "ai-1",
        description: "Missing roof flashing scope",
        category: "roof",
        amount: 2500,
        confidence: 0.85,
        evidence: ["roof-photo.jpg"],
      },
    ],
    ...overrides,
  };
}

//
// 1. CONFIDENCE SCORING
//

describe("ConfidenceScorer", () => {
  const scorer = new ConfidenceScorer();

  test("high coverage + strong evidence -> HIGH or VERY_HIGH confidence", () => {
    const result = scorer.score({
      evidence: buildEvidence(5),
      coverage: 1,
      complianceScore: 95,
      contradictionCount: 0,
      aiConfidence: 0.9,
    });
    expect(result.value).toBeGreaterThanOrEqual(0.7);
    expect(["HIGH", "VERY_HIGH"]).toContain(result.label);
    expect(result.factors.length).toBe(4);
  });

  test("low coverage + weak evidence -> LOW confidence", () => {
    const result = scorer.score({
      evidence: buildEvidence(1, "EXTERNAL_IMPORT"),
      coverage: 0.2,
      complianceScore: 40,
      contradictionCount: 0,
      aiConfidence: 0.3,
    });
    expect(result.value).toBeLessThan(0.7);
  });

  test("contradictions reduce confidence", () => {
    const base = {
      evidence: buildEvidence(5),
      coverage: 1,
      complianceScore: 95,
      aiConfidence: 0.9,
    };
    const clean = scorer.score({ ...base, contradictionCount: 0 });
    const conflicted = scorer.score({ ...base, contradictionCount: 2 });
    expect(conflicted.value).toBeLessThan(clean.value);
    expect(conflicted.details.contradictionPenalty).toBeGreaterThan(0);
  });

  test("no evidence yields zero confidence", () => {
    const result = scorer.score({
      evidence: [],
      coverage: 0,
      complianceScore: 0,
      contradictionCount: 0,
    });
    expect(result.value).toBe(0);
    expect(result.label).toBe("VERY_LOW");
  });
});

//
// 2. RISK SCORING
//

describe("RiskScorer", () => {
  const scorer = new RiskScorer();

  test("no gaps -> LOW risk", () => {
    const result = scorer.score({
      missingEvidence: [],
      contradictionCount: 0,
      complianceViolations: [],
    });
    expect(result.score).toBeLessThan(25);
    expect(result.level).toBe("LOW");
  });

  test("missing evidence adds risk points", () => {
    const result = scorer.score({
      missingEvidence: [
        {
          type: "PHOTO",
          description: "Missing photos",
          severity: "HIGH",
          impact: "HIGH",
        },
      ],
      contradictionCount: 0,
      complianceViolations: [],
    });
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.factors.some((f) => f.type === "INSUFFICIENT_EVIDENCE")).toBe(true);
  });

  test("compliance violations escalate to CRITICAL", () => {
    const result = scorer.score({
      missingEvidence: [],
      contradictionCount: 0,
      complianceViolations: ["Required documentation missing", "Approval required"],
    });
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.level).toBe("CRITICAL");
  });

  test("conflicting evidence adds points and is capped", () => {
    const result = scorer.score({
      missingEvidence: [],
      contradictionCount: 5,
      complianceViolations: [],
    });
    expect(result.factors.some((f) => f.type === "CONFLICTING_INFORMATION")).toBe(true);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test("financial exposure contributes REVENUE_LEAKAGE risk", () => {
    const result = scorer.score({
      missingEvidence: [],
      contradictionCount: 0,
      complianceViolations: [],
      estimatedValue: 100000,
      approvedValue: 1000,
    });
    expect(result.factors.some((f) => f.type === "REVENUE_LEAKAGE")).toBe(true);
  });
});

//
// 3. EVIDENCE COMPLETENESS
//

describe("EvidenceCollector — completeness", () => {
  const collector = new EvidenceCollector();

  test("full claim snapshot covers required evidence types", () => {
    const result = collector.collect(buildPipelineInput());
    expect(result.summary.totalEvidence).toBeGreaterThanOrEqual(5);
    expect(result.summary.coverage).toBeGreaterThanOrEqual(0.8);
    expect(result.summary.missingTypes).not.toContain("POLICY");
    expect(result.summary.missingTypes).not.toContain("ESTIMATE");
  });

  test("empty claim reports all missing evidence", () => {
    const input = buildPipelineInput({
      documents: [],
      interviews: [],
      supplements: [],
      activity: [],
      claim: {
        ...buildPipelineInput().claim,
        insuranceCompany: undefined,
        policyNumber: undefined,
      },
    });
    const result = collector.collect(input);
    expect(result.missingEvidence.length).toBeGreaterThanOrEqual(3);
    expect(result.summary.missingTypes).toContain("POLICY");
    expect(result.summary.missingTypes).toContain("ESTIMATE");
    expect(result.summary.coverage).toBeLessThan(0.5);
  });

  test("photos detected from image mime types", () => {
    const input = buildPipelineInput();
    const result = collector.collect(input);
    expect(result.nodes.some((n) => n.nodeType === "PHOTO")).toBe(true);
  });
});

//
// 4. RECOMMENDATION VALIDATION
//

describe("RecommendationValidator", () => {
  const validator = new RecommendationValidator();

  const supplementRec: Recommendation = {
    id: "rec-1",
    type: "SUPPLEMENT_OPPORTUNITY",
    title: "Missing flashing",
    description: "Add roof flashing line item",
    confidence: 0.85,
    priority: "HIGH",
    supportingEvidenceIds: ["ev-0", "ev-1"],
    missingEvidenceIds: [],
    suggestedActions: ["REVIEW", "SUBMIT_SUPPLEMENT"],
    requiresHumanApproval: true,
    rulesApplied: ["SUP-001"],
  };

  test("valid supplement recommendation passes with 2+ evidence sources", () => {
    const result = validator.validate([supplementRec], buildEvidence(3), 0);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.recommendations).toHaveLength(1);
  });

  test("supplement recommendation with < 2 evidence sources is rejected", () => {
    const weak: Recommendation = {
      ...supplementRec,
      supportingEvidenceIds: ["ev-0"],
    };
    const result = validator.validate([weak], buildEvidence(1), 0);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("2 supporting evidence sources");
  });

  test("low-confidence supplement recommendation produces a warning", () => {
    const low: Recommendation = {
      ...supplementRec,
      confidence: SUPPLEMENT_CONFIDENCE_THRESHOLD - 0.05,
    };
    const result = validator.validate([low], buildEvidence(3), 0);
    expect(result.warnings.some((w) => w.includes("below the"))).toBe(true);
  });

  test("contradictions force human approval", () => {
    const rec: Recommendation = { ...supplementRec, requiresHumanApproval: false };
    const result = validator.validate([rec], buildEvidence(3), 1);
    expect(result.warnings.some((w) => w.includes("human review"))).toBe(true);
    expect(result.recommendations[0].requiresHumanApproval).toBe(true);
  });
});

//
// 5. DECISION PIPELINE (FULL RUN)
//

describe("DecisionPipeline", () => {
  const pipeline = new DecisionPipeline();

  test("produces a structured result with all output sections", async () => {
    const result = await pipeline.run(buildPipelineInput());
    expect(result.claimId).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.evidence.totalEvidence).toBeGreaterThan(0);
    expect(result.confidence.value).toBeGreaterThanOrEqual(0);
    expect(result.confidence.value).toBeLessThanOrEqual(1);
    expect(result.risk.score).toBeGreaterThanOrEqual(0);
    expect(result.risk.score).toBeLessThanOrEqual(100);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.missingEvidence).toBeDefined();
    expect(result.compliance.status).toBeDefined();
    expect(result.explanation.length).toBeGreaterThan(20);
    expect(result.reasoningTrace.length).toBeGreaterThanOrEqual(8);
  });

  test("financial recommendations require human approval", async () => {
    const result = await pipeline.run(buildPipelineInput());
    const supplement = result.recommendations.find(
      (r) => r.type === "SUPPLEMENT_OPPORTUNITY"
    );
    if (supplement) {
      expect(supplement.requiresHumanApproval).toBe(true);
      expect(result.requiresHumanApproval).toBe(true);
    }
  });

  test("insufficient evidence yields a document-request style decision", async () => {
    const input = buildPipelineInput({
      documents: [],
      interviews: [],
      supplements: [],
      activity: [],
      aiRecommendations: [],
      claim: {
        ...buildPipelineInput().claim,
        insuranceCompany: undefined,
        policyNumber: undefined,
        estimatedValue: undefined,
        approvedValue: undefined,
      },
    });
    const result = await pipeline.run(input);
    expect(result.sufficientEvidence).toBe(false);
    expect(result.missingEvidence.length).toBeGreaterThan(0);
    expect(
      result.recommendations.some((r) => r.type === "DOCUMENT_REQUEST")
    ).toBe(true);
  });

  test("pipeline is deterministic for identical inputs", async () => {
    const a = await pipeline.run(buildPipelineInput());
    const b = await pipeline.run(buildPipelineInput());
    expect(a.confidence.value).toBe(b.confidence.value);
    expect(a.risk.score).toBe(b.risk.score);
    expect(a.recommendations.length).toBe(b.recommendations.length);
  });
});

//
// 6. RECOMMENDATION BUILDER (SUP-001 rules)
//

describe("RecommendationBuilder", () => {
  const builder = new RecommendationBuilder();
  const collector = new EvidenceCollector();

  test("AI recommendation becomes a supplement opportunity", async () => {
    const input = buildPipelineInput();
    const collected = collector.collect(input);
    const recs = builder.build({
      claimId: input.claimId,
      claimNumber: input.claim.claimNumber,
      evidence: collected.nodes,
      missingEvidence: collected.missingEvidence,
      aiRecommendations: input.aiRecommendations ?? [],
      contradictionCount: collected.contradictionCount,
      complianceViolations: [],
      confidenceValue: 0.85,
      risk: new RiskScorer().score({
        missingEvidence: collected.missingEvidence,
        contradictionCount: 0,
        complianceViolations: [],
      }),
    });
    expect(recs.some((r) => r.type === "SUPPLEMENT_OPPORTUNITY")).toBe(true);
  });
});
