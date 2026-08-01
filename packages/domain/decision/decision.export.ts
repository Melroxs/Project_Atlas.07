// ==========================================================
// Atlas
// packages/domain/decision/decision.export.ts
// Export Package Builder
// ==========================================================
//
// Assembles the complete decision package for export / carrier
// submission. Pure and deterministic — consumes the persisted
// decision context (repository.buildDecisionContext) and returns
// a structured, traceable package. Every element references
// stored evidence; no invented facts.

import type {
  DecisionApproval,
  DecisionEvidenceLink,
  DecisionReasoningLog,
  DecisionRecord,
  DecisionRisk,
  DecisionScore,
} from "./decision.types";

// ==========================================================
// EXPORT PACKAGE TYPES
// ==========================================================

export interface ExportPackage {
  packageId: string;
  decisionId: string;
  claimId: string;
  version: number;
  generatedAt: string;
  decision: {
    id: string;
    title: string;
    description?: string;
    recommendation?: string;
    decisionType: string;
    status: string;
    priority: string;
    confidenceScore: number;
    riskScore: number;
    complianceStatus?: string;
    complianceScore?: number;
    humanReviewStatus: string;
  };
  evidence: {
    summary: DecisionRecord["evidenceSummary"];
    nodes: DecisionRecord["evidenceNodes"];
    links: {
      evidenceNodeId: string;
      relationshipType: string;
      importanceScore: number;
    }[];
    missingEvidence: DecisionRecord["missingEvidence"];
  };
  recommendations: DecisionRecord["recommendations"];
  compliance: {
    status?: string;
    score?: number;
  };
  risks: {
    riskType: string;
    severity: string;
    description: string;
    mitigation: string;
  }[];
  scoreBreakdown?: DecisionScore;
  reasoningTrace: DecisionRecord["reasoningTrace"];
  reviewHistory: {
    approvalStatus: string;
    reviewerId: string;
    comments?: string;
    createdAt: string;
  }[];
}

export interface DecisionContextPayload {
  decision: DecisionRecord;
  score: DecisionScore | null;
  evidence: DecisionEvidenceLink[];
  risks: DecisionRisk[];
  actions: unknown[];
  approvals: DecisionApproval[];
  reasoning: DecisionReasoningLog[];
}

// ==========================================================
// BUILDERS
// ==========================================================

/**
 * Build the structured export package from the persisted decision
 * context returned by DecisionRepository.buildDecisionContext.
 */
