// ==========================================================
// Atlas
// decision.repository.ts
// Decision Repository Layer (DECISION-002, drizzle-backed)
// ==========================================================
//
// Persists every Decision Engine execution as a NEW row with an
// incremented version per claim — previous decisions are never
// overwritten (version history).
//
// Implements:
//   - DecisionStore (saveDecision, getLatestDecision,
//     listDecisions, updateHumanReviewStatus) consumed by the
//     DecisionEngine
//   - legacy CRUD contract consumed by DecisionService
//     (createDecision, getClaimDecisions, approve/reject, ...)

import { eq, and, desc, max, sql } from "drizzle-orm";
import { db } from "@project-atlas/database";
import {
  decisions,
  decisionScores,
  decisionEvidenceLinks,
  decisionRisks,
  decisionActions,
  decisionApprovals,
  decisionReasoningLogs,
  decisionOutcomes,
} from "@project-atlas/database";
import type { DecisionStore } from "./decision.engine";
import type {
  CreateDecisionRequest,
  Decision,
  DecisionAction,
  DecisionApproval,
  DecisionEvidenceLink,
  EvidenceInput,
  DecisionPipelineInput,
  DecisionPipelineResult,
  DecisionReasoningLog,
  DecisionRecord,
  DecisionRisk,
  DecisionScore,
  DecisionStatus,
  HumanReviewStatus,
} from "./decision.types";

//
// ROW -> RECORD MAPPERS
//

/**
 * Shared numeric-score row mapper — the single mapping used by both
 * createScore and getScore so numeric strings are always converted
 * consistently and raw Drizzle rows are never returned.
 */
