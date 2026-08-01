// ==========================================================
// Atlas
// decision.compliance.ts
// RulesBasedComplianceGateway — passes recommendations to the
// existing ComplianceRulesEngine (reused, not duplicated).
// ==========================================================
//
// The Decision Pipeline calls this gateway after generating
// recommendations. It wraps the existing pure
// ComplianceRulesEngine from packages/domain/compliance so the
// Decision Engine orchestrates compliance validation rather than
// reimplementing it.
//
// Default rules mirror DECISION-004:
//   REQUIRED_DOCUMENT_CHECK
//   EVIDENCE_COMPLETENESS_CHECK
//   APPROVAL_REQUIRED_CHECK
//   CONFLICTING_INFORMATION_CHECK

import { ComplianceRulesEngine } from "../compliance/compliance.rules-engine";
import type { ComplianceContext } from "../compliance/compliance.types";
import type {
  ComplianceGateway,
  ComplianceGatewayResult,
  DecisionComplianceContext,
} from "./decision.types";

//
// DEFAULT RULES (DECISION-004)
//

export interface ComplianceRuleSeed {
  id: string;
  organizationId: string;
  requirementId: string;
  name: string;
  description: string;
  category: string;
  claimType: string;
  severity: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_COMPLIANCE_RULES = (
  organizationId: string
): ComplianceRuleSeed[] => [
  {
    id: "rule-required-documents",
    organizationId,
    requirementId: "req-documents",
    name: "Required Documentation",
    description: "Claim must include supporting documentation.",
    category: "DOCUMENTATION",
    claimType: "ALL",
    severity: "HIGH",
    active: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "rule-evidence-completeness",
    organizationId,
    requirementId: "req-evidence",
    name: "Evidence Completeness",
    description: "Claim must have at least 2 evidence sources.",
    category: "EVIDENCE",
    claimType: "ALL",
    severity: "MEDIUM",
    active: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "rule-approval-required",
    organizationId,
    requirementId: "req-approval",
    name: "Approval Required",
    description: "High-confidence recommendations require human approval.",
    category: "APPROVAL",
    claimType: "ALL",
    severity: "MEDIUM",
    active: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "rule-conflicts",
    organizationId,
    requirementId: "req-conflicts",
    name: "Conflicting Information",
    description: "Conflicting evidence requires manual review.",
    category: "RISK",
    claimType: "ALL",
    severity: "HIGH",
    active: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
];

//
// GATEWAY
//

export class RulesBasedComplianceGateway implements ComplianceGateway {
  private rulesEngine: ComplianceRulesEngine;

  constructor(
    rulesEngine: ComplianceRulesEngine = new ComplianceRulesEngine(),
    private rulesProvider: (organizationId: string) => ComplianceRuleSeed[] = DEFAULT_COMPLIANCE_RULES
  ) {
    this.rulesEngine = rulesEngine;
  }

  /**
   * Evaluate the decision context against compliance rules.
   */
  async evaluate(context: DecisionComplianceContext): Promise<ComplianceGatewayResult> {
    const rules = this.rulesProvider(context.claimId ? context.claimId : "");
    // Map seeds to the ComplianceRule shape expected by the rules engine
    const mappedRules = rules.map((r) => ({
      ...r,
      ruleName: this.ruleNameFor(r.id),
      ruleDescription: r.description,
      ruleLogic: r.description,
      version: 1,
    })) as any;

    const complianceContext: ComplianceContext = {
      claimId: context.claimId,
      claimType: context.claimType,
      evidenceNodes: context.evidenceNodes as any,
      documents: context.documents as any,
      decisions: context.decisions as any,
      workflowState: context.workflowState,
    };

    const ruleResults = await this.rulesEngine.evaluateRules(mappedRules, complianceContext);
    const score = this.rulesEngine.calculateScore(ruleResults);
    const status = this.rulesEngine.calculateStatus(score);

    return {
      status,
      score,
      ruleResults: ruleResults.map((r) => ({
        ruleId: r.ruleId,
        result: r.result,
        message: r.message,
        evidenceReferences: r.evidenceReferences,
      })),
      violations: ruleResults
        .filter((r) => r.result === "FAIL" || r.result === "WARNING")
        .map((r) => r.message),
    };
  }

  private ruleNameFor(id: string): string {
    switch (id) {
      case "rule-required-documents":
        return "REQUIRED_DOCUMENT_CHECK";
      case "rule-evidence-completeness":
        return "EVIDENCE_COMPLETENESS_CHECK";
      case "rule-approval-required":
        return "APPROVAL_REQUIRED_CHECK";
      case "rule-conflicts":
        return "CONFLICTING_INFORMATION_CHECK";
      default:
        return "UNKNOWN_RULE";
    }
  }
}
