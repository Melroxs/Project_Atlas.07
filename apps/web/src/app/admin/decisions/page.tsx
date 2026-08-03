"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useLiveRefresh } from "@/lib/data-events";
import { useSupabase } from "@/providers/SupabaseProvider";
import {
  Scale,
  Sparkles,
  RefreshCw,
  TrendingUp,
  Target,
  AlertTriangle,
} from "lucide-react";

// ==========================================================
// TYPES (mirror the Decision Engine domain shapes)
// ==========================================================

interface DecisionRecord {
  id: string;
  organizationId: string;
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
  complianceStatus?: string;
  complianceScore?: number;
  humanReviewStatus: string;
  createdAt: string;
}

interface ClaimSummary {
  id: string;
  claimNumber: string;
  customerName: string | null;
  insuranceCompany: string | null;
}

interface LearningMetrics {
  confidenceCalibration: {
    sampleCount: number;
    averagePredicted: number;
    averageActual: number;
    calibrationError: number;
    overconfident: boolean;
  };
  recommendationAccuracy: {
    total: number;
    approved: number;
    denied: number;
    partial: number;
    accuracyRate: number;
    approvalRate: number;
    denialRate: number;
  };
  evidenceQualityTrends: {
    total: number;
    withGaps: number;
    withoutGaps: number;
    gapRate: number;
    averageTimeToApprovalMinutes: number;
    mostCommonGaps: { type: string; count: number }[];
  };
  humanOverrideFrequency: {
    total: number;
    overridden: number;
    overrideRate: number;
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

// ==========================================================
// PAGE
// ==========================================================

export default function DecisionsPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [claims, setClaims] = useState<ClaimSummary[]>([]);
  const [metrics, setMetrics] = useState<LearningMetrics | null>(null);
  const [filter, setFilter] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [showEvaluate, setShowEvaluate] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState("");
  const [status, setStatus] = useState("");
  const [loadingList, setLoadingList] = useState(true);

  // Bulk review
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkComments, setBulkComments] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  useLiveRefresh(() => loadDecisions());

