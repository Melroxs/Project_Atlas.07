"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useVoiceContext } from "@project-atlas/voice";
import {
  ArrowLeft,
  Check,
  X,
  PenSquare,
  RefreshCw,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  Scale,
  ChevronDown,
  Save,
  Download,
  HelpCircle,
} from "lucide-react";

// ==========================================================
// TYPES
// ==========================================================

interface Recommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  priority: string;
  supportingEvidenceIds: string[];
  missingEvidenceIds: string[];
  suggestedActions: string[];
  requiresHumanApproval: boolean;
  rulesApplied: string[];
}

interface EvidenceSummary {
  totalEvidence: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  averageConfidence: number;
  coverage: number;
  requiredTypes: string[];
  presentTypes: string[];
  missingTypes: string[];
}

interface MissingEvidence {
  type: string;
  description: string;
  severity: string;
  impact: string;
  sourceHint?: string;
}

interface ReasoningTraceEntry {
  stage: string;
  input: unknown;
  output: unknown;
}

interface DecisionRecord {
  id: string;
  claimId: string;
  version: number;
  decisionType: string;
  status: string;
  title: string;
  description?: string;
  recommendation?: string;
  confidenceScore: number;
  riskScore: number;
  priority: string;
  evidenceSummary?: EvidenceSummary;
  evidenceNodes?: { id: string; nodeType: string; title: string; confidenceScore: number }[];
  recommendations?: Recommendation[];
  missingEvidence?: MissingEvidence[];
  reasoningTrace?: ReasoningTraceEntry[];
  complianceStatus?: string;
  complianceScore?: number;
  humanReviewStatus: string;
  createdAt: string;
}

interface DecisionRisk {
  id: string;
  riskType: string;
  severity: string;
  description: string;
  mitigation: string;
}

interface Approval {
  id: string;
  reviewerId: string;
  approvalStatus: string;
  comments?: string;
  createdAt: string;
}

interface DecisionContext {
  decision: DecisionRecord;
  score: any;
  evidence: { id: string; evidenceNodeId: string; relationshipType: string; importanceScore: number }[];
  risks: DecisionRisk[];
  actions: any[];
  approvals: Approval[];
  reasoning: any[];
}

interface VoiceExplanation {
  answer: string;
  provider: string;
  grounded: boolean;
  sources: {
    decisionId: string;
    version: number;
    claimId: string;
    confidence: number;
    risk: number;
    complianceStatus?: string;
    evidenceCount: number;
    reasoningStages: string[];
  };
}

// ==========================================================
// BADGE HELPERS
// ==========================================================

const reviewBadge: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  REQUEST_CHANGES:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

const reviewLabel: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REQUEST_CHANGES: "Changes Requested",
};

