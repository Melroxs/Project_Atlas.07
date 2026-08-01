"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface Factor {
  key: string;
  label: string;
  weight: number;
  score: number;
  contribution: number;
  explanation: string;
}

interface RecoveryReadiness {
  score: number;
  level: "low" | "medium" | "high";
  label: string;
  factors: Factor[];
}

interface Risk {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  detail: string;
}

interface MissingInfo {
  id: string;
  label: string;
  detail: string;
  requiredFor: string[];
}

interface NBAction {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  reason: string;
  requiredAction: string;
  confidence: number;
  explanation: {
    why: string;
    evidenceUsed: string[];
    documentsUsed: string[];
    photosReferenced: string[];
    policySectionsReferenced: string[];
    lineItemsContributed: string[];
  };
}

interface KnowledgeNode {
  id: string;
  type: string;
  label: string;
  summary?: string;
}

interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
}

interface Health {
  score: number;
  level: "critical" | "at_risk" | "healthy";
  label: string;
}

interface ClaimIntelligenceSummary {
  claimId: string;
  claimNumber: string;
  analyzedAt: string;
  health: Health;
  recoveryReadiness: RecoveryReadiness;
  evidenceCompleteness: number;
  documentationCompleteness: number;
  policyAnalysisStatus: string;
  complianceStatus: string;
  aiConfidence: number;
  missingInformation: MissingInfo[];
  openRisks: Risk[];
  nextBestActions: NBAction[];
  knowledgeGraph: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] };
}

interface TimelineEntry {
  source: string;
  content: string;
  createdAt: string;
}

interface CommunicationsResponse {
  communications?: TimelineEntry[];
  extracted?: { entityType: string; value: string; confidence: number }[];
}

interface ClaimIntelligenceProps {
  claimId: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: "bg-success text-white",
  at_risk: "bg-warning text-white",
  critical: "bg-destructive text-white",
};

