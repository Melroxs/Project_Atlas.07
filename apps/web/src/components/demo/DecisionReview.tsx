'use client';

// apps/web/src/components/demo/DecisionReview.tsx
// Explainable Decision Engine review. Loads the flagship decision from the
// live API (falling back to the canonical demo dataset), explains every score,
// and lets the user Approve / Reject / Regenerate — persisted via the real
// decisions API when data exists, simulated cleanly otherwise.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useDemoToast } from './DemoToast';

type ReviewAction = 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGES' | 'REGENERATE';

interface ReviewData {
  decisionId: string | null;
  status: string;
  confidence: number;
  risk: number;
  compliance: number;
  subScores: { evidence: number; coverage: number; compliance: number; riskFactor: number; final: number };
  reasoning: string[];
  evidence: string[];
  missingEvidence: string[];
  actions: string[];
  approvalProbability: number;
}

const CANONICAL: ReviewData = {
  decisionId: null,
  status: 'GENERATED',
  confidence: 88.5,
  risk: 22,
  compliance: 94,
  subScores: { evidence: 88, coverage: 92, compliance: 94, riskFactor: 18, final: 90 },
  reasoning: [
    '22 inspection photos verified — hail impacts on 12% of roof area',
    'NOAA weather record confirms 61 mph gusts and 1.25" hail on loss date (policy threshold: 55 mph)',
    'Drone photogrammetry measures 26 squares — within 2% of tape measure',
    '2023 Florida Building Code R905.2.8.2 requires code-compliant underlayment at full replacement',
    'Scope priced with Xactimate line items — all within regional ranges',
    'Coverage confirmed under policy UPC-55420-FL (wind & hail, $1,000 deductible)',
  ],
  evidence: [
    'Inspection Photos — strength 0.95 (high)',
    'Drone Imagery — strength 0.90 (high)',
    'Weather Verification — strength 0.85 (high)',
    'Roof Measurements — strength 0.80 (medium)',
    'Code Compliance Report — strength 0.88 (high)',
  ],
  missingEvidence: [
    'Third-party weather report (NOAA is accepted, carrier may request secondary)',
    'Contractor invoice prior to submission',
  ],
  actions: [
    'Submit with 5 linked evidence documents',
    'Include NOAA station metadata to pre-empt weather disputes',
    'Attach RCVD/ACV breakdown for depreciation',
  ],
  approvalProbability: 84,
};