export function mapScoreRow(row: any): DecisionScore {
  return {
    id: row.id,
    decisionId: row.decisionId,
    evidenceScore: row.evidenceScore != null ? Number(row.evidenceScore) : 0,
    coverageScore: row.coverageScore != null ? Number(row.coverageScore) : 0,
    complianceScore: row.complianceScore != null ? Number(row.complianceScore) : 0,
    riskFactorScore: row.riskFactorScore != null ? Number(row.riskFactorScore) : 0,
    finalScore: row.finalScore != null ? Number(row.finalScore) : 0,
    calculationDetails: row.calculationDetails ?? {},
    createdAt: new Date(row.createdAt),
  };
}
export function toDecisionRecord(row: any): DecisionRecord {
  return {
    id: row.id,
    organizationId: row.companyId,
    claimId: row.claimId,
    claimNumber: row.claimNumber ?? undefined,
    version: Number(row.version || 1),
    decisionType: row.decisionType,
    status: row.status,
    title: row.title,
    description: row.description ?? undefined,
    recommendation: row.recommendation ?? undefined,
    confidenceScore: row.confidenceScore ? Number(row.confidenceScore) : 0,
    riskScore: row.riskScore ? Number(row.riskScore) : 0,
    priority: row.priority ?? "MEDIUM",
    evidenceSummary: row.evidenceSummary ?? undefined,
    evidenceNodes: row.evidenceNodes ?? undefined,
    recommendations: row.recommendations ?? undefined,
    missingEvidence: row.missingEvidence ?? undefined,
    reasoningTrace: row.reasoningTrace ?? undefined,
    riskFactors: row.riskFactors ?? undefined,
    complianceStatus: row.complianceStatus ?? undefined,
    complianceScore: row.complianceScore ? Number(row.complianceScore) : undefined,
    humanReviewStatus: row.humanReviewStatus ?? "PENDING",
    createdBy: row.createdBy ?? undefined,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function toLegacyDecision(row: any): Decision {
  const record = toDecisionRecord(row);
  return {
    id: record.id,
    organizationId: record.organizationId,
    claimId: record.claimId,
    decisionType: record.decisionType,
    status: record.status,
    title: record.title,
    description: record.description ?? "",
    recommendation: record.recommendation ?? "",
    confidenceScore: record.confidenceScore,
    riskScore: record.riskScore,
    priority: record.priority,
    createdBy: record.createdBy ?? "system",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

//
// REPOSITORY
//

export class DecisionRepository implements DecisionStore {
  //
  // VERSION HISTORY — never overwrite
  //
  private async nextVersion(claimId: string, client: any = db): Promise<number> {
    const [result] = await client
      .select({ maxVersion: max((decisions as any).version) })
      .from(decisions)
      .where(eq((decisions as any).claimId, claimId));
    return (Number(result?.maxVersion) || 0) + 1;
  }

  //
  // DECISION STORE — saveDecision
  //
  // Writes the decision + score + risks + reasoning logs inside a single
  // DB transaction. A per-claim advisory lock serializes concurrent
  // evaluations so version numbers can never collide (version = max+1).
  //
  async saveDecision(
    input: DecisionPipelineInput,
    result: DecisionPipelineResult
  ): Promise<DecisionRecord> {
    return db.transaction(async (tx) => {
      // Serialize concurrent evaluations for the same claim.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${input.claimId}))`
      );

      const version = await this.nextVersion(input.claimId, tx);
      const top = result.recommendations[0];
      const evidenceNodes = this.evidenceNodesFromInput(input);

      const [row] = await tx
        .insert(decisions)
        .values({
          companyId: input.organizationId,
          claimId: input.claimId,
          claimNumber: input.claim.claimNumber || null,
          version,
          decisionType: top?.type ?? "CLAIM_REVIEW",
          status: "GENERATED",
          title: top?.title ?? "Claim Analysis",
          description: result.explanation,
          recommendation: top?.description ?? result.explanation,
          confidenceScore: String(result.confidence.value),
          riskScore: String(result.risk.score),
          priority: top?.priority ?? "MEDIUM",
          evidenceSummary: result.evidence as any,
          evidenceNodes: evidenceNodes as any,
          recommendations: result.recommendations as any,
          missingEvidence: result.missingEvidence as any,
          reasoningTrace: result.reasoningTrace as any,
          riskFactors: result.risk.factors as any,
          complianceStatus: result.compliance.status,
          complianceScore: String(result.compliance.score),
          humanReviewStatus: "PENDING",
          createdBy: (input as any).createdBy,
        } as any)
        .returning();

      const record = toDecisionRecord(row);

      // Persist detailed score breakdown (same transaction)
      await this.createScore(
        {
          decisionId: record.id,
          evidenceScore: result.confidence.details.evidenceConfidence,
          coverageScore: result.evidence.coverage,
          complianceScore: result.compliance.score,
          riskFactorScore: result.risk.score,
          finalScore: result.confidence.value,
          calculationDetails: {
            confidence: result.confidence,
            evidence: result.evidence,
          },
        },
        tx
      );

      // Persist risks (same transaction)
      for (const factor of result.risk.factors) {
        await this.createRisk(
          {
            decisionId: record.id,
            riskType: factor.type,
            severity: factor.severity,
            description: factor.description,
            mitigation: factor.mitigation ?? "",
            points: factor.points,
          },
          tx
        );
      }

      // Persist reasoning logs / explainability (same transaction)
      for (const entry of result.reasoningTrace) {
        await this.createReasoningLog(
          {
            decisionId: record.id,
            reasoningType: this.mapStageToReasoningType(entry.stage),
            inputData: { stage: entry.stage, input: entry.input },
            outputData: { output: entry.output },
          },
          tx
        );
      }

      return record;
    });
  }

  //
  // DECISION STORE — getLatestDecision
  //
  async getLatestDecision(
    claimId: string,
    organizationId: string
  ): Promise<DecisionRecord | null> {
    const rows = await db
      .select()
      .from(decisions)
      .where(
        and(
          eq((decisions as any).claimId, claimId),
          eq((decisions as any).companyId, organizationId)
        )
      )
      .orderBy(desc((decisions as any).version))
      .limit(1);
    return rows[0] ? toDecisionRecord(rows[0]) : null;
  }

  //
  // DECISION STORE — listDecisions
  //
  async listDecisions(
    organizationId: string,
    limit = 50
  ): Promise<DecisionRecord[]> {
    const rows = await db
      .select()
      .from(decisions)
      .where(eq((decisions as any).companyId, organizationId))
      .orderBy(desc((decisions as any).createdAt))
      .limit(limit);
    return rows.map(toDecisionRecord);
  }

  //
  // DECISION STORE — updateHumanReviewStatus
  //
  async updateHumanReviewStatus(
    decisionId: string,
    status: HumanReviewStatus,
    reviewerId?: string,
    comments?: string
  ): Promise<DecisionRecord | null> {
    const [row] = await db
      .update(decisions)
      .set({
        humanReviewStatus: status,
        status: status === "APPROVED" ? "APPROVED" : status === "REJECTED" ? "REJECTED" : "UNDER_REVIEW",
        updatedAt: new Date(),
      })
      .where(eq((decisions as any).id, decisionId))
      .returning();

    if (!row) return null;

    // Record the human approval/rejection
    await this.createApproval({
      decisionId,
      reviewerId: reviewerId ?? "system",
      approvalStatus:
        status === "APPROVED"
          ? "APPROVED"
          : status === "REJECTED"
            ? "REJECTED"
            : "REQUEST_CHANGES",
      comments,
    });

    return toDecisionRecord(row);
  }

  //
  // LEGACY CONTRACT — createDecision
  //
  async createDecision(
    data: CreateDecisionRequest & { createdBy?: string }
  ): Promise<Decision> {
    const version = await this.nextVersion(data.claimId);
    const [row] = await db
      .insert(decisions)
      .values({
        companyId: data.organizationId,
        claimId: data.claimId,
        version,
        decisionType: data.decisionType,
        status: "GENERATED",
        title: data.title,
        description: data.description,
        recommendation: data.recommendation,
        confidenceScore: String(data.confidenceScore),
        riskScore: String(data.riskScore),
        priority: data.priority,
        createdBy: data.createdBy,
        humanReviewStatus: "PENDING",
      } as any)
      .returning();
    return toLegacyDecision(row);
  }

  //
  // LEGACY CONTRACT — getDecision
  //
  async getDecision(
    decisionId: string,
    organizationId: string
  ): Promise<Decision | null> {
    const rows = await db
      .select()
      .from(decisions)
      .where(
        and(
          eq((decisions as any).id, decisionId),
          eq((decisions as any).companyId, organizationId)
        )
      );
    return rows[0] ? toLegacyDecision(rows[0]) : null;
  }

  //
  // FULL RECORD — getDecisionRecord
  //
  // Returns the complete structured DecisionRecord (evidence
  // summary, recommendations, missing evidence, reasoning trace,
  // compliance) for the reviewer UI and voice explainability.
  //
  async getDecisionRecord(
    decisionId: string,
    organizationId: string
  ): Promise<DecisionRecord | null> {
    const rows = await db
      .select()
      .from(decisions)
      .where(
        and(
          eq((decisions as any).id, decisionId),
          eq((decisions as any).companyId, organizationId)
        )
      )
      .limit(1);
    return rows[0] ? toDecisionRecord(rows[0]) : null;
  }

  //
  // LEGACY CONTRACT — getClaimDecisions (version history)
  //
  async getClaimDecisions(
    claimId: string,
    organizationId: string
  ): Promise<Decision[]> {
    const rows = await db
      .select()
      .from(decisions)
      .where(
        and(
          eq((decisions as any).claimId, claimId),
          eq((decisions as any).companyId, organizationId)
        )
      )
      .orderBy(desc((decisions as any).version));
    return rows.map(toLegacyDecision);
  }

  //
  // LEGACY CONTRACT — updateDecisionStatus
  //
  async updateDecisionStatus(
    decisionId: string,
    status: DecisionStatus
  ): Promise<Decision | null> {
    const [row] = await db
      .update(decisions)
      .set({ status, updatedAt: new Date() })
      .where(eq((decisions as any).id, decisionId))
      .returning();
    return row ? toLegacyDecision(row) : null;
  }

  //
  // SCORES
  //
  async createScore(
    data: Omit<DecisionScore, "id" | "createdAt">,
    client: any = db
  ): Promise<DecisionScore> {
    const [row]: any[] = await client
      .insert(decisionScores)
      .values({
        decisionId: data.decisionId,
        evidenceScore: data.evidenceScore != null ? String(data.evidenceScore) : null,
        coverageScore: data.coverageScore != null ? String(data.coverageScore) : null,
        complianceScore: data.complianceScore != null ? String(data.complianceScore) : null,
        riskFactorScore: data.riskFactorScore != null ? String(data.riskFactorScore) : null,
        finalScore: data.finalScore != null ? String(data.finalScore) : null,
        calculationDetails: data.calculationDetails as any,
      } as any)
      .returning();
    return mapScoreRow(row);
  }

  async getScore(decisionId: string): Promise<DecisionScore | null> {
    const rows = await db
      .select()
      .from(decisionScores)
      .where(eq((decisionScores as any).decisionId, decisionId))
      .limit(1);
    return rows[0] ? mapScoreRow(rows[0]) : null;
  }

  //
  // EVIDENCE LINKS
  //
  async linkEvidence(
    data: Omit<DecisionEvidenceLink, "id" | "createdAt">
  ): Promise<DecisionEvidenceLink> {
    const [row]: any[] = await db
      .insert(decisionEvidenceLinks)
      .values({
        decisionId: data.decisionId,
        evidenceNodeId: data.evidenceNodeId,
        relationshipType: data.relationshipType,
        importanceScore: data.importanceScore != null ? String(data.importanceScore) : "1",
      } as any)
      .returning();
    return {
      id: row.id,
      decisionId: row.decisionId,
      evidenceNodeId: row.evidenceNodeId,
      relationshipType: row.relationshipType,
      importanceScore: row.importanceScore ? Number(row.importanceScore) : 1,
      createdAt: new Date(row.createdAt),
    };
  }

  async getEvidenceLinks(decisionId: string): Promise<DecisionEvidenceLink[]> {
    const rows = await db
      .select()
      .from(decisionEvidenceLinks)
      .where(eq((decisionEvidenceLinks as any).decisionId, decisionId));
    return rows.map((r: any) => ({
      id: r.id,
      decisionId: r.decisionId,
      evidenceNodeId: r.evidenceNodeId,
      relationshipType: r.relationshipType,
      importanceScore: r.importanceScore ? Number(r.importanceScore) : 1,
      createdAt: new Date(r.createdAt),
    }));
  }

  //
  // RISKS
  //
  async createRisk(
    data: Omit<DecisionRisk, "id" | "createdAt"> & { points?: number },
    client: any = db
  ): Promise<DecisionRisk> {
    const [row]: any[] = await client
      .insert(decisionRisks)
      .values({
        decisionId: data.decisionId,
        riskType: data.riskType,
        severity: data.severity,
        description: data.description,
        mitigation: data.mitigation,
        points: data.points ?? 0,
      } as any)
      .returning();
    return {
      id: row.id,
      decisionId: row.decisionId,
      riskType: row.riskType,
      severity: row.severity,
      description: row.description ?? "",
      mitigation: row.mitigation ?? "",
      createdAt: new Date(row.createdAt),
    };
  }

  async getRisks(decisionId: string): Promise<DecisionRisk[]> {
    const rows = await db
      .select()
      .from(decisionRisks)
      .where(eq((decisionRisks as any).decisionId, decisionId));
    return rows.map((r: any) => ({
      id: r.id,
      decisionId: r.decisionId,
      riskType: r.riskType,
      severity: r.severity,
      description: r.description ?? "",
      mitigation: r.mitigation ?? "",
      createdAt: new Date(r.createdAt),
    }));
  }

  //
  // ACTIONS
  //
  async createAction(data: Omit<DecisionAction, "id">): Promise<DecisionAction> {
    const [row]: any[] = await db
      .insert(decisionActions)
      .values({
        decisionId: data.decisionId,
        actionType: data.actionType,
        description: data.description,
        status: data.status || "PENDING",
        assignedTo: data.assignedTo,
        completedAt: data.completedAt,
      } as any)
      .returning();
    return {
      id: row.id,
      decisionId: row.decisionId,
      actionType: row.actionType,
      description: row.description ?? "",
      status: row.status,
      assignedTo: row.assignedTo ?? undefined,
      completedAt: row.completedAt ?? undefined,
    };
  }

  async getActions(decisionId: string): Promise<DecisionAction[]> {
    const rows = await db
      .select()
      .from(decisionActions)
      .where(eq((decisionActions as any).decisionId, decisionId));
    return rows.map((r: any) => ({
      id: r.id,
      decisionId: r.decisionId,
      actionType: r.actionType,
      description: r.description ?? "",
      status: r.status,
      assignedTo: r.assignedTo ?? undefined,
      completedAt: r.completedAt ?? undefined,
    }));
  }

  //
  // APPROVALS
  //
  async createApproval(
    data: Omit<DecisionApproval, "id" | "createdAt">
  ): Promise<DecisionApproval> {
    const [row]: any[] = await db
      .insert(decisionApprovals)
      .values({
        decisionId: data.decisionId,
        reviewerId: data.reviewerId,
        approvalStatus: data.approvalStatus,
        comments: data.comments,
      } as any)
      .returning();
    return {
      id: row.id,
      decisionId: row.decisionId,
      reviewerId: row.reviewerId,
      approvalStatus: row.approvalStatus,
      comments: row.comments ?? undefined,
      createdAt: new Date(row.createdAt),
    };
  }

  async getApprovals(decisionId: string): Promise<DecisionApproval[]> {
    const rows = await db
      .select()
      .from(decisionApprovals)
      .where(eq((decisionApprovals as any).decisionId, decisionId))
      .orderBy(desc((decisionApprovals as any).createdAt));
    return rows.map((r: any) => ({
      id: r.id,
      decisionId: r.decisionId,
      reviewerId: r.reviewerId,
      approvalStatus: r.approvalStatus,
      comments: r.comments ?? undefined,
      createdAt: new Date(r.createdAt),
    }));
  }

  //
  // REASONING LOGS
  //
  async createReasoningLog(
    data: Omit<DecisionReasoningLog, "id" | "createdAt">,
    client: any = db
  ): Promise<DecisionReasoningLog> {
    const [row]: any[] = await client
      .insert(decisionReasoningLogs)
      .values({
        decisionId: data.decisionId,
        reasoningType: data.reasoningType,
        inputData: data.inputData as any,
        outputData: data.outputData as any,
      } as any)
      .returning();
    return {
      id: row.id,
      decisionId: row.decisionId,
      reasoningType: row.reasoningType,
      inputData: row.inputData ?? {},
      outputData: row.outputData ?? {},
      createdAt: new Date(row.createdAt),
    };
  }

  async getReasoningLogs(decisionId: string): Promise<DecisionReasoningLog[]> {
    const rows = await db
      .select()
      .from(decisionReasoningLogs)
      .where(eq((decisionReasoningLogs as any).decisionId, decisionId))
      .orderBy(desc((decisionReasoningLogs as any).createdAt));
    return rows.map((r: any) => ({
      id: r.id,
      decisionId: r.decisionId,
      reasoningType: r.reasoningType,
      inputData: r.inputData ?? {},
      outputData: r.outputData ?? {},
      createdAt: new Date(r.createdAt),
    }));
  }

  //
  // BUILD COMPLETE DECISION CONTEXT (explainability)
  //
  async buildDecisionContext(decisionId: string, organizationId: string) {
    const decision = await this.getDecisionRecord(decisionId, organizationId);
    if (!decision) return null;

    const [score, evidence, risks, actions, approvals, reasoning] =
      await Promise.all([
        this.getScore(decisionId),
        this.getEvidenceLinks(decisionId),
        this.getRisks(decisionId),
        this.getActions(decisionId),
        this.getApprovals(decisionId),
        this.getReasoningLogs(decisionId),
      ]);

    return { decision, score, evidence, risks, actions, approvals, reasoning };
  }

  //
  // FIND OPEN DECISIONS
  //
  async findPendingDecisions(organizationId: string): Promise<Decision[]> {
    const rows = await db
      .select()
      .from(decisions)
      .where(
        and(
          eq((decisions as any).companyId, organizationId),
          sql`${(decisions as any).status} IN ('GENERATED', 'UNDER_REVIEW')`
        )
      )
      .orderBy(desc((decisions as any).createdAt));
    return rows.map(toLegacyDecision);
  }

  //
  // LEARNING — record decision outcome (Phase 5)
  //
  async recordOutcome(data: {
    organizationId: string;
    claimId: string;
    decisionId?: string;
    finalApprovedSupplement?: any;
    reviewerEdits?: any;
    adjusterOutcome?: string;
    amountApproved?: number;
    amountDenied?: number;
    confidenceAccuracy?: number;
    evidenceGaps?: any;
    timeToApprovalMinutes?: number;
  }) {
    const [row] = await db
      .insert(decisionOutcomes)
      .values({
        companyId: data.organizationId,
        claimId: data.claimId,
        decisionId: data.decisionId,
        finalApprovedSupplement: data.finalApprovedSupplement as any,
        reviewerEdits: data.reviewerEdits as any,
        adjusterOutcome: data.adjusterOutcome,
        amountApproved: data.amountApproved != null ? String(data.amountApproved) : null,
        amountDenied: data.amountDenied != null ? String(data.amountDenied) : null,
        confidenceAccuracy:
          data.confidenceAccuracy != null ? String(data.confidenceAccuracy) : null,
        evidenceGaps: data.evidenceGaps as any,
        timeToApprovalMinutes:
          data.timeToApprovalMinutes != null ? String(data.timeToApprovalMinutes) : null,
        completedAt: new Date(),
      } as any)
      .returning();
    return row;
  }

  //
  // LEARNING — list outcomes
  //
  async listOutcomes(organizationId: string) {
    const rows = await db
      .select()
      .from(decisionOutcomes)
      .where(eq((decisionOutcomes as any).companyId, organizationId))
      .orderBy(desc((decisionOutcomes as any).createdAt))
      .limit(500);
    return rows.map((r: any) => ({
      ...r,
      amountApproved: r.amountApproved ? Number(r.amountApproved) : undefined,
      amountDenied: r.amountDenied ? Number(r.amountDenied) : undefined,
      confidenceAccuracy: r.confidenceAccuracy ? Number(r.confidenceAccuracy) : undefined,
      timeToApprovalMinutes: r.timeToApprovalMinutes
        ? Number(r.timeToApprovalMinutes)
        : undefined,
    }));
  }

  /**
   * Normalize the claim snapshot into lightweight EvidenceInput
   * nodes so persisted decisions carry the actual supporting
   * evidence (documents, interviews, supplements, AI drafts).
   */
  private evidenceNodesFromInput(input: DecisionPipelineInput): EvidenceInput[] {
    return evidenceNodesFromInput(input);
  }

  private mapStageToReasoningType(stage: string): DecisionReasoningLog["reasoningType"] {
    return mapStageToReasoningType(stage);
  }
}

// ==========================================================
// PURE HELPERS (exported for unit testing without a DB)
// ==========================================================

export function evidenceNodesFromInput(input: DecisionPipelineInput): EvidenceInput[] {
  const nodes: EvidenceInput[] = [];

  for (const doc of input.documents ?? []) {
    nodes.push({
      id: doc.id,
      nodeType: "DOCUMENT",
      sourceType: "DOCUMENT_AI",
      sourceId: doc.id,
      title: doc.name,
      confidenceScore: doc.confidence ?? 1,
      metadata: { type: doc.type },
    });
  }

  for (const interview of input.interviews ?? []) {
    nodes.push({
      id: interview.id,
      nodeType: "INTERVIEW",
      sourceType: "SYSTEM",
      sourceId: interview.id,
      title: `Interview: ${interview.templateName ?? "Completed"}`,
      confidenceScore: 0.9,
      metadata: { status: interview.status },
    });
  }

  for (const supplement of input.supplements ?? []) {
    nodes.push({
      id: supplement.id,
      nodeType: "ESTIMATE_ITEM",
      sourceType: "SYSTEM",
      sourceId: supplement.id,
      title: `Supplement ${supplement.supplementNumber}`,
      confidenceScore: 0.9,
      metadata: {
        status: supplement.status,
        requestedAmount: supplement.requestedAmount,
      },
    });
  }

  for (const rec of input.aiRecommendations ?? []) {
    nodes.push({
      id: rec.id,
      nodeType: "RECOMMENDATION",
      sourceType: "DOCUMENT_AI",
      sourceId: rec.id,
      title: rec.description,
      confidenceScore: rec.confidence ?? 0.7,
      metadata: { category: rec.category, amount: rec.amount },
    });
  }

  return nodes;
}

export function mapStageToReasoningType(
  stage: string
): DecisionReasoningLog["reasoningType"] {
  switch (stage) {
    case "COLLECT_EVIDENCE":
    case "VALIDATE_EVIDENCE":
    case "DETECT_INCONSISTENCIES":
    case "ASSESS_COMPLETENESS":
      return "EVIDENCE_ANALYSIS";
    case "EVALUATE_COMPLIANCE":
      return "COMPLIANCE_CHECK";
    case "CALCULATE_CONFIDENCE":
    case "GENERATE_RECOMMENDATIONS":
      return "SUPPLEMENT_ANALYSIS";
    default:
      return "RISK_ASSESSMENT";
  }
}