function ScoreRing({ score, color }: { score: number; color: string }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/30" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 264} 264`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{pct}</span>
      </div>
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${className || "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

export default function ClaimIntelligence({ claimId }: ClaimIntelligenceProps) {
  const [summary, setSummary] = useState<ClaimIntelligenceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [explanation, setExplanation] = useState<Record<string, any>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [timelineExtracted, setTimelineExtracted] = useState<CommunicationsResponse["extracted"] | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<ClaimIntelligenceSummary>(
        `/intelligence/claims/${claimId}/summary`
      );
      setSummary(data);
      setError("");
    } catch (e: any) {
      setError(e.message || "Failed to load claim intelligence");
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    load();
    // Claim Timeline + communications intelligence (extracted entities)
    apiFetch<CommunicationsResponse>(`/intelligence/claims/${claimId}/communications`)
      .then((d) => {
        setTimeline(d.communications || []);
        setTimelineExtracted(d.extracted || []);
      })
      .catch(() => {});
  }, [load, refreshKey, claimId]);

  const toggleExplain = async (action: NBAction) => {
    const next = { ...expanded, [action.id]: !expanded[action.id] };
    setExpanded(next);
    if (next[action.id] && !explanation[action.id]) {
      try {
        const exp = await apiFetch<any>(`/intelligence/claims/${claimId}/explain/${action.id}`);
        setExplanation((prev) => ({ ...prev, [action.id]: exp }));
      } catch {
        setExplanation((prev) => ({ ...prev, [action.id]: null }));
      }
    }
  };

  if (loading && !summary) {
    return (
      <div className="bg-surface rounded-xl border p-6">
        <p className="text-sm text-muted-foreground">Analyzing claim intelligence…</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="bg-surface rounded-xl border p-6">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!summary) return null;

  const rr = summary.recoveryReadiness;
  const kg = summary.knowledgeGraph;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface rounded-xl border p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Claim Intelligence</h2>
          <p className="text-xs text-muted-foreground">
            Live model · last analyzed {new Date(summary.analyzedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge label={`Compliance: ${summary.complianceStatus}`} className="bg-muted text-muted-foreground" />
          <Badge label={`Policy: ${summary.policyAnalysisStatus}`} className="bg-muted text-muted-foreground" />
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="px-3 py-1.5 text-xs bg-muted hover:bg-accent text-foreground rounded-lg transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl border p-5 flex flex-col items-center">
          <p className="text-xs text-muted-foreground mb-2">Claim Health</p>
          <ScoreRing score={summary.health.score} color={summary.health.level === "healthy" ? "#22c55e" : summary.health.level === "at_risk" ? "#f59e0b" : "#ef4444"} />
          <Badge label={summary.health.label} className={`mt-2 ${HEALTH_COLORS[summary.health.level]}`} />
        </div>
        <div className="bg-surface rounded-xl border p-5 flex flex-col items-center">
          <p className="text-xs text-muted-foreground mb-2">Recovery Readiness</p>
          <ScoreRing score={rr.score} color={rr.level === "high" ? "#22c55e" : rr.level === "medium" ? "#f59e0b" : "#ef4444"} />
          <Badge label={rr.label} className={`mt-2 ${rr.level === "high" ? "bg-success text-white" : rr.level === "medium" ? "bg-warning text-white" : "bg-destructive text-white"}`} />
        </div>
        <div className="bg-surface rounded-xl border p-5">
          <p className="text-xs text-muted-foreground mb-3">Evidence & Documentation</p>
          <div className="space-y-3">
            <StatBar label="Evidence Completeness" value={summary.evidenceCompleteness} />
            <StatBar label="Documentation" value={summary.documentationCompleteness} />
            <StatBar label="AI Confidence" value={summary.aiConfidence} />
          </div>
        </div>
        <div className="bg-surface rounded-xl border p-5">
          <p className="text-xs text-muted-foreground mb-3">Status</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Compliance</span><span className="font-medium text-foreground capitalize">{summary.complianceStatus}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Policy Analysis</span><span className="font-medium text-foreground capitalize">{summary.policyAnalysisStatus}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Recommendations</span><span className="font-medium text-foreground">{summary.nextBestActions.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Open Risks</span><span className="font-medium text-foreground">{summary.openRisks.length}</span></div>
          </div>
        </div>
      </div>

      {/* Recovery factors */}
      <div className="bg-surface rounded-xl border p-6">
        <h3 className="text-base font-semibold text-foreground mb-1">Recovery Readiness Factors</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Weighted: Evidence 25% · Documentation 20% · Policy 15% · Carrier 15% · Compliance 15% · AI 10%
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rr.factors.map((f) => (
            <div key={f.key} className="p-3 rounded-lg border bg-muted/30">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-foreground">{f.label}</span>
                <span className="text-sm font-semibold text-foreground">{f.score} <span className="text-xs text-muted-foreground">/ {f.weight}%</span></span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${f.score >= 70 ? "bg-success" : f.score >= 40 ? "bg-warning" : "bg-destructive"}`}
                  style={{ width: `${f.score}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{f.explanation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Next Best Actions */}
      <div className="bg-surface rounded-xl border p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Recommended Next Actions</h3>
        {summary.nextBestActions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions required — claim is on track.</p>
        ) : (
          <div className="space-y-3">
            {summary.nextBestActions.map((a) => (
              <div key={a.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge label={a.priority} className={PRIORITY_COLORS[a.priority]} />
                    <p className="font-medium text-foreground">{a.title}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    confidence {Math.round(a.confidence * 100)}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{a.reason}</p>
                <p className="text-sm text-foreground mt-1">
                  <span className="text-muted-foreground">Do: </span>{a.requiredAction}
                </p>
                <button
                  onClick={() => toggleExplain(a)}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  {expanded[a.id] ? "Hide explanation" : "Why was this recommended?"}
                </button>
                {expanded[a.id] && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/30 border text-xs space-y-1.5">
                    {explanation[a.id] ? (
                      <>
                        <p><span className="text-muted-foreground">Why: </span>{explanation[a.id].why}</p>
                        {explanation[a.id].documentsUsed?.length > 0 && (
                          <p><span className="text-muted-foreground">Documents: </span>{explanation[a.id].documentsUsed.join(", ")}</p>
                        )}
                        {explanation[a.id].photosReferenced?.length > 0 && (
                          <p><span className="text-muted-foreground">Photos: </span>{explanation[a.id].photosReferenced.join(", ")}</p>
                        )}
                        {explanation[a.id].policySectionsReferenced?.length > 0 && (
                          <p><span className="text-muted-foreground">Policy sections: </span>{explanation[a.id].policySectionsReferenced.join(", ")}</p>
                        )}
                        {explanation[a.id].lineItemsContributed?.length > 0 && (
                          <p><span className="text-muted-foreground">Line items: </span>{explanation[a.id].lineItemsContributed.join(", ")}</p>
                        )}
                        {explanation[a.id].evidenceUsed?.length > 0 && (
                          <p><span className="text-muted-foreground">Evidence: </span>{explanation[a.id].evidenceUsed.join(", ")}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground">{explanation[a.id] === null ? "Explanation unavailable." : "Loading explanation…"}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Open Risks & Alerts</h3>
          {summary.openRisks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open risks detected.</p>
          ) : (
            <div className="space-y-2">
              {summary.openRisks.map((r) => (
                <div key={r.id} className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Badge label={r.severity} className={SEVERITY_COLORS[r.severity]} />
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{r.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-surface rounded-xl border p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Missing Information</h3>
          {summary.missingInformation.length === 0 ? (
            <p className="text-sm text-muted-foreground">No missing information.</p>
          ) : (
            <div className="space-y-2">
              {summary.missingInformation.map((m) => (
                <div key={m.id} className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-sm font-medium text-foreground">{m.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{m.detail}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Needed for: {m.requiredFor.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Claim Timeline */}
      <div className="bg-surface rounded-xl border p-6">
        <h3 className="text-base font-semibold text-foreground mb-1">Claim Timeline</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Chronology of communications and analysis milestones on this claim.
        </p>
        {timeline === null ? (
          <p className="text-sm text-muted-foreground">Loading timeline…</p>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timeline events recorded.</p>
        ) : (
          <div className="space-y-0">
            {timeline.map((entry, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5" />
                  {i < timeline.length - 1 && <div className="w-px flex-1 bg-muted" />}
                </div>
                <div className="pb-4 flex-1">
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()} · {entry.source}
                  </p>
                  <p className="text-sm text-foreground mt-0.5">{entry.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {timelineExtracted && timelineExtracted.length > 0 && (
          <div className="mt-4 p-3 rounded-lg border bg-muted/30">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Communications Intelligence — Extracted Entities
            </p>
            <div className="flex flex-wrap gap-1.5">
              {timelineExtracted.map((e, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {e.entityType}: {e.value}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Knowledge Graph */}
      <div className="bg-surface rounded-xl border p-6">
        <h3 className="text-base font-semibold text-foreground mb-1">Claim Knowledge Graph</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {kg.nodes.length} entities · {kg.edges.length} relationships — every recommendation is traceable through these nodes.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Entities</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {kg.nodes.map((n) => (
                <div key={n.id} className="flex items-center gap-2 p-2 rounded bg-muted/30 border">
                  <Badge label={n.type} className="bg-primary/10 text-primary" />
                  <span className="text-sm text-foreground truncate">{n.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Relationships</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {kg.edges.map((e) => (
                <div key={e.id} className="p-2 rounded bg-muted/30 border text-xs">
                  <span className="text-muted-foreground">
                    {e.source.split(":")[1]?.slice(0, 24) || e.source}
                  </span>
                  <span className="mx-1 text-primary">—{e.relation}→</span>
                  <span className="text-foreground">
                    {e.target.split(":")[1]?.slice(0, 24) || e.target}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
