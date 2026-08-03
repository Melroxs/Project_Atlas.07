'use client';

// apps/web/src/components/demo/WalkthroughPlayer.tsx
// Guided walkthrough player with two modes:
//  - narrative (default): steps advance with an "Atlas analyzing…" phase,
//    progress bar, per-step "open in Atlas" navigation and a completion screen.
//  - live: Atlas actually EXECUTES the full 17-step claim lifecycle against
//    the live database (POST /api/demo/run-step) — every step writes real
//    records, so metrics, activities and claim status change in real time.
//    The player shows the AI console, a lifecycle rail and live metrics, and
//    finishes on a completed claim.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useDemoToast } from './DemoToast';
import {
  LIFECYCLE_STEPS,
  fmtMoney,
  type LifecycleMetrics,
  type LifecycleClaimSnap,
} from '@/lib/demo-lifecycle';
import type { WalkthroughDef } from './walkthroughs';

interface Props {
  open: boolean;
  walkthrough: WalkthroughDef | null;
  onClose: () => void;
  /** When true, the walkthrough runs the live lifecycle instead of a static tour. */
  live?: boolean;
  /** Called when a live run finishes (so the page can refresh metrics). */
  onLiveComplete?: () => void;
}

const THINK_MS = 1000;

interface LogLine {
  kind: 'thinking' | 'action' | 'done' | 'error';
  text: string;
}

const LOG_STYLE: Record<LogLine['kind'], { icon: string; cls: string }> = {
  thinking: { icon: '⏳', cls: 'text-[var(--brand-purple)]' },
  action: { icon: '⚙️', cls: 'text-[var(--brand-cyan)]' },
  done: { icon: '✓', cls: 'text-[var(--color-success)]' },
  error: { icon: '⚠️', cls: 'text-[var(--color-error)]' },
};