  const loadDecisions = useCallback(async () => {
    try {
      setLoadingList(true);
      const data = await apiFetch<{ decisions: DecisionRecord[] }>("/decisions");
      setDecisions(data.decisions ?? []);
    } catch (e: any) {
      setStatus(`Error loading decisions: ${e.message}`);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadClaims = async () => {
    try {
      const data = await apiFetch<{ data: ClaimSummary[] }>("/claims?limit=200");
      setClaims(data.data ?? []);
    } catch (e: any) {
      console.error("Error loading claims:", e);
    }
  };

  const loadMetrics = async () => {
    try {
      const data = await apiFetch<LearningMetrics>("/decisions/outcomes");
      setMetrics(data);
    } catch (e: any) {
      // Metrics panel is best-effort; don't block the page.
      console.error("Error loading learning metrics:", e);
    }
  };

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadDecisions();
    loadClaims();
    loadMetrics();
  }, [session, router, loadDecisions]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((d) => d.id));
    }
  };

  const openBulkModal = (action: string) => {
    setBulkAction(action);
    setShowBulkModal(true);
  };

  const runBulkReview = async () => {
    if (selectedIds.length === 0 || !bulkAction) return;
    setBulkRunning(true);
    setStatus("");
    try {
      const res = await apiFetch<{ succeeded: number; failed: number }>(
        "/decisions/bulk-review",
        {
          method: "POST",
          body: JSON.stringify({
            decisionIds: selectedIds,
            action: bulkAction,
            comments: bulkComments || undefined,
          }),
        }
      );
      setStatus(
        `Bulk review complete: ${res.succeeded} updated, ${res.failed} failed.`
      );
      setShowBulkModal(false);
      setSelectedIds([]);
      setBulkComments("");
      await loadDecisions();
      await loadMetrics();
    } catch (e: any) {
      setStatus(`Bulk review error: ${e.message}`);
    } finally {
      setBulkRunning(false);
    }
  };

  const handleEvaluate = async () => {
    const claimId = selectedClaim;
    if (!claimId) return;
    setEvaluating(true);
    setStatus("");
    try {
      const data = await apiFetch<{ decision?: { id: string } | null }>(
        "/decisions",
        {
          method: "POST",
          body: JSON.stringify({ claimId }),
        }
      );
      setShowEvaluate(false);
      setStatus("Decision generated successfully.");
      await loadDecisions();
      // Navigate using the persisted decision id returned by the endpoint —
      // never read from stale state. Preserve the selected claim until
      // navigation completes.
      if (data.decision?.id) {
        router.push(`/admin/decisions/${data.decision.id}`);
      } else {
        // Fallback: re-read the list for the newest decision for this claim.
        const { decisions: latest } = await apiFetch<{
          decisions: DecisionRecord[];
        }>("/decisions");
        const newest = latest
          .filter((d) => d.claimId === claimId)
          .sort((a, b) => b.version - a.version)[0];
        if (newest) router.push(`/admin/decisions/${newest.id}`);
      }
    } catch (e: any) {
      setStatus(`Evaluate error: ${e.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!session) return null;

  const filtered = filter
    ? decisions.filter((d) => d.humanReviewStatus === filter)
    : decisions;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            Decision Review
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI recommendations, evidence, confidence and compliance — reviewed
            and approved by a human before anything becomes final.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadDecisions();
              loadMetrics();
            }}
            className="px-3 py-2 border border-input rounded-lg bg-surface text-foreground hover:bg-muted transition-colors flex items-center gap-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowEvaluate(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Evaluate Claim
          </button>
        </div>
      </div>

      {status && (
        <p className="mb-4 text-sm text-muted-foreground">{status}</p>
      )}

      {/* Bulk review toolbar */}
      {selectedIds.length > 0 && (
        <div className="mb-6 bg-surface p-4 rounded-xl shadow-lg border flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.length} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => openBulkModal("APPROVED")}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors text-sm"
            >
              Approve Selected
            </button>
            <button
              onClick={() => openBulkModal("REQUEST_CHANGES")}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
            >
              Request Changes
            </button>
            <button
              onClick={() => openBulkModal("REJECTED")}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm"
            >
              Reject Selected
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 border border-input rounded-lg bg-surface text-foreground hover:bg-muted transition-colors text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-6 bg-surface p-4 rounded-xl shadow-lg border">
        <div className="flex items-center gap-4">
          <label
            htmlFor="reviewFilter"
            className="block text-sm font-medium text-foreground"
          >
            Review Status
          </label>
          <select
            id="reviewFilter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="p-2 bg-muted dark:bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors hover:border-primary"
          >
            <option value="">All</option>
            {Object.entries(reviewLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} decision{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl shadow-lg overflow-hidden border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={
                    filtered.length > 0 &&
                    selectedIds.length === filtered.length
                  }
                  onChange={toggleSelectAll}
                  className="accent-primary"
                  aria-label="Select all decisions"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Recommendation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Claim
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Ver
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Risk
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Compliance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Review
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {filtered.map((d) => (
              <tr
                key={d.id}
                className={`hover:bg-muted transition-colors ${selectedIds.includes(d.id) ? "bg-primary/5" : ""}`}
              >
                <td className="px-4 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(d.id)}
                    onChange={() => toggleSelect(d.id)}
                    className="accent-primary"
                    aria-label={`Select ${d.title}`}
                  />
                </td>
                <td className="px-6 py-4 text-sm">
                  <a
                    href={`/admin/decisions/${d.id}`}
                    className="text-primary hover:text-primary/90 font-medium transition-colors"
                  >
                    {d.title}
                  </a>
                  {d.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-md">
                      {d.description}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  <a
                    href={`/admin/claims/${d.claimId}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {d.claimId.slice(0, 8)}
                  </a>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  v{d.version}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <span className={confidenceColor(d.confidenceScore)}>
                    {Math.round(d.confidenceScore * 100)}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <span className={riskColor(d.riskScore)}>
                    {Math.round(d.riskScore)}/100
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {d.complianceStatus ? (
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        complianceBadge[d.complianceStatus] ?? ""
                      }`}
                    >
                      {d.complianceStatus.replace(/_/g, " ")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      reviewBadge[d.humanReviewStatus] ?? ""
                    }`}
                  >
                    {reviewLabel[d.humanReviewStatus] ?? d.humanReviewStatus}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      priorityBadge[d.priority] ?? ""
                    }`}
                  >
                    {d.priority}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-muted-foreground">
                  {formatDate(d.createdAt)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-6 py-10 text-center text-sm text-muted-foreground"
                >
                  {loadingList
                    ? "Loading decisions..."
                    : "No decisions yet. Run the Decision Engine on a claim to get started."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Learning Metrics (Phase 5) */}
      {metrics && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Continuous Learning — Analytics
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Feedback-loop analytics only. Atlas never retrains models
            automatically — human review remains mandatory.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Confidence calibration */}
            <div className="bg-surface rounded-xl shadow-lg border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Confidence Calibration
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Samples</span>
                  <span className="font-medium">
                    {metrics.confidenceCalibration.sampleCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg predicted</span>
                  <span className="font-medium">
                    {Math.round(
                      metrics.confidenceCalibration.averagePredicted * 100
                    )}
                    %
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg actual</span>
                  <span className="font-medium">
                    {Math.round(
                      metrics.confidenceCalibration.averageActual * 100
                    )}
                    %
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Calibration err</span>
                  <span
                    className={`font-medium ${
                      metrics.confidenceCalibration.overconfident
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {Math.round(
                      metrics.confidenceCalibration.calibrationError * 100
                    )}
                    %
                    {metrics.confidenceCalibration.overconfident && " ↑"}
                  </span>
                </div>
              </div>
            </div>

            {/* Recommendation accuracy */}
            <div className="bg-surface rounded-xl shadow-lg border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Recommendation Accuracy
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total outcomes</span>
                  <span className="font-medium">
                    {metrics.recommendationAccuracy.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accuracy</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {Math.round(
                      metrics.recommendationAccuracy.accuracyRate * 100
                    )}
                    %
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Approved</span>
                  <span className="font-medium">
                    {metrics.recommendationAccuracy.approved}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Partial / Denied
                  </span>
                  <span className="font-medium">
                    {metrics.recommendationAccuracy.partial} /{" "}
                    {metrics.recommendationAccuracy.denied}
                  </span>
                </div>
              </div>
            </div>

            {/* Evidence quality trends */}
            <div className="bg-surface rounded-xl shadow-lg border p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-foreground">
                  Evidence Quality
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gap rate</span>
                  <span className="font-medium">
                    {Math.round(metrics.evidenceQualityTrends.gapRate * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claims w/ gaps</span>
                  <span className="font-medium">
                    {metrics.evidenceQualityTrends.withGaps}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg time to OK</span>
                  <span className="font-medium">
                    {Math.round(
                      metrics.evidenceQualityTrends
                        .averageTimeToApprovalMinutes
                    )}{" "}
                    min
                  </span>
                </div>
                {metrics.evidenceQualityTrends.mostCommonGaps.length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground mb-1">
                      Most common gaps
                    </p>
                    {metrics.evidenceQualityTrends.mostCommonGaps
                      .slice(0, 3)
                      .map((g) => (
                        <div
                          key={g.type}
                          className="flex justify-between text-xs"
                        >
                          <span className="text-muted-foreground">{g.type}</span>
                          <span className="font-medium">{g.count}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Human override frequency */}
            <div className="bg-surface rounded-xl shadow-lg border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Scale className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Human Override
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Decisions</span>
                  <span className="font-medium">
                    {metrics.humanOverrideFrequency.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Edited by review</span>
                  <span className="font-medium">
                    {metrics.humanOverrideFrequency.overridden}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Override rate</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {Math.round(
                      metrics.humanOverrideFrequency.overrideRate * 100
                    )}
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evaluate Modal */}
      {showEvaluate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg p-6 max-w-md w-full mx-4 border">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Evaluate a Claim
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Run the full Decision Engine: collect evidence, score confidence
              and risk, validate compliance, and generate recommendations.
            </p>
            <label
              htmlFor="claimSelect"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Claim
            </label>
            <select
              id="claimSelect"
              value={selectedClaim}
              onChange={(e) => setSelectedClaim(e.target.value)}
              className="w-full p-2 bg-muted dark:bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors hover:border-primary mb-4"
            >
              <option value="">Select a claim...</option>
              {claims.map((claim) => (
                <option key={claim.id} value={claim.id}>
                  {claim.claimNumber}
                  {claim.customerName ? ` — ${claim.customerName}` : ""}
                  {claim.insuranceCompany
                    ? ` (${claim.insuranceCompany})`
                    : ""}
                </option>
              ))}
            </select>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowEvaluate(false)}
                className="px-4 py-2 bg-muted text-foreground rounded hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEvaluate}
                disabled={!selectedClaim || evaluating}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {evaluating && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
                {evaluating ? "Running Engine..." : "Evaluate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Review Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg p-6 max-w-md w-full mx-4 border">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Bulk Review —{" "}
              {bulkAction === "APPROVED"
                ? "Approve"
                : bulkAction === "REJECTED"
                  ? "Reject"
                  : "Request Changes"}{" "}
              ({selectedIds.length})
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              This will update the human review status of all selected
              decisions. Every review is recorded in the audit trail.
            </p>
            <label
              htmlFor="bulkComments"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Comments (optional)
            </label>
            <textarea
              id="bulkComments"
              value={bulkComments}
              onChange={(e) => setBulkComments(e.target.value)}
              rows={3}
              className="w-full p-2 bg-muted dark:bg-card border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors hover:border-primary mb-4"
              placeholder="Reason for this bulk action..."
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 bg-muted text-foreground rounded hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={runBulkReview}
                disabled={bulkRunning}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {bulkRunning && <RefreshCw className="h-4 w-4 animate-spin" />}
                {bulkRunning ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