function ScoreRing({ label, value, color, suffix = '/100' }: { label: string; value: number; color: string; suffix?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative w-20 h-20 rounded-full"
        style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, var(--neutral-gray-200) 0deg)` }}
      >
        <div className="absolute inset-2 rounded-full bg-[var(--surface)] flex items-center justify-center">
          <span className="text-lg font-bold text-[var(--foreground)]">{value}</span>
        </div>
      </div>
      <p className="text-[11px] font-medium text-[var(--neutral-gray-500)] uppercase tracking-wide">{label}</p>
      <p className="text-[10px] font-mono text-[var(--neutral-gray-400)] -mt-1">{suffix}</p>
    </div>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--background-alt)] rounded-lg border border-[var(--neutral-gray-200)] p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-[var(--neutral-gray-500)]">{label}</span>
        <span className="text-xs font-bold text-[var(--foreground)] font-mono">{value}</span>
      </div>
      <div className="h-1 bg-[var(--neutral-gray-200)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--brand-cyan)] rounded-full transition-all duration-700" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function DecisionReview({ onRefresh }: { onRefresh?: () => void }) {
  const router = useRouter();
  const toast = useDemoToast();
  const [data, setData] = useState<ReviewData>(CANONICAL);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  // Load the real flagship decision when demo data exists.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await apiFetch<{ decisions: Array<{ id: string; claimNumber?: string; title?: string; status?: string; confidenceScore?: string; riskScore?: string; complianceScore?: string }> }>('/decisions')) as any;
        const decisions: any[] = list?.decisions ?? [];
        const flagship =
          decisions.find((d) => d.claimNumber === 'CL-2026-0614' || String(d.title || '').includes('Carter')) || decisions[0];
        if (active && flagship?.id) {
          let detail: any = null;
          try {
            detail = await apiFetch<any>(`/decisions/${flagship.id}`);
          } catch {
            detail = null;
          }
          const ctx = detail?.decisionContext ?? detail?.decision ?? detail?.context ?? null;
          // The decisions API returns the score row as `detail.score`, evidence
          // links as `detail.evidence`, reasoning logs as `detail.reasoning` and
          // actions as `detail.actions` — read those so the panel shows the real
          // persisted values once demo data exists (not just the fallback).
          const scores = ctx?.scores ?? detail?.scores ?? detail?.score ?? null;
          const liveEvidence =
            detail?.evidence?.length
              ? detail.evidence
              : Array.isArray(ctx?.evidence)
                ? ctx.evidence
                : null;
          const liveReasoning = detail?.reasoning?.length ? detail.reasoning : null;
          const liveActions = detail?.actions?.length ? detail.actions : null;
          setData({
            decisionId: flagship.id,
            status: ctx?.status ?? flagship.status ?? 'GENERATED',
            confidence: Number(ctx?.confidenceScore ?? flagship.confidenceScore ?? 88.5) || 88.5,
            risk: Number(ctx?.riskScore ?? flagship.riskScore ?? 22) || 22,
            compliance: Number(ctx?.complianceScore ?? flagship.complianceScore ?? 94) || 94,
            subScores: {
              evidence: Number(scores?.evidenceScore ?? 88) || 88,
              coverage: Number(scores?.coverageScore ?? 92) || 92,
              compliance: Number(scores?.complianceScore ?? 94) || 94,
              riskFactor: Number(scores?.riskFactorScore ?? 18) || 18,
              final: Number(scores?.finalScore ?? 90) || 90,
            },
            reasoning: liveReasoning
              ? liveReasoning.map((r: any) => {
                  const label = String(r.reasoningType || '').replace(/_/g, ' ').toLowerCase();
                  let summary = '';
                  if (typeof r.outputData === 'string') summary = r.outputData;
                  else if (r.outputData && typeof r.outputData === 'object') {
                    const values = Object.values(r.outputData).filter((x) => x != null && typeof x !== 'object');
                    summary = values.slice(0, 4).join(' · ');
                  }
                  return summary ? `${label}: ${summary}` : label || 'Reasoning step';
                }).filter(Boolean)
              : CANONICAL.reasoning,
            evidence: liveEvidence
              ? liveEvidence.map((e: any) =>
                  typeof e === 'string'
                    ? e
                    : `${e.title ?? (e.relationshipType ? 'Evidence link' : 'Document')} — strength ${e.strength ?? e.importanceScore ?? '—'}`,
                )
              : CANONICAL.evidence,
            missingEvidence: CANONICAL.missingEvidence,
            actions: liveActions
              ? liveActions.map((a: any) => a.description || String(a.actionType || '').replace(/_/g, ' ')).filter(Boolean)
              : CANONICAL.actions,
            approvalProbability: 84,
          });
        }
      } catch {
        // Fall back to canonical demo dataset.
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const nextStatus = (action: ReviewAction) =>
    action === 'APPROVED' ? 'APPROVED' : action === 'REJECTED' ? 'REJECTED' : action === 'REQUEST_CHANGES' ? 'REQUEST_CHANGES' : 'GENERATED';

  const review = async (action: ReviewAction) => {
    const key = action;
    setBusy(key);
    try {
      if (data.decisionId) {
        try {
          await apiFetch(`/decisions/${data.decisionId}`, {
            method: 'POST',
            body: JSON.stringify({ action, comments: 'Reviewed from the Full Atlas Demo' }),
          });
          setData((d) => ({ ...d, status: nextStatus(action) }));
          toast.success(
            action === 'APPROVED'
              ? 'Decision approved — persisted to the decision queue'
              : action === 'REJECTED'
                ? 'Decision rejected — flagged for rework'
                : action === 'REQUEST_CHANGES'
                  ? 'Decision sent for review — changes requested'
                  : 'Decision regenerated — new version created',
          );
          onRefresh?.();
        } catch {
          // Real API unavailable → simulate locally so the demo never dead-ends.
          setData((d) => ({ ...d, status: nextStatus(action) }));
          toast.info('Demo mode — decision state updated locally (generate demo data to persist)');
        }
      } else {
        setData((d) => ({ ...d, status: nextStatus(action) }));
        toast.success(
          action === 'APPROVED' ? 'Decision approved' : action === 'REJECTED' ? 'Decision rejected' : action === 'REQUEST_CHANGES' ? 'Requested review' : 'Decision regenerated',
        );
      }
    } catch (err) {
      console.error('Decision review error:', err);
      toast.error('Something went wrong — please try again');
    } finally {
      setBusy(null);
    }
  };

  const statusChip =
    data.status === 'APPROVED'
      ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
      : data.status === 'REJECTED'
        ? 'bg-[var(--color-error)]/15 text-[var(--color-error)]'
        : data.status === 'REQUEST_CHANGES' || data.status === 'IN_REVIEW'
          ? 'bg-[var(--brand-purple)]/15 text-[var(--brand-purple)]'
          : 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]';

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="text-xl">🧠</span> Decision Review
          </h3>
          <p className="text-xs text-[var(--neutral-gray-500)] mt-1">
            Explainable AI — every score traced to evidence {loaded ? '· synced with live data' : ''}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusChip}`}>{data.status}</span>
      </div>

      {!loaded && (
        <div className="text-center py-6 text-sm text-[var(--neutral-gray-500)]">
          <span className="animate-pulse">Loading decision context…</span>
        </div>
      )}

      {loaded && (
        <>
          {/* Score rings */}
          <div className="flex items-center justify-around gap-2 mb-5">
            <ScoreRing label="Confidence" value={data.confidence} color="var(--brand-cyan)" />
            <ScoreRing label="Risk" value={data.risk} color={data.risk < 35 ? 'var(--color-success)' : 'var(--color-warning)'} />
            <ScoreRing label="Compliance" value={data.compliance} color="var(--brand-purple)" />
          </div>

          {/* Sub-scores */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
            <SubScore label="Evidence" value={data.subScores.evidence} />
            <SubScore label="Coverage" value={data.subScores.coverage} />
            <SubScore label="Compliance" value={data.subScores.compliance} />
            <SubScore label="Risk factor" value={data.subScores.riskFactor} />
            <SubScore label="Final" value={data.subScores.final} />
          </div>

          {/* Approval probability */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[var(--neutral-gray-500)]">Estimated approval probability</span>
              <span className="text-sm font-bold text-[var(--color-success)] font-mono">{data.approvalProbability}%</span>
            </div>
            <div className="h-2 bg-[var(--neutral-gray-200)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--color-success)] to-[var(--brand-cyan)] rounded-full transition-all duration-1000"
                style={{ width: `${data.approvalProbability}%` }}
              />
            </div>
          </div>

          {/* Reasoning / evidence panels */}
          {explainOpen && (
            <div className="fade-up mb-4 bg-[var(--background-alt)] rounded-lg border border-[var(--brand-purple)]/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-purple)] mb-2">Why Atlas reached this conclusion</p>
              <ol className="space-y-1.5">
                {data.reasoning.map((r, i) => (
                  <li key={i} className="text-xs text-[var(--neutral-gray-500)] flex gap-2">
                    <span className="text-[var(--brand-cyan)] font-mono shrink-0">{i + 1}.</span> {r}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {evidenceOpen && (
            <div className="fade-up mb-4 space-y-3">
              <div className="bg-[var(--background-alt)] rounded-lg border border-[var(--neutral-gray-200)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-cyan)] mb-2">Supporting evidence</p>
                <ul className="space-y-1.5">
                  {data.evidence.map((e, i) => (
                    <li key={i} className="text-xs text-[var(--neutral-gray-500)] flex gap-2">
                      <span className="text-[var(--color-success)] shrink-0">●</span> {e}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[var(--background-alt)] rounded-lg border border-[var(--color-warning)]/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-warning)] mb-2">Missing evidence</p>
                <ul className="space-y-1.5">
                  {data.missingEvidence.map((e, i) => (
                    <li key={i} className="text-xs text-[var(--neutral-gray-500)] flex gap-2">
                      <span className="shrink-0">⚠️</span> {e}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[var(--background-alt)] rounded-lg border border-[var(--neutral-gray-200)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-success)] mb-2">Recommended actions</p>
                <ul className="space-y-1.5">
                  {data.actions.map((a, i) => (
                    <li key={i} className="text-xs text-[var(--neutral-gray-500)] flex gap-2">
                      <span className="text-[var(--color-success)] shrink-0">→</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => review('APPROVED')}
              disabled={busy !== null}
              className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50 ${data.status === 'APPROVED' ? 'bg-[var(--color-success)]/50 cursor-default' : 'bg-[var(--color-success)] hover:bg-green-600 shadow-md'}`}
            >
              {busy === 'APPROVED' ? 'Approving…' : data.status === 'APPROVED' ? '✓ Approved' : 'Approve'}
            </button>
            <button
              onClick={() => review('REJECTED')}
              disabled={busy !== null}
              className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50 ${data.status === 'REJECTED' ? 'bg-[var(--color-error)]/50 cursor-default' : 'bg-[var(--color-error)] hover:bg-red-600 shadow-md'}`}
            >
              {busy === 'REJECTED' ? 'Rejecting…' : data.status === 'REJECTED' ? '✕ Rejected' : 'Reject'}
            </button>
            <button
              onClick={() => review('REQUEST_CHANGES')}
              disabled={busy !== null}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] disabled:opacity-50 ${
                data.status === 'REQUEST_CHANGES'
                  ? 'bg-[var(--brand-purple)]/25 text-[var(--brand-purple)] cursor-default'
                  : 'bg-[var(--brand-purple)] hover:bg-[var(--brand-purple-light)] text-white shadow-md'
              }`}
            >
              {busy === 'REQUEST_CHANGES' ? 'Requesting…' : data.status === 'REQUEST_CHANGES' ? '✓ Review requested' : 'Request Review'}
            </button>
            <button
              onClick={() => review('REGENERATE')}
              disabled={busy !== null}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--brand-cyan)] hover:bg-[var(--brand-cyan-light)] text-white transition-all active:scale-[0.97] disabled:opacity-50 shadow-md"
            >
              {busy === 'REGENERATE' ? 'Regenerating…' : '↻ Regenerate'}
            </button>
            <button
              onClick={() => setExplainOpen((v) => !v)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${explainOpen ? 'border-[var(--brand-purple)] text-[var(--brand-purple)] bg-[var(--brand-purple)]/10' : 'border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-purple)]'}`}
            >
              {explainOpen ? 'Hide explanation' : 'Explain Decision'}
            </button>
            <button
              onClick={() => setEvidenceOpen((v) => !v)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${evidenceOpen ? 'border-[var(--brand-cyan)] text-[var(--brand-cyan)] bg-[var(--brand-cyan)]/10' : 'border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)]'}`}
            >
              {evidenceOpen ? 'Hide evidence' : 'View Supporting Evidence'}
            </button>
            <button
              onClick={() => router.push('/admin/decisions')}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] hover:text-[var(--brand-cyan)] transition-colors"
              title="Open the decision queue in Atlas"
            >
              Open decision record ↗
            </button>
          </div>
        </>
      )}
    </div>
  );
}
