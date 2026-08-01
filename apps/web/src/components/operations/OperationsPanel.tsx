"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  RefreshCw,
  CheckCircle2,
  Circle,
  AlertTriangle,
  DollarSign,
  Target,
  Activity,
  Bot,
  Clock,
} from "lucide-react";

interface LifecycleStageDef {
  stage: string;
  label: string;
  index: number;
  reached: boolean;
}

interface LifecycleInfo {
  currentStage: string;
  currentIndex: number;
  totalStages: number;
  progressPct: number;
  nextStage: string | null;
  recommendedActions: string[];
  stages: LifecycleStageDef[];
}

interface FinancialFigure {
  key: string;
  label: string;
  value: number | null;
  source: string;
  confidence: number;
}

interface FinancialIntelligence {
  originalEstimate: number | null;
  carrierApprovedAmount: number | null;
  contractorEstimate: number | null;
  supplementValue: number;
  recoveredRevenue: number;
  outstandingRevenue: number;
  potentialRecovery: number | null;
  estimatedRecoveryOpportunity: number | null;
  confidenceScore: number;
  figures: FinancialFigure[];
}

interface Opportunity {
  id: string;
  type: string;
  title: string;
  detail: string;
  estimatedValue: number | null;
  confidence: number;
  priority: string;
  evidence: string[];
  requiredAction: string;
  explanation: {
    why: string;
    documentsUsed: string[];
    estimateItemsContributed: string[];
    policyReferencesUsed: string[];
  };
}

interface Recommendation {
  id: string;
  priority: string;
  category: string;
  title: string;
  reason: string;
  supportingEvidence: string[];
  confidence: number;
  estimatedBusinessImpact: string;
  requiredUserAction: string;
}

interface CaseDeadline {
  label: string;
  date: string;
  daysUntil: number;
  severity: "overdue" | "due_soon" | "upcoming";
  source: string;
}

interface CaseManagerReport {
  overallStatus: "on_track" | "attention" | "stalled" | "blocked";
  priorityScore: number;
  stage: string;
  stageProgressPct: number;
  daysSinceLastUpdate: number;
  isStalled: boolean;
  stalledReason: string | null;
  deadlines: CaseDeadline[];
  nextActions: string[];
  aiSummary: string;
}

interface TwinClaim {
  entryPoint: string;
  status: string;
  dateOfLoss: string | null;
  dateReported: string | null;
  createdAt: string;
  updatedAt: string;
  description: string | null;
}

interface DigitalTwin {
  claimId: string;
  claimNumber: string;
  generatedAt: string;
  customer: { name: string | null; email: string | null; phone: string | null };
  property: { address: string | null; city: string | null; state: string | null; zip: string | null } | null;
  policy: { policyNumber: string | null; deductible: number | null; analysisStatus: string; documents: number };
  carrier: { name: string | null; responses: number; latestResponseAt: string | null };
  claim: TwinClaim;
  timeline: { communications: number; events: number; first: string | null; last: string | null };
  photos: { count: number };
  documents: { count: number; byType: Record<string, number> };
  inspections: { count: number; completed: number };
  estimates: { count: number };
  evidenceGraph: { links: number; strongLinks: number };
  aiInsights: {
    healthScore: number;
    healthLevel: string;
    recoveryReadiness: number;
    aiConfidence: number;
    complianceStatus: string;
  };
  supplements: { count: number; submitted: number; approved: number; totalRequested: number; totalApproved: number };
  carrierResponses: { count: number; latest: string | null };
  recommendations: { nextBestActions: number; operational: number };
}

interface OperationsModel {
  claimId: string;
  claimNumber: string;
  generatedAt: string;
  lifecycle: LifecycleInfo;
  financial: FinancialIntelligence;
  opportunities: Opportunity[];
  recommendations: Recommendation[];
  caseManager: CaseManagerReport;
  digitalTwin: DigitalTwin;
}

const money = (v: number | null | undefined) =>
  v == null ? "N/A" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const statusColor: Record<string, string> = {
  critical: "text-red-700 bg-red-100",
  high: "text-orange-700 bg-orange-100",
  medium: "text-amber-700 bg-amber-100",
  low: "text-blue-700 bg-blue-100",
};

