"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Activity,
  ArrowRight,
  Clock,
} from "lucide-react";

interface RevenueDashboard {
  totalActiveClaims: number;
  claimsAwaitingResponse: number;
  claimsReadyForSupplement: number;
  claimsMissingEvidence: number;
  claimsAtRisk: number;
  estimatedRecoverableRevenue: number;
  revenueAlreadyRecovered: number;
  outstandingOpportunity: number;
  averageClaimHealth: number;
  averageRecoveryReadiness: number;
  averageAIConfidence: number;
}

interface ClaimSummary {
  claimId: string;
  claimNumber: string;
  status: string;
  insuranceCompany: string | null;
  customerName: string | null;
  lifecycleStage: string;
  healthScore: number;
  recoveryReadiness: number;
  outstandingOpportunity: number;
  isStalled: boolean;
  atRisk: boolean;
}

interface ExecutiveDashboard {
  companyHealth: number;
  claimPipeline: { label: string; count: number }[];
  revenuePipeline: { label: string; count: number; value: number }[];
  highRiskClaims: ClaimSummary[];
  upcomingDeadlines: { claimId: string; claimNumber: string; label: string; date: string; daysUntil: number; severity: string }[];
  teamWorkload: { label: string; count: number }[];
  aiRecommendations: { claimId: string; claimNumber: string; title: string; priority: string }[];
  revenueForecast: { bucket: string; value: number; confidence: number }[];
  operationalBottlenecks: { stage: string; count: number; avgDaysInStage: number; issue: string }[];
}

interface PortfolioIntelligence {
  commonMissingDocumentation: { label: string; count: number }[];
  frequentlyDelayedStages: { stage: string; count: number }[];
  recurringCarrierRequests: { request: string; count: number }[];
  repeatedEvidenceGaps: { gap: string; count: number }[];
  claimsRequiringImmediateAttention: ClaimSummary[];
  revenueConcentrationByCarrier: { carrier: string; estimatedValue: number; pct: number }[];
  averageClaimDurationDays: number;
  supplementSuccessRates: { total: number; submitted: number; approved: number; approvedPct: number; valueApprovedPct: number };
  trends: { label: string; value: number }[];
}

interface Overview {
  revenue: RevenueDashboard;
  executive: ExecutiveDashboard;
  portfolio: PortfolioIntelligence;
}

const money = (v: number | null | undefined) =>
  v == null ? "N/A" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const statusColor: Record<string, string> = {
  critical: "text-red-600 bg-red-100",
  high: "text-orange-600 bg-orange-100",
  medium: "text-amber-600 bg-amber-100",
  low: "text-blue-600 bg-blue-100",
  approved: "text-emerald-600 bg-emerald-100",
};