export default function WalkthroughPlayer({ open, walkthrough, onClose, live = false, onLiveComplete }: Props) {
  const router = useRouter();
  const toast = useDemoToast();

  // Narrative mode state
  const [stepIndex, setStepIndex] = useState(0);
  const [thinking, setThinking] = useState(true);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Live mode state
  const [livePhase, setLivePhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [liveIdx, setLiveIdx] = useState(-1);
  const [liveLog, setLiveLog] = useState<LogLine[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<LifecycleMetrics | null>(null);
  const [liveClaim, setLiveClaim] = useState<LifecycleClaimSnap | null>(null);
  const [liveDesc, setLiveDesc] = useState('');
  const liveToken = useRef(0);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setStepIndex(0);
    setFinished(false);
    setThinking(true);
    setLivePhase('idle');
    setLiveIdx(-1);
    setLiveLog([]);
    setLiveMetrics(null);
    setLiveClaim(null);
    setLiveDesc('');
    liveToken.current += 1;
  }, []);

  useEffect(() => {
    if (open && walkthrough) reset();
  }, [open, walkthrough, reset]);

  // Narrative thinking timer
  useEffect(() => {
    if (!open || !walkthrough || finished || live) return;
    setThinking(true);
    timerRef.current = window.setTimeout(() => setThinking(false), THINK_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [open, walkthrough, stepIndex, finished, live]);

  // Auto-scroll the live AI console.
  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight, behavior: 'smooth' });
  }, [liveLog]);

  // Live engine — executes the lifecycle against the database.
  useEffect(() => {
    if (!open || !live || livePhase !== 'running') return;
    const token = ++liveToken.current;
    let disposed = false;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          if (!disposed && token === liveToken.current) resolve();
        }, ms);
      });

    const push = (line: LogLine) => {
      if (token !== liveToken.current || disposed) return;
      setLiveLog((prev) => [...prev.slice(-40), line]);
    };

    (async () => {
      for (let i = 0; i < LIFECYCLE_STEPS.length && token === liveToken.current && !disposed; i++) {
        const step = LIFECYCLE_STEPS[i];
        setLiveIdx(i);
        setLiveDesc('');
        push({ kind: 'thinking', text: step.ai });
        await wait(1400);
        if (token !== liveToken.current || disposed) return;

        push({ kind: 'action', text: `Executing: ${step.label}` });
        try {
          const res = (await apiFetch('/demo/run-step', {
            method: 'POST',
            body: JSON.stringify({ stepId: step.id }),
          })) as {
            timeline?: Array<{ description: string }>;
            metrics?: LifecycleMetrics;
            claim?: LifecycleClaimSnap | null;
          };
          if (res.timeline?.[0]?.description) {
            setLiveDesc(res.timeline[0].description);
            push({ kind: 'done', text: res.timeline[0].description });
          }
          if (res.metrics) setLiveMetrics(res.metrics);
          if (res.claim) setLiveClaim(res.claim);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes('not found') || message.includes('404')) {
            push({ kind: 'error', text: 'Flagship claim missing — generate demo data first' });
            toast.error('Flagship claim not found — please generate demo data first');
            setLivePhase('idle');
            return;
          }
          push({ kind: 'error', text: 'Step failed — continuing with the next step' });
        }
        await wait(800);
        if (token !== liveToken.current || disposed) return;
      }

      setLiveIdx(LIFECYCLE_STEPS.length - 1);
      setLivePhase('done');
      toast.success('Workflow complete — the lifecycle ran against the live database');
      onLiveComplete?.();
    })();

    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, live, livePhase]);

  if (!open || !walkthrough) return null;

  const steps = walkthrough.steps;
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const progress = ((stepIndex + 1) / steps.length) * 100;
  const isLast = stepIndex === steps.length - 1;
  const liveRunning = livePhase === 'running';
  const liveDone = livePhase === 'done';

  // Narrative controls
  const goNext = () => {
    if (isLast) {
      setFinished(true);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    setStepIndex((i) => i - 1);
  };

  const openTarget = (path: string) => {
    router.push(path);
    onClose();
  };

  const openClaim = () => {
    if (liveClaim?.id) {
      router.push(`/admin/claims/${liveClaim.id}`);
      onClose();
    } else {
      toast.info('Claim opens after the workflow creates it');
    }
  };

  const goExport = () => {
    onClose();
    setTimeout(() => {
      document.getElementById('demo-export')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const liveProgress = liveRunning || liveDone ? ((liveIdx + 1) / LIFECYCLE_STEPS.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[95] bg-[var(--atlas-void)]/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--neutral-gray-200)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r ${walkthrough.color} px-6 py-5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{walkthrough.icon}</span>
              <div>
                <h3 className="text-lg font-bold text-white">{walkthrough.title}</h3>
                <p className="text-white/80 text-sm">
                  {live
                    ? liveRunning
                      ? 'Running this workflow against the live database'
                      : liveDone
                        ? 'Workflow complete — claim lifecycle executed'
                        : walkthrough.tagline
                    : walkthrough.tagline}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors" aria-label="Close walkthrough">
              ✕
            </button>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${live ? (liveDone ? 100 : liveProgress) : finished ? 100 : progress}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {live ? (
            /* ---------- LIVE MODE ---------- */
            livePhase === 'idle' ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[var(--brand-cyan)] to-[var(--brand-purple)] flex items-center justify-center text-3xl mb-4 shadow-lg">
                  ⚡
                </div>
                <h4 className="text-xl font-bold text-[var(--foreground)] mb-2">Run this workflow live</h4>
                <p className="text-sm text-[var(--neutral-gray-500)] max-w-md mx-auto mb-6">
                  Atlas will execute the full {LIFECYCLE_STEPS.length}-step claim lifecycle against the database — writing real
                  activities, statuses, evidence links and records so metrics and the timeline update as you watch.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-lg mx-auto">
                  {LIFECYCLE_STEPS.map((s, i) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[var(--background-alt)] border border-[var(--neutral-gray-200)] text-[var(--neutral-gray-500)]"
                    >
                      {s.icon} {i + 1}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setLivePhase('running')}
                  className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[var(--brand-purple)] to-[var(--brand-cyan)] hover:opacity-90 transition-all shadow-xl hover:shadow-2xl active:scale-[0.98]"
                >
                  ▶ Start — execute the workflow
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-5">
                {/* AI console */}
                <div className="md:col-span-3 border-b md:border-b-0 md:border-r border-[var(--neutral-gray-200)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--neutral-gray-400)] mb-3">
                    Atlas AI Console {liveRunning && <span className="text-[var(--brand-purple)] animate-pulse">— working</span>}
                  </p>
                  <div ref={consoleRef} className="h-64 overflow-y-auto space-y-2 pr-1">
                    {liveLog.map((line, i) => (
                      <div key={i} className="fade-up flex gap-2 text-xs leading-relaxed">
                        <span className={`shrink-0 ${LOG_STYLE[line.kind].cls}`}>{LOG_STYLE[line.kind].icon}</span>
                        <span className="text-[var(--neutral-gray-500)]">
                          {line.kind === 'thinking' ? (
                            <>
                              {line.text} <span className="typing-caret text-[var(--brand-purple)]">▍</span>
                            </>
                          ) : (
                            line.text
                          )}
                        </span>
                      </div>
                    ))}
                    {liveLog.length === 0 && (
                      <p className="text-xs text-[var(--neutral-gray-400)] animate-pulse">Initializing Atlas runtime…</p>
                    )}
                  </div>
                </div>

                {/* Step rail + metrics */}
                <div className="md:col-span-2 p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--neutral-gray-400)] mb-2">
                      Lifecycle {Math.min(liveIdx + 1, LIFECYCLE_STEPS.length)} of {LIFECYCLE_STEPS.length}
                    </p>
                    {liveIdx >= 0 && (
                      <div className="fade-up bg-[var(--background-alt)] rounded-xl border border-[var(--brand-purple)]/30 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-3xl">{LIFECYCLE_STEPS[liveIdx].icon}</span>
                          <div>
                            <p className="font-bold text-[var(--foreground)]">{LIFECYCLE_STEPS[liveIdx].label}</p>
                            <p className="text-[11px] text-[var(--neutral-gray-500)]">
                              {liveRunning ? 'Executing against live data' : 'Step complete'}
                            </p>
                          </div>
                        </div>
                        {liveDesc && <p className="text-xs text-[var(--neutral-gray-500)]">{liveDesc}</p>}
                      </div>
                    )}
                  </div>

                  {/* Live metrics */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--neutral-gray-400)] mb-2">Live metrics</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Revenue requested', value: fmtMoney(liveMetrics?.totalRevenueRequested), accent: 'text-[var(--foreground)]' },
                        { label: 'Revenue approved', value: fmtMoney(liveMetrics?.totalRevenueApproved), accent: 'text-[var(--color-success)]' },
                        { label: 'Approval rate', value: liveMetrics?.approvalRate != null ? `${liveMetrics.approvalRate}%` : '—', accent: 'text-[var(--brand-cyan)]' },
                        { label: 'Activities', value: String(liveMetrics?.activities ?? '—'), accent: 'text-[var(--brand-purple)]' },
                      ].map((m) => (
                        <div key={m.label} className="metric-flash bg-[var(--background-alt)] rounded-lg border border-[var(--neutral-gray-200)] p-3">
                          <p className="text-[10px] text-[var(--neutral-gray-400)]">{m.label}</p>
                          <p className={`text-base font-bold font-mono ${m.accent}`}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {liveClaim && (
                    <div className="flex items-center justify-between bg-[var(--background-alt)] rounded-lg border border-[var(--neutral-gray-200)] p-3">
                      <div>
                        <p className="text-[10px] text-[var(--neutral-gray-400)]">Claim status</p>
                        <p className="text-sm font-semibold text-[var(--foreground)] font-mono">
                          {liveClaim.claimNumber} · {liveClaim.status}
                        </p>
                      </div>
                      <button
                        onClick={openClaim}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--brand-cyan)] hover:bg-[var(--brand-cyan-light)] text-white transition-colors"
                      >
                        Open →
                      </button>
                    </div>
                  )}
                </div>

                {/* Live completion */}
                {liveDone && (
                  <div className="md:col-span-5 p-8 text-center border-t border-[var(--neutral-gray-200)]">
                    <div className="w-20 h-20 mx-auto rounded-full bg-[var(--color-success)]/15 border-2 border-[var(--color-success)] flex items-center justify-center mb-4">
                      <span className="text-4xl">🏆</span>
                    </div>
                    <h4 className="text-2xl font-bold text-[var(--foreground)] mb-2">Workflow complete</h4>
                    <p className="text-[var(--neutral-gray-500)] max-w-md mx-auto mb-6">
                      The <strong>{walkthrough.title}</strong> lifecycle ran end to end against the live database — {LIFECYCLE_STEPS.length} steps,
                      real records, updated metrics: <strong>{fmtMoney(liveMetrics?.totalRevenueApproved)}</strong> recovered at{' '}
                      <strong>{liveMetrics?.approvalRate ?? '—'}%</strong> approval.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        onClick={openClaim}
                        className="px-5 py-2.5 bg-[var(--brand-cyan)] hover:bg-[var(--brand-cyan-light)] text-[var(--brand-navy)] rounded-lg font-semibold transition-colors"
                      >
                        Open claim in Atlas
                      </button>
                      <button
                        onClick={goExport}
                        className="px-5 py-2.5 bg-[var(--brand-purple)] hover:bg-[var(--brand-purple-light)] text-white rounded-lg font-semibold transition-colors"
                      >
                        Export the final package
                      </button>
                      <button
                        onClick={onClose}
                        className="px-5 py-2.5 border border-[var(--neutral-gray-300)] text-[var(--foreground)] rounded-lg font-medium hover:bg-[var(--neutral-gray-100)] transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            /* ---------- NARRATIVE MODE ---------- */
            finished ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-[var(--color-success)]/15 flex items-center justify-center mb-4">
                  <span className="text-4xl">🎉</span>
                </div>
                <h4 className="text-2xl font-bold text-[var(--foreground)] mb-2">Walkthrough complete</h4>
                <p className="text-[var(--neutral-gray-500)] max-w-md mx-auto mb-6">
                  You just walked the full <strong>{walkthrough.title}</strong> journey. Every step is backed by live demo data —
                  explore the claim, decision record or supplement package directly, or re-run it live to see the lifecycle execute
                  against the database.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {step.target && (
                    <button
                      onClick={() => step.target && openTarget(step.target.path)}
                      className="px-5 py-2.5 bg-[var(--brand-cyan)] hover:bg-[var(--brand-cyan-light)] text-[var(--brand-navy)] rounded-lg font-semibold transition-colors"
                    >
                      Open in Atlas
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 border border-[var(--neutral-gray-300)] text-[var(--foreground)] rounded-lg font-medium hover:bg-[var(--neutral-gray-100)] transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : thinking ? (
              <div className="p-12 text-center">
                <div className="relative w-16 h-16 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-2 border-[var(--brand-cyan)]/30 overlay-pulse" />
                  <div className="absolute inset-1 rounded-full border-2 border-t-[var(--brand-cyan)] animate-spin" />
                </div>
                <p className="text-[var(--brand-cyan)] font-medium">Atlas is analyzing…</p>
                <p className="text-xs text-[var(--neutral-gray-400)] mt-1">Simulated intelligence pipeline</p>
              </div>
            ) : (
              <div className="p-8">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${walkthrough.color} flex items-center justify-center text-2xl shadow-md shrink-0`}>
                    {step.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[var(--neutral-gray-400)] font-medium uppercase tracking-wide mb-1">
                      Step {stepIndex + 1} of {steps.length}
                    </p>
                    <h4 className="text-xl font-bold text-[var(--foreground)] mb-2">{step.title}</h4>
                    <p className="text-[var(--neutral-gray-600)] leading-relaxed">{step.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-6">
                  {steps.map((s, i) => (
                    <span
                      key={i}
                      title={s.title}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i < stepIndex
                          ? 'w-3 bg-[var(--color-success)]'
                          : i === stepIndex
                            ? 'w-8 bg-[var(--brand-cyan)]'
                            : 'w-3 bg-[var(--neutral-gray-200)]'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--neutral-gray-200)]">
                  <div className="flex gap-2">
                    {stepIndex > 0 && (
                      <button
                        onClick={goBack}
                        className="px-4 py-2 text-sm border border-[var(--neutral-gray-300)] rounded-lg text-[var(--neutral-gray-600)] hover:bg-[var(--neutral-gray-100)] transition-colors"
                      >
                        ← Back
                      </button>
                    )}
                    {step.target && (
                      <button
                        onClick={() => step.target && openTarget(step.target.path)}
                        className="px-4 py-2 text-sm border border-[var(--brand-cyan)] text-[var(--brand-cyan)] hover:bg-[var(--brand-cyan)]/10 rounded-lg font-medium transition-colors"
                      >
                        Open in Atlas ↗
                      </button>
                    )}
                  </div>
                  <button
                    onClick={goNext}
                    className="px-6 py-2.5 text-sm bg-[var(--brand-cyan)] hover:bg-[var(--brand-cyan-light)] text-[var(--brand-navy)] rounded-lg font-semibold transition-colors"
                  >
                    {isLast ? 'Finish' : 'Next step →'}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