export default function OperationsPanel({ claimId }: { claimId: string }) {
  const [data, setData] = useState<OperationsModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const model = await apiFetch<OperationsModel>(`/operations/claims/${claimId}/full`);
      setData(model);
      setError("");
    } catch (e: any) {
      setError(`Failed to load operations model: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-muted-foreground">Running AI Case Manager…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">No operations model available.</p>;

  const { lifecycle, financial, opportunities, recommendations, caseManager, digitalTwin } = data;

  return (
    <div className="space-y-6">
      {/* Case Manager banner */}
      <div className="panel-atlas p-4 rounded-xl border-l-4 border-l-primary">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">AI Case Manager</h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                  caseManager.overallStatus === "on_track"
                    ? "bg-success/10 text-success"
                    : caseManager.overallStatus === "attention"
                      ? "bg-warning/10 text-warning"
                      : "bg-destructive/10 text-destructive"
                }`}
              >
                {caseManager.overallStatus.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{caseManager.aiSummary}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Priority score <span className="font-semibold text-foreground">{caseManager.priorityScore}/100</span> · Last
              activity {caseManager.daysSinceLastUpdate}d ago
              {caseManager.isStalled && <span className="ml-2 text-destructive">⚠ Stalled</span>}
            </p>
          </div>
          <button
            onClick={load}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        {caseManager.nextActions.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {caseManager.nextActions.map((a, i) => (
              <p key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5">→</span>
                {a}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lifecycle */}
        <div className="lg:col-span-2 panel-atlas p-4 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">Claim Lifecycle</h3>
            <span className="text-xs text-muted-foreground">
              {lifecycle.progressPct}% complete · Next:{" "}
              <span className="text-foreground capitalize">{lifecycle.nextStage ? lifecycle.nextStage.replace(/_/g, " ") : "—"}</span>
            </span>
          </div>
          <div className="space-y-1.5">
            {lifecycle.stages.map((s) => (
              <div key={s.stage} className="flex items-center gap-2">
                {s.reached ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
                <span className={`text-sm ${s.reached ? "text-foreground" : "text-muted-foreground/60"}`}>{s.label}</span>
                {s.stage === lifecycle.currentStage && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full ml-auto">Current</span>
                )}
              </div>
            ))}
          </div>
          {lifecycle.recommendedActions.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Recommended Actions</p>
              <ul className="space-y-1.5">
                {lifecycle.recommendedActions.slice(0, 5).map((a, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Twin snapshot */}
        <div className="panel-atlas p-4 rounded-xl">
          <h3 className="text-sm font-medium text-foreground mb-3">Digital Twin</h3>
          <div className="space-y-2.5 text-sm">
            <Row label="Customer" value={digitalTwin.customer.name || "—"} />
            <Row label="Carrier" value={digitalTwin.carrier.name || "—"} />
            <Row label="Policy" value={digitalTwin.policy.policyNumber || "—"} />
            <Row label="Entry" value={digitalTwin.claim.entryPoint.replace(/_/g, " ")} />
            <Row label="Status" value={digitalTwin.claim.status.replace(/_/g, " ")} />
            <Row label="Photos" value={String(digitalTwin.photos.count)} />
            <Row label="Documents" value={String(digitalTwin.documents.count)} />
            <Row label="Estimates" value={String(digitalTwin.estimates.count)} />
            <Row label="Supplements" value={String(digitalTwin.supplements.count)} />
            <Row label="Comms" value={String(digitalTwin.timeline.communications)} />
            <Row label="Evidence links" value={String(digitalTwin.evidenceGraph.links)} />
          </div>
        </div>
      </div>

      {/* Financial */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 panel-atlas p-4 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-success" />
              Financial Intelligence
            </h3>
            <span className="text-xs text-muted-foreground">Confidence {financial.confidenceScore}%</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Fin label="Original Estimate" value={money(financial.originalEstimate)} />
            <Fin label="Carrier Approved" value={money(financial.carrierApprovedAmount)} />
            <Fin label="Supplement Value" value={money(financial.supplementValue)} />
            <Fin label="Recovered" value={money(financial.recoveredRevenue)} />
            <Fin label="Outstanding" value={money(financial.outstandingRevenue)} />
            <Fin label="Potential Recovery" value={money(financial.potentialRecovery)} />
            <Fin label="Est. Opportunity" value={money(financial.estimatedRecoveryOpportunity)} accent />
          </div>
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Sources</p>
            <div className="space-y-1">
              {financial.figures.map((f) => (
                <p key={f.key} className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{f.label}:</span> {f.value != null ? money(f.value) : "—"}{" "}
                  <span className="italic">({f.source})</span>
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Deadlines */}
        <div className="panel-atlas p-4 rounded-xl">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-warning" />
            Deadlines
          </h3>
          {caseManager.deadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
          ) : (
            <div className="space-y-2">
              {caseManager.deadlines.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[65%]">{d.label}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      d.severity === "overdue" ? "bg-red-100 text-red-700" : d.severity === "due_soon" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {d.daysUntil < 0 ? `${Math.abs(d.daysUntil)}d overdue` : `${d.daysUntil}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Opportunities */}
        <div className="panel-atlas p-4 rounded-xl">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-accent" />
            Revenue Opportunities
          </h3>
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revenue opportunities detected.</p>
          ) : (
            <div className="space-y-2">
              {opportunities.map((o) => (
                <details key={o.id} className="p-3 bg-muted/40 rounded-lg group">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${statusColor[o.priority] || "bg-muted text-foreground"}`}>{o.priority}</span>
                      <span className="text-sm font-medium text-foreground">{o.title}</span>
                    </div>
                    <span className="text-sm font-semibold text-success">{o.estimatedValue != null ? money(o.estimatedValue) : "—"}</span>
                  </summary>
                  <div className="mt-2 text-sm text-muted-foreground space-y-1.5">
                    <p>{o.detail}</p>
                    <p>
                      <span className="text-foreground font-medium">Why:</span> {o.explanation.why}
                    </p>
                    {o.evidence.length > 0 && (
                      <p>
                        <span className="text-foreground font-medium">Evidence:</span> {o.evidence.slice(0, 5).join(", ")}
                      </p>
                    )}
                    <p>
                      <span className="text-foreground font-medium">Action:</span> {o.requiredAction}
                    </p>
                    <p className="text-xs">Confidence {Math.round(o.confidence * 100)}%</p>
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        {/* Operational recommendations */}
        <div className="panel-atlas p-4 rounded-xl">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            Operational Recommendations
          </h3>
          {recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No operational recommendations.</p>
          ) : (
            <div className="space-y-2">
              {recommendations.map((r) => (
                <div key={r.id} className="p-3 bg-muted/40 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${statusColor[r.priority] || "bg-muted text-foreground"}`}>{r.priority}</span>
                      <span className="text-sm font-medium text-foreground">{r.title}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary capitalize">{r.category}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5">{r.reason}</p>
                  <p className="text-xs text-success mt-1.5 font-medium">Impact: {r.estimatedBusinessImpact}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-foreground font-medium">Action:</span> {r.requiredUserAction}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI insights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric icon={<Activity className="h-4 w-4" />} label="Claim Health" value={`${digitalTwin.aiInsights.healthScore}/100`} />
        <Metric icon={<Target className="h-4 w-4" />} label="Recovery Readiness" value={`${digitalTwin.aiInsights.recoveryReadiness}/100`} />
        <Metric icon={<Bot className="h-4 w-4" />} label="AI Confidence" value={`${digitalTwin.aiInsights.aiConfidence}%`} />
        <Metric
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Compliance"
          value={digitalTwin.aiInsights.complianceStatus.replace(/_/g, " ")}
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground capitalize">{label}</span>
      <span className="text-sm text-foreground capitalize truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function Fin({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-3 bg-muted/40 rounded-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${accent ? "text-success" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="panel-atlas p-4 rounded-xl">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-primary">{icon}</span>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-semibold text-foreground capitalize">{value}</p>
    </div>
  );
}