export function buildExportPackage(context: DecisionContextPayload): ExportPackage {
  const d = context.decision;
  const generatedAt = new Date().toISOString();

  return {
    packageId: `PKG-${d.claimId.slice(0, 8).toUpperCase()}-v${d.version}`,
    decisionId: d.id,
    claimId: d.claimId,
    version: d.version,
    generatedAt,
    decision: {
      id: d.id,
      title: d.title,
      description: d.description,
      recommendation: d.recommendation,
      decisionType: d.decisionType,
      status: d.status,
      priority: d.priority,
      confidenceScore: d.confidenceScore,
      riskScore: d.riskScore,
      complianceStatus: d.complianceStatus,
      complianceScore: d.complianceScore,
      humanReviewStatus: d.humanReviewStatus,
    },
    evidence: {
      summary: d.evidenceSummary,
      nodes: d.evidenceNodes,
      links: (context.evidence ?? []).map((link) => ({
        evidenceNodeId: link.evidenceNodeId,
        relationshipType: link.relationshipType,
        importanceScore: link.importanceScore,
      })),
      missingEvidence: d.missingEvidence,
    },
    recommendations: d.recommendations ?? [],
    compliance: {
      status: d.complianceStatus,
      score: d.complianceScore,
    },
    risks: (context.risks ?? []).map((risk) => ({
      riskType: risk.riskType,
      severity: risk.severity,
      description: risk.description,
      mitigation: risk.mitigation,
    })),
    scoreBreakdown: context.score ?? undefined,
    reasoningTrace: d.reasoningTrace ?? [],
    reviewHistory: (context.approvals ?? []).map((a) => ({
      approvalStatus: a.approvalStatus,
      reviewerId: a.reviewerId,
      comments: a.comments,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

/**
 * Human-readable markdown rendering of the export package — used
 * for the printable/demo export view.
 */
export function exportPackageToMarkdown(pkg: ExportPackage): string {
  const lines: string[] = [];
  lines.push(`# Atlas Decision Package — ${pkg.packageId}`);
  lines.push("");
  lines.push(`**Claim:** ${pkg.claimId}  `);
  lines.push(`**Decision:** ${pkg.decision.title} (v${pkg.version})  `);
  lines.push(
    `**Confidence:** ${Math.round(pkg.decision.confidenceScore * 100)}%  `
  );
  lines.push(`**Risk:** ${Math.round(pkg.decision.riskScore)}/100  `);
  lines.push(
    `**Compliance:** ${pkg.compliance.status ?? "n/a"} (${pkg.compliance.score != null ? Math.round(pkg.compliance.score) : "n/a"}/100)  `
  );
  lines.push(`**Human review:** ${pkg.decision.humanReviewStatus}  `);
  lines.push(`**Generated:** ${pkg.generatedAt}`);
  lines.push("");

  if (pkg.decision.description) {
    lines.push(`## Overview`);
    lines.push(pkg.decision.description);
    lines.push("");
  }

  lines.push(`## Recommendations`);
  if (pkg.recommendations && pkg.recommendations.length > 0) {
    for (const rec of pkg.recommendations) {
      lines.push(`### ${rec.title} (${rec.priority}, ${Math.round(rec.confidence * 100)}%)`);
      lines.push(rec.description);
      if (rec.rulesApplied?.length) {
        lines.push(`Rules: ${rec.rulesApplied.join(", ")}`);
      }
      if (rec.supportingEvidenceIds?.length) {
        lines.push(`Evidence: ${rec.supportingEvidenceIds.join(", ")}`);
      }
      lines.push("");
    }
  } else {
    lines.push("None.");
    lines.push("");
  }

  lines.push(`## Evidence Summary`);
  const summary = pkg.evidence.summary;
  if (summary) {
    lines.push(
      `- Total evidence: ${summary.totalEvidence} (coverage ${Math.round(summary.coverage * 100)}%)`
    );
    lines.push(`- Missing types: ${summary.missingTypes.join(", ") || "none"}`);
  }
  if (pkg.evidence.nodes?.length) {
    lines.push("");
    lines.push("### Evidence nodes");
    for (const node of pkg.evidence.nodes as { id: string; nodeType: string; title: string; confidenceScore?: number }[]) {
      lines.push(
        `- ${node.title} (${node.nodeType.replace(/_/g, " ").toLowerCase()}, id ${node.id}, conf ${node.confidenceScore != null ? Math.round(node.confidenceScore * 100) : "n/a"}%)`
      );
    }
  }
  lines.push("");

  if (pkg.risks.length > 0) {
    lines.push(`## Risk Factors`);
    for (const risk of pkg.risks) {
      lines.push(`- [${risk.severity}] ${risk.riskType.replace(/_/g, " ")}: ${risk.description}`);
      if (risk.mitigation) lines.push(`  Mitigation: ${risk.mitigation}`);
    }
    lines.push("");
  }

  if (pkg.reasoningTrace?.length) {
    lines.push(`## Reasoning Trace`);
    for (const step of pkg.reasoningTrace) {
      lines.push(`- ${step.stage.replace(/_/g, " ")}`);
    }
    lines.push("");
  }

  if (pkg.reviewHistory.length > 0) {
    lines.push(`## Review History`);
    for (const review of pkg.reviewHistory) {
      lines.push(
        `- ${review.approvalStatus.replace(/_/g, " ")} by ${review.reviewerId} (${review.createdAt})${review.comments ? ` — "${review.comments}"` : ""}`
      );
    }
    lines.push("");
  }

  lines.push(`_Generated by Atlas Decision Engine — grounded in stored evidence._`);
  return lines.join("\n");
}