const priorityBadge: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const complianceBadge: Record<string, string> = {
  READY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  NEEDS_REVIEW:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  MISSING_INFORMATION:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  NON_COMPLIANT: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const riskBadge: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const severityBadge: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function confidenceColor(score: number): string {
  if (score >= 0.75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function riskColor(score: number): string {
  if (score < 25) return "text-emerald-600 dark:text-emerald-400";
  if (score < 50) return "text-amber-600 dark:text-amber-400";
  if (score < 75) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function summarize(value: unknown, max = 220): string {
  const raw = JSON.stringify(value);
  if (!raw) return "—";
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}

// ==========================================================
// PAGE
// ==========================================================

export default function DecisionDetailPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const params = useParams();
  const decisionId = params.id as string;

  const [ctx, setCtx] = useState<DecisionContext | null>(null);
  const [claimId, setClaimId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [comments, setComments] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Voice panel
  const [voiceQuestion, setVoiceQuestion] = useState("");
  const [voiceAnswer, setVoiceAnswer] = useState<VoiceExplanation | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);

  // Export package
  const [exporting, setExporting] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportMd, setExportMd] = useState("");

  // Outcome modal (Phase 5)
  const [showOutcome, setShowOutcome] = useState(false);
  const [outcome, setOutcome] = useState({
    adjusterOutcome: "APPROVED" as string,
    amountApproved: "",
    amountDenied: "",
    confidenceAccuracy: "",
    timeToApprovalMinutes: "",
  });

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<DecisionContext>(`/decisions/${decisionId}`);
      if (!data?.decision) {
        setError("Decision not found");
        return;
      }
      setCtx(data);
      setClaimId(data.decision.claimId);
    } catch (e: any) {
      setError(`Error loading decision: ${e.message}`);
    }
  }, [decisionId]);

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    load();
  }, [session, router, load]);

  const handleReview = async (action: string) => {
    setReviewing(true);
    setStatus("");
    setError("");
    try {
      const res = await apiFetch<{ success?: boolean; decision?: DecisionRecord }>(
        `/decisions/${decisionId}`,
        {
          method: "POST",
          body: JSON.stringify({ action, comments: comments || undefined }),
        }
      );
      setComments("");
      if (action === "REGENERATE") {
        // Regenerate creates a NEW version — jump to the newest for this claim.
        const list = await apiFetch<{ decisions: DecisionRecord[] }>("/decisions");
        const newest = (list.decisions ?? [])
          .filter((d) => d.claimId === claimId)
          .sort((a, b) => b.version - a.version)[0];
        if (newest && newest.id !== decisionId) {
          router.push(`/admin/decisions/${newest.id}`);
          return;
        }
      }
      setStatus(
        action === "APPROVED"
          ? "Decision approved. It is now final and can be used for package generation."
          : action === "REJECTED"
            ? "Decision rejected."
            : action === "REQUEST_CHANGES"
              ? "Changes requested — more evidence required."
              : "Recommendation regenerated as a new version."
      );
      await load();
    } catch (e: any) {
      setError(`Review error: ${e.message}`);
    } finally {
      setReviewing(false);
    }
  };

  const handleVoice = async () => {
    if (!voiceQuestion.trim()) return;
    setVoiceLoading(true);
    setError("");
    try {
      const res = await apiFetch<VoiceExplanation>("/decisions/voice", {
        method: "POST",
        body: JSON.stringify({ claimId, question: voiceQuestion }),
      });
      setVoiceAnswer(res);
    } catch (e: any) {
      setError(`Voice error: ${e.message}`);
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleExport = async (format: "json" | "markdown") => {
    setExporting(true);
    setError("");
    try {
      if (format === "markdown") {
        const res = await fetch(`/api/decisions/${decisionId}/export?format=markdown`);
        const text = await res.text();
        if (!res.ok) throw new Error(text);
        setExportMd(text);
        setShowExport(true);
      } else {
        const res = await apiFetch<{
          package: any;
          markdown: string;
        }>(`/decisions/${decisionId}/export`);
        const blob = new Blob([JSON.stringify(res.package, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${res.package.packageId}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus("Export package downloaded.");
      }
    } catch (e: any) {
      setError(`Export error: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const askAbout = (question: string) => {
    setVoiceQuestion(question);
    setVoiceAnswer(null);
    // Fire the question after state settles.
    setTimeout(() => handleVoiceWith(question), 50);
  };

  const handleVoiceWith = async (question: string) => {
    setVoiceLoading(true);
    setError("");
    try {
      const res = await apiFetch<VoiceExplanation>("/decisions/voice", {
        method: "POST",
        body: JSON.stringify({ claimId, question }),
      });
      setVoiceAnswer(res);
    } catch (e: any) {
      setError(`Voice error: ${e.message}`);
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleRecordOutcome = async () => {
    try {
      await apiFetch("/decisions/outcomes", {
        method: "POST",
        body: JSON.stringify({
          claimId,
          decisionId,
          adjusterOutcome: outcome.adjusterOutcome,
          amountApproved: outcome.amountApproved
            ? Number(outcome.amountApproved)
            : undefined,
          amountDenied: outcome.amountDenied
            ? Number(outcome.amountDenied)
            : undefined,
          confidenceAccuracy: outcome.confidenceAccuracy
            ? Number(outcome.confidenceAccuracy)
            : undefined,
          timeToApprovalMinutes: outcome.timeToApprovalMinutes
            ? Number(outcome.timeToApprovalMinutes)
            : undefined,
        }),
      });
      setShowOutcome(false);
      setStatus("Outcome recorded — learning metrics updated.");
    } catch (e: any) {
      setError(`Outcome error: ${e.message}`);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!session) return null;
  if (!ctx && !error) return <p>Loading...</p>;
  if (!ctx)
    return (
      <div className="max-w-7xl mx-auto p-6">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );

  const d = ctx.decision;
  const evidenceSummary = d.evidenceSummary;

  useVoiceContext({ mode: "decision", decisionId: params?.id as string | undefined });

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={() => router.push("/admin/decisions")}
          className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Decision Review
        </button>
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              {d.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
                v{d.version}
              </span>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  reviewBadge[d.humanReviewStatus] ?? ""
                }`}
              >
                {reviewLabel[d.humanReviewStatus] ?? d.humanReviewStatus}
              </span>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  priorityBadge[d.priority] ?? ""
                }`}
              >
                {d.priority} priority
              </span>
              {d.complianceStatus && (
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    complianceBadge[d.complianceStatus] ?? ""
                  }`}
                >
                  Compliance: {d.complianceStatus.replace(/_/g, " ")}
                </span>
              )}
              <span className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
                {formatDate(d.createdAt)}
              </span>
              <a
                href={`/admin/claims/${d.claimId}`}
                className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                View Claim →
              </a>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("markdown")}
              disabled={exporting}
              className="px-3 py-2 border border-input rounded-lg bg-surface text-foreground hover:bg-muted transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export Package"}
            </button>
            <button
              onClick={() => setShowOutcome(true)}
              className="px-3 py-2 border border-input rounded-lg bg-surface text-foreground hover:bg-muted transition-colors text-sm flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Record Outcome
            </button>
          </div>
        </div>
      </div>

      {status && (
        <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">
          {status}
        </p>
      )}
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {/* ======= Score Cards ======= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface rounded-xl shadow-lg border p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              Confidence
            </h3>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <p className={`text-3xl font-bold ${confidenceColor(d.confidenceScore)}`}>
            {Math.round(d.confidenceScore * 100)}%
          </p>
          {evidenceSummary && (
            <p className="text-xs text-muted-foreground mt-1">
              {evidenceSummary.totalEvidence} evidence items ·{" "}
              {Math.round(evidenceSummary.coverage * 100)}% coverage
            </p>
          )}
        </div>

        <div className="bg-surface rounded-xl shadow-lg border p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-muted-foreground">Risk</h3>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className={`text-3xl font-bold ${riskColor(d.riskScore)}`}>
            {Math.round(d.riskScore)}/100
          </p>
          {ctx.risks.length > 0 ? (
            <p className="text-xs text-muted-foreground mt-1">
              {ctx.risks.length} risk factor
              {ctx.risks.length === 1 ? "" : "s"} identified
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">No risk factors</p>
          )}
        </div>

        <div className="bg-surface rounded-xl shadow-lg border p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              Compliance
            </h3>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-foreground">
            {d.complianceScore != null ? Math.round(d.complianceScore) : "—"}
            {d.complianceScore != null && (
              <span className="text-base font-medium text-muted-foreground">
                /100
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {d.complianceStatus?.replace(/_/g, " ") ?? "Not evaluated"}
          </p>
        </div>

        <div className="bg-surface rounded-xl shadow-lg border p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              Evidence
            </h3>
            <Scale className="h-4 w-4 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">
            {evidenceSummary?.totalEvidence ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {evidenceSummary?.missingTypes.length
              ? `${evidenceSummary.missingTypes.length} missing type${evidenceSummary.missingTypes.length === 1 ? "" : "s"}`
              : "All required evidence present"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ======= Main column ======= */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recommendations */}
          <div className="bg-surface rounded-xl shadow-lg border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Recommendations
            </h2>
            {d.recommendations && d.recommendations.length > 0 ? (
              <div className="space-y-4">
                {d.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="border border-border rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                          {rec.title}
                          <button
                            onClick={() =>
                              askAbout(
                                `Why did Atlas recommend \"${rec.title}\"?`
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            title="Ask Atlas why this was recommended"
                          >
                            <HelpCircle className="h-3 w-3" />
                            Ask Atlas Why
                          </button>
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {rec.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`text-sm font-bold ${confidenceColor(rec.confidence)}`}
                        >
                          {Math.round(rec.confidence * 100)}%
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            priorityBadge[rec.priority] ?? ""
                          }`}
                        >
                          {rec.priority}
                        </span>
                        {rec.requiresHumanApproval && (
                          <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Human approval required
                          </span>
                        )}
                      </div>
                    </div>

                    {rec.rulesApplied.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {rec.rulesApplied.map((rule) => (
                          <span
                            key={rule}
                            className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground font-mono"
                          >
                            {rule}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-1 font-medium">
                          Supporting evidence ({rec.supportingEvidenceIds.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {rec.supportingEvidenceIds.map((id) => (
                            <span
                              key={id}
                              className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-mono"
                              title="Evidence node ID — traceable to the evidence graph"
                            >
                              {id.slice(0, 8)}
                            </span>
                          ))}
                          {rec.supportingEvidenceIds.length === 0 && (
                            <span className="text-muted-foreground">
                              None linked
                            </span>
                          )}
                        </div>
                      </div>
                      {rec.suggestedActions.length > 0 && (
                        <div>
                          <p className="text-muted-foreground mb-1 font-medium">
                            Suggested actions
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {rec.suggestedActions.map((action) => (
                              <span
                                key={action}
                                className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                              >
                                {action.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No recommendations generated for this decision.
              </p>
            )}
          </div>

          {/* Evidence summary */}
          {evidenceSummary && (
            <div className="bg-surface rounded-xl shadow-lg border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Supporting Evidence
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    By type
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(evidenceSummary.byType).map(
                      ([type, count]) => (
                        <span
                          key={type}
                          className="px-2 py-0.5 rounded text-xs bg-muted text-foreground"
                        >
                          {type.replace(/_/g, " ")} · {count}
                        </span>
                      )
                    )}
                    {Object.keys(evidenceSummary.byType).length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No evidence collected
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-medium text-foreground mb-1">
                      Present ({evidenceSummary.presentTypes.length}/
                      {evidenceSummary.requiredTypes.length} required)
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {evidenceSummary.presentTypes.map((type) => (
                        <span
                          key={type}
                          className="px-1.5 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        >
                          {type.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    Missing evidence
                  </p>
                  {d.missingEvidence && d.missingEvidence.length > 0 ? (
                    <div className="space-y-2">
                      {d.missingEvidence.map((m, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-sm border border-border rounded p-2"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-foreground">
                              {m.type.replace(/_/g, " ")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {m.description}
                            </p>
                            <div className="flex gap-1 mt-1">
                              <span
                                className={`px-1.5 py-0.5 rounded text-xs ${
                                  severityBadge[m.severity] ?? ""
                                }`}
                              >
                                {m.severity}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                                {m.impact} impact
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No missing evidence — the claim is complete.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Risk factors */}
          {ctx.risks.length > 0 && (
            <div className="bg-surface rounded-xl shadow-lg border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Risk Factors
              </h2>
              <div className="space-y-3">
                {ctx.risks.map((risk) => (
                  <div
                    key={risk.id}
                    className="flex items-start gap-3 border border-border rounded-lg p-3"
                  >
                    <span
                      className={`px-2 py-1 rounded text-xs shrink-0 ${
                        riskBadge[risk.severity] ?? ""
                      }`}
                    >
                      {risk.severity}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {risk.riskType.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {risk.description}
                      </p>
                      {risk.mitigation && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                          Mitigation: {risk.mitigation}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning trace */}
          {d.reasoningTrace && d.reasoningTrace.length > 0 && (
            <div className="bg-surface rounded-xl shadow-lg border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Reasoning Trace
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Every recommendation is traceable back to evidence through the
                pipeline stages below.
              </p>
              <div className="space-y-2">
                {d.reasoningTrace.map((entry, i) => (
                  <details
                    key={i}
                    className="group border border-border rounded-lg"
                  >
                    <summary className="flex items-center gap-2 cursor-pointer px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors rounded-lg list-none">
                      <span className="flex-1 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                          {i + 1}
                        </span>
                        {entry.stage.replace(/_/g, " ")}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 space-y-2 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-1">Input</p>
                        <pre className="bg-muted rounded p-2 overflow-x-auto text-foreground whitespace-pre-wrap">
                          {summarize(entry.input)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Output</p>
                        <pre className="bg-muted rounded p-2 overflow-x-auto text-foreground whitespace-pre-wrap">
                          {summarize(entry.output)}
                        </pre>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {/* Review history */}
          {ctx.approvals.length > 0 && (
            <div className="bg-surface rounded-xl shadow-lg border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Review History
              </h2>
              <div className="space-y-3">
                {ctx.approvals.map((approval) => (
                  <div
                    key={approval.id}
                    className="flex items-start gap-3 text-sm border border-border rounded-lg p-3"
                  >
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        approval.approvalStatus === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : approval.approvalStatus === "REJECTED"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                      }`}
                    >
                      {approval.approvalStatus.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1">
                      <p className="text-muted-foreground text-xs">
                        by {approval.reviewerId.slice(0, 8)} ·{" "}
                        {new Date(approval.createdAt).toLocaleString()}
                      </p>
                      {approval.comments && (
                        <p className="text-sm text-foreground mt-1">
                          “{approval.comments}”
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ======= Sidebar ======= */}
        <div className="space-y-6">
          {/* Review actions */}
          <div className="bg-surface rounded-xl shadow-lg border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Human Review
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              No recommendation becomes final without your approval.
            </p>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Comments (required for rejection / changes)"
              className="w-full p-2 bg-muted dark:bg-card border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors hover:border-primary mb-3"
            />
            <div className="space-y-2">
              <button
                onClick={() => handleReview("APPROVED")}
                disabled={reviewing}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" />
                Approve
              </button>
              <button
                onClick={() => handleReview("REQUEST_CHANGES")}
                disabled={reviewing}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <PenSquare className="h-4 w-4" />
                Request More Evidence
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleReview("REJECTED")}
                  disabled={reviewing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
                <button
                  onClick={() => handleReview("REGENERATE")}
                  disabled={reviewing}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${reviewing ? "animate-spin" : ""}`}
                  />
                  Regenerate
                </button>
              </div>
            </div>
          </div>

          {/* Voice explanation */}
          <div className="bg-surface rounded-xl shadow-lg border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Atlas Voice
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Ask why a recommendation was made. Answers are grounded in this
              decision record and evidence graph — never invented.
            </p>
            <input
              type="text"
              value={voiceQuestion}
              onChange={(e) => setVoiceQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVoice()}
              placeholder='e.g. "Why did Atlas recommend replacing the flashing?"'
              className="w-full p-2 bg-muted dark:bg-card border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors hover:border-primary mb-2"
            />
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                "Why was this recommendation made?",
                "What evidence supports this decision?",
                "How confident is Atlas?",
                "Is this compliant?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => askAbout(q)}
                  className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
            <button
              onClick={handleVoice}
              disabled={voiceLoading || !voiceQuestion.trim()}
              className="w-full px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {voiceLoading && (
                <RefreshCw className="h-4 w-4 animate-spin" />
              )}
              {voiceLoading ? "Consulting Atlas..." : "Ask Atlas"}
            </button>

            {voiceAnswer && (
              <div className="mt-4 border border-border rounded-lg p-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {voiceAnswer.answer}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-mono">
                    provider: {voiceAnswer.provider}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-mono">
                    decision v{voiceAnswer.sources.version}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-mono">
                    {voiceAnswer.sources.evidenceCount} evidence
                  </span>
                  {voiceAnswer.sources.reasoningStages.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-mono">
                      {voiceAnswer.sources.reasoningStages.length} reasoning
                      stages
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Outcome modal (Phase 5) */}
      {showOutcome && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg p-6 max-w-md w-full mx-4 border">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Record Outcome
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              After claim completion, capture the results to power the learning
              feedback loop (analytics only — no auto-retraining).
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Adjuster outcome
                </label>
                <select
                  value={outcome.adjusterOutcome}
                  onChange={(e) =>
                    setOutcome({ ...outcome, adjusterOutcome: e.target.value })
                  }
                  className="w-full p-2 bg-muted dark:bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors hover:border-primary"
                >
                  <option value="APPROVED">Approved</option>
                  <option value="PARTIAL">Partially approved</option>
                  <option value="DENIED">Denied</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Amount approved ($)
                  </label>
                  <input
                    type="number"
                    value={outcome.amountApproved}
                    onChange={(e) =>
                      setOutcome({ ...outcome, amountApproved: e.target.value })
                    }
                    className="w-full p-2 bg-muted dark:bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors hover:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Amount denied ($)
                  </label>
                  <input
                    type="number"
                    value={outcome.amountDenied}
                    onChange={(e) =>
                      setOutcome({ ...outcome, amountDenied: e.target.value })
                    }
                    className="w-full p-2 bg-muted dark:bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors hover:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Confidence accuracy (0–1)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={outcome.confidenceAccuracy}
                    onChange={(e) =>
                      setOutcome({
                        ...outcome,
                        confidenceAccuracy: e.target.value,
                      })
                    }
                    className="w-full p-2 bg-muted dark:bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors hover:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Time to approval (min)
                  </label>
                  <input
                    type="number"
                    value={outcome.timeToApprovalMinutes}
                    onChange={(e) =>
                      setOutcome({
                        ...outcome,
                        timeToApprovalMinutes: e.target.value,
                      })
                    }
                    className="w-full p-2 bg-muted dark:bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors hover:border-primary"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowOutcome(false)}
                className="px-4 py-2 bg-muted text-foreground rounded hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordOutcome}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
              >
                Save Outcome
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Package Modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg p-6 max-w-2xl w-full mx-4 border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Export Package Preview
              </h3>
              <button
                onClick={() => setShowExport(false)}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                aria-label="Close export preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <pre className="bg-muted rounded-lg p-4 overflow-auto max-h-96 text-xs text-foreground whitespace-pre-wrap">
              {exportMd}
            </pre>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => handleExport("json")}
                className="px-4 py-2 border border-input rounded-lg bg-surface text-foreground hover:bg-muted transition-colors text-sm"
              >
                Download JSON
              </button>
              <a
                href={`/api/decisions/${decisionId}/export?format=markdown`}
                download
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors text-sm"
              >
                Download .md
              </a>
              <button
                onClick={() => setShowExport(false)}
                className="px-4 py-2 bg-muted text-foreground rounded hover:bg-accent transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