export default function OperationsDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"revenue" | "executive" | "portfolio">("revenue");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<any>("/operations/company/overview");
      if (res?.empty) {
        setEmpty(true);
        setData(null);
      } else {
        setData(res);
        setEmpty(false);
      }
      setError("");
    } catch (e: any) {
      setError(`Failed to load operations overview: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading operations dashboard…</p>;
  if (empty)
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-lg font-medium text-foreground">No claims yet</p>
        <p className="mt-1 text-sm">Create a claim to unlock the Operations Intelligence dashboards.</p>
      </div>
    );
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return null;

  const { revenue, executive, portfolio } = data;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 border-b pb-3">
          {(["revenue", "executive", "portfolio"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "revenue" ? "Revenue Recovery" : t === "executive" ? "Executive" : "Portfolio"}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {tab === "revenue" && <RevenueView r={revenue} />}
      {tab === "executive" && <ExecutiveView e={executive} />}
      {tab === "portfolio" && <PortfolioView p={portfolio} />}
    </div>
  );
}

function MetricCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="panel-atlas p-4 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <span className={`p-1.5 rounded-lg ${accent}`}>{icon}</span>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function RevenueView({ r }: { r: RevenueDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Active Claims" value={String(r.totalActiveClaims)} icon={<Activity className="h-4 w-4" />} accent="bg-primary/10 text-primary" />
        <MetricCard label="Awaiting Response" value={String(r.claimsAwaitingResponse)} icon={<Clock className="h-4 w-4" />} accent="bg-accent/10 text-accent" />
        <MetricCard label="Ready for Supplement" value={String(r.claimsReadyForSupplement)} icon={<TrendingUp className="h-4 w-4" />} accent="bg-success/10 text-success" />
        <MetricCard label="At Risk" value={String(r.claimsAtRisk)} icon={<AlertTriangle className="h-4 w-4" />} accent="bg-destructive/10 text-destructive" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard label="Recoverable Revenue" value={money(r.estimatedRecoverableRevenue)} icon={<DollarSign className="h-4 w-4" />} accent="bg-success/10 text-success" />
        <MetricCard label="Revenue Recovered" value={money(r.revenueAlreadyRecovered)} icon={<DollarSign className="h-4 w-4" />} accent="bg-primary/10 text-primary" />
        <MetricCard label="Outstanding Opportunity" value={money(r.outstandingOpportunity)} icon={<TrendingUp className="h-4 w-4" />} accent="bg-accent/10 text-accent" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Avg Claim Health" value={`${r.averageClaimHealth}/100`} icon={<Activity className="h-4 w-4" />} accent="bg-success/10 text-success" />
        <MetricCard label="Avg Recovery Readiness" value={`${r.averageRecoveryReadiness}/100`} icon={<TrendingUp className="h-4 w-4" />} accent="bg-primary/10 text-primary" />
        <MetricCard label="Avg AI Confidence" value={`${r.averageAIConfidence}%`} icon={<Activity className="h-4 w-4" />} accent="bg-accent/10 text-accent" />
      </div>
    </div>
  );
}

function ExecutiveView({ e }: { e: ExecutiveDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Company Health" value={`${e.companyHealth}/100`} icon={<Activity className="h-4 w-4" />} accent="bg-success/10 text-success" />
        <MetricCard label="High-Risk Claims" value={String(e.highRiskClaims.length)} icon={<AlertTriangle className="h-4 w-4" />} accent="bg-destructive/10 text-destructive" />
        <MetricCard label="Active Deadlines" value={String(e.upcomingDeadlines.length)} icon={<Clock className="h-4 w-4" />} accent="bg-warning/10 text-warning" />
        <MetricCard label="Pipeline Stages" value={String(e.claimPipeline.length)} icon={<TrendingUp className="h-4 w-4" />} accent="bg-primary/10 text-primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Claim Pipeline">
          {e.claimPipeline.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {e.claimPipeline.map((p) => (
                <div key={p.label} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-40 truncate capitalize">{p.label}</span>
                  <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, p.count * 10)}%` }} />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Revenue Pipeline">
          {e.revenuePipeline.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {e.revenuePipeline.map((p) => (
                <div key={p.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className="font-medium text-foreground">
                    {p.count} · {money(p.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Revenue Forecast">
          {e.revenueForecast.map((f) => (
            <div key={f.bucket} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-muted-foreground">{f.bucket}</span>
              <span className="font-medium text-foreground">
                {money(f.value)} <span className="text-xs text-muted-foreground">({Math.round(f.confidence * 100)}%)</span>
              </span>
            </div>
          ))}
        </Panel>

        <Panel title="Operational Bottlenecks">
          {e.operationalBottlenecks.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {e.operationalBottlenecks.map((b) => (
                <div key={b.stage} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize text-foreground">{b.stage.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">{b.count} claim(s)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{b.issue}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Upcoming Deadlines">
          {e.upcomingDeadlines.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {e.upcomingDeadlines.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-foreground">{d.claimNumber}</span>
                    <span className="text-muted-foreground ml-2">{d.label}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${d.severity === "overdue" ? "bg-red-100 text-red-700" : d.severity === "due_soon" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    {d.daysUntil < 0 ? `${Math.abs(d.daysUntil)}d overdue` : `${d.daysUntil}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="AI Recommendations">
          {e.aiRecommendations.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {e.aiRecommendations.map((r, i) => (
                <a key={i} href={`/admin/claims/${r.claimId}?tab=operations`} className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-muted transition-colors">
                  <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${statusColor[r.priority] || "bg-muted text-foreground"}`}>{r.priority}</span>
                  <div>
                    <p className="text-sm text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.claimNumber}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="High-Risk Claims">
        {e.highRiskClaims.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {e.highRiskClaims.map((c) => (
              <a key={c.claimId} href={`/admin/claims/${c.claimId}?tab=operations`} className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{c.claimNumber}</span>
                  <span className="text-xs text-destructive">{c.healthScore}/100</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {c.customerName || "Unknown customer"} · {c.insuranceCompany || "No carrier"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{c.lifecycleStage.replace(/_/g, " ")}</p>
              </a>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function PortfolioView({ p }: { p: PortfolioIntelligence }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Common Missing Documentation">
          {p.commonMissingDocumentation.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {p.commonMissingDocumentation.map((m) => (
                <div key={m.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-medium text-foreground">{m.count} claim(s)</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recurring Carrier Requests">
          {p.recurringCarrierRequests.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {p.recurringCarrierRequests.map((r) => (
                <div key={r.request} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[70%]">{r.request}</span>
                  <span className="font-medium text-foreground">{r.count}×</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Revenue Concentration by Carrier">
          {p.revenueConcentrationByCarrier.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {p.revenueConcentrationByCarrier.map((c) => (
                <div key={c.carrier} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-40 truncate">{c.carrier}</span>
                  <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                    <div className="bg-success h-full rounded-full" style={{ width: `${Math.min(100, c.pct)}%` }} />
                  </div>
                  <span className="text-xs font-medium w-24 text-right">{money(c.estimatedValue)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Supplement Success">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Approved rate</p>
              <p className="text-2xl font-semibold text-foreground">{p.supplementSuccessRates.approvedPct}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {p.supplementSuccessRates.approved} / {p.supplementSuccessRates.total} supplements
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Value approved</p>
              <p className="text-2xl font-semibold text-foreground">{p.supplementSuccessRates.valueApprovedPct}%</p>
              <p className="text-xs text-muted-foreground mt-1">of requested value</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg claim duration</p>
              <p className="text-2xl font-semibold text-foreground">{p.averageClaimDurationDays}d</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Immediate attention</p>
              <p className="text-2xl font-semibold text-foreground">{p.claimsRequiringImmediateAttention.length}</p>
            </div>
          </div>
        </Panel>
      </div>

      {p.claimsRequiringImmediateAttention.length > 0 && (
        <Panel title="Claims Requiring Immediate Attention">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {p.claimsRequiringImmediateAttention.map((c) => (
              <a key={c.claimId} href={`/admin/claims/${c.claimId}?tab=operations`} className="p-3 rounded-lg border border-destructive/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{c.claimNumber}</span>
                  <span className="text-xs text-destructive">{c.isStalled ? "Stalled" : c.atRisk ? "At risk" : ""}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{c.lifecycleStage.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <ArrowRight className="inline h-3 w-3 mr-1" />
                  Open claim
                </p>
              </a>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel-atlas p-4 rounded-xl">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">Nothing here yet.</p>;
}
