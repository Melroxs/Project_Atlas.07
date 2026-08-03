'use client';

// apps/web/src/components/demo/FullDemoPlayer.tsx
// The "Start Full Atlas Demo" experience. Atlas runs the entire Carter
// Residence claim lifecycle automatically — each step is executed against the
// live database through POST /api/demo/run-step, so metrics, activities and
// claim status update in real time. The player shows live AI reasoning in a
// console, animates a progress rail, and supports Pause / Resume / Skip /
// Previous / Restart / Exit.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useDemoToast } from './DemoToast';
import {
  LIFECYCLE_STEPS,
  fmtMoney,
  type LifecycleMetrics as Metrics,
  type LifecycleClaimSnap as ClaimSnap,
} from '@/lib/demo-lifecycle';

const STEPS = LIFECYCLE_STEPS;

interface LogLine {
  kind: 'thinking' | 'action' | 'done' | 'error' | 'info';
  text: string;
}

const fmt = fmtMoney;

const LOG_STYLE: Record<LogLine['kind'], { icon: string; cls: string }> = {
  thinking: { icon: '⏳', cls: 'text-[var(--brand-purple)]' },
  action: { icon: '⚙️', cls: 'text-[var(--brand-cyan)]' },
  done: { icon: '✓', cls: 'text-[var(--color-success)]' },
  error: { icon: '⚠️', cls: 'text-[var(--color-error)]' },
  info: { icon: 'ℹ️', cls: 'text-[var(--neutral-gray-400)]' },
};

export default function FullDemoPlayer({
  open,
  onClose,
  hasData,
  onDemoChanged,
}: {
  open: boolean;
  onClose: () => void;
  hasData: boolean;
  onDemoChanged?: () => void;
}) {
  const router = useRouter();
  const toast = useDemoToast();
  const [status, setStatus] = useState<'idle' | 'preparing' | 'running' | 'done'>('idle');
  const [runId, setRunId] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [phase, setPhase] = useState<'thinking' | 'acting'>('thinking');
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [log, setLog] = useState<LogLine[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [claim, setClaim] = useState<ClaimSnap | null>(null);
  const [stepDesc, setStepDesc] = useState('');
  const [generating, setGenerating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const runToken = useRef(0);
  const startIdx = useRef(0);
  const pausedRef = useRef(false);
  const skipRef = useRef(false);
  const cancelledRef = useRef(false);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Sync fullscreen state (presentation mode).
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Close on Escape — leaves presentation mode first if active.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.fullscreenElement) void document.exitFullscreen();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Auto-scroll the AI console.
  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight, behavior: 'smooth' });
  }, [log]);

  // The main engine — one run per runToken. Re-runs when the user
  // restarts / steps back / skips via a new runId.
  useEffect(() => {
    if (!open || status === 'idle' || status === 'preparing') return;
    const token = ++runToken.current;
    cancelledRef.current = false;
    let disposed = false;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t0 = Date.now();
        const tick = () => {
          if (cancelledRef.current || token !== runToken.current || disposed) return resolve();
          if (skipRef.current) {
            skipRef.current = false;
            return resolve();
          }
          if (pausedRef.current) {
            window.setTimeout(tick, 120);
            return;
          }
          const remaining = ms - (Date.now() - t0);
          if (remaining <= 0) return resolve();
          window.setTimeout(tick, Math.min(120, remaining));
        };
        tick();
      });

    const pushLog = (line: LogLine) => {
      if (token !== runToken.current || disposed) return;
      setLog((prev) => [...prev.slice(-60), line]);
    };

    (async () => {
      setStatus('running');
      setLog([]);
      setMetrics(null);
      setClaim(null);
      setStepDesc('');
      setCurrentIdx(-1);
      setPhase('thinking');

      const startAt = Math.max(0, startIdx.current);
      for (let i = startAt; i < STEPS.length && token === runToken.current && !disposed; i++) {
        const step = STEPS[i];
        setCurrentIdx(i);
        setStepDesc('');
        setPhase('thinking');
        pushLog({ kind: 'thinking', text: step.ai });

        const thinkingMs = step.id === 'photo_ai' || step.id === 'decision' || step.id === 'evidence' ? 9000 : 6500;
        await wait(thinkingMs / speed);
        if (token !== runToken.current || disposed) return;

        setPhase('acting');
        pushLog({ kind: 'action', text: `Executing: ${step.label}` });

        try {
          const res = (await apiFetch('/demo/run-step', {
            method: 'POST',
            body: JSON.stringify({ stepId: step.id }),
          })) as {
            timeline?: Array<{ description: string }>;
            metrics?: Metrics;
            claim?: ClaimSnap | null;
            complete?: boolean;
          };
          if (res.timeline?.[0]?.description) {
            setStepDesc(res.timeline[0].description);
            pushLog({ kind: 'done', text: res.timeline[0].description });
          }
          if (res.metrics) setMetrics(res.metrics);
          if (res.claim) setClaim(res.claim);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes('not found') || message.includes('404')) {
            pushLog({ kind: 'error', text: 'Flagship claim missing — generate demo data first' });
            toast.error('Flagship claim not found — please generate demo data');
            setStatus('idle');
            return;
          }
          pushLog({ kind: 'error', text: 'Step failed — continuing with the next step' });
        }

        await wait(4200 / speed);
        if (token !== runToken.current || disposed) return;
      }

      setPhase('thinking');
      setCurrentIdx(STEPS.length - 1);
      setStatus('done');
      pushLog({ kind: 'info', text: 'Claim lifecycle complete — finalizing report…' });
      toast.success('Full Atlas Demo complete — claim CL-2026-0614 closed, +417% recovery');
      onDemoChanged?.();
    })();

    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runId]);

  const launch = () => {
    skipRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    setStatus('running');
    setRunId((r) => r + 1);
  };

  const start = async () => {
    if (!hasData) {
      setGenerating(true);
      try {
        await apiFetch('/demo/generate', { method: 'POST' });
        toast.success('Demo data generated — starting the full demo');
        onDemoChanged?.();
      } catch (err) {
        console.error('Generate for demo error:', err);
        toast.error('Could not generate demo data — please try again');
        setGenerating(false);
        return;
      } finally {
        setGenerating(false);
      }
    }
    startIdx.current = 0;
    launch();
  };

  const pauseToggle = () => {
    setPaused((p) => {
      const next = !p;
      pausedRef.current = next;
      return next;
    });
  };

  const skip = () => {
    skipRef.current = true;
  };

  const goTo = (idx: number) => {
    startIdx.current = Math.max(0, Math.min(idx, STEPS.length - 1));
    launch();
  };

  const restart = () => goTo(0);
  const previous = () => goTo(currentIdx - 1);
  const next = () => goTo(currentIdx + 1);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  const openClaim = () => {
    if (claim?.id) {
      router.push(`/admin/claims/${claim.id}`);
      onClose();
    } else {
      toast.info('Claim opens after it is created in the demo');
    }
  };

  if (!open) return null;

  const step = currentIdx >= 0 ? STEPS[Math.min(currentIdx, STEPS.length - 1)] : null;
  const progress = ((currentIdx + 1) / STEPS.length) * 100;
  const running = status === 'running';
  const isDone = status === 'done';
  const thinking = running && phase === 'thinking';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--neutral-gray-200)] overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--neutral-gray-200)] bg-[var(--background-alt)]">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {running && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-60" />
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${running ? 'bg-[var(--color-success)]' : isDone ? 'bg-[var(--brand-purple)]' : 'bg-[var(--neutral-gray-400)]'}`} />
            </span>
            <div>
              <p className="font-semibold text-[var(--foreground)] text-sm">Full Atlas Demo — Carter Residence</p>
              <p className="text-[11px] text-[var(--neutral-gray-500)]">
                {isDone ? 'Complete — claim closed' : running ? (paused ? 'Paused' : 'Atlas is working') : 'Ready to run the claim lifecycle'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={currentIdx}
              onChange={(e) => goTo(Number(e.target.value))}
              disabled={!running && !isDone}
              title="Jump to any stage"
              className="px-2 py-1.5 rounded-lg text-xs font-semibold border border-[var(--neutral-gray-300)] text-[var(--foreground)] bg-[var(--background-alt)] disabled:opacity-40"
            >
              <option value={-1}>Jump to stage…</option>
              {STEPS.map((s, i) => (
                <option key={s.id} value={i}>
                  {i + 1}. {s.label}
                </option>
              ))}
            </select>
            <div className="flex rounded-lg border border-[var(--neutral-gray-300)] overflow-hidden text-xs">
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2.5 py-1.5 font-semibold transition-colors ${speed === s ? 'bg-[var(--brand-cyan)] text-white' : 'text-[var(--neutral-gray-500)] hover:text-[var(--foreground)]'}`}
                >
                  {s}×
                </button>
              ))}
            </div>
            {running && (
              <button
                onClick={pauseToggle}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--brand-purple)] hover:bg-[var(--brand-purple-light)] text-white transition-colors"
              >
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
            )}
            <button
              onClick={skip}
              disabled={!running}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] transition-colors disabled:opacity-40"
            >
              Skip
            </button>
            <button
              onClick={previous}
              disabled={!running || currentIdx <= 0}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] transition-colors disabled:opacity-40"
              title="Previous step"
            >
              ← Prev
            </button>
            <button
              onClick={restart}
              disabled={!running && !isDone}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] transition-colors disabled:opacity-40"
            >
              ↻ Restart
            </button>
            <button
              onClick={toggleFullscreen}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] transition-colors"
              title="Presentation mode — fullscreen"
            >
              {isFullscreen ? '⎋ Exit' : '⛶ Present'}
            </button>
            <button
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-error)]/40 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Start screen */}
          {status === 'idle' && (
            <div className="p-10 text-center space-y-5">
              <div className="mx-auto w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--brand-purple)] to-[var(--brand-cyan)] flex items-center justify-center text-4xl shadow-xl">
                🚀
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">Watch Atlas run the entire claim</h2>
                <p className="text-sm text-[var(--neutral-gray-500)] max-w-xl mx-auto mt-2">
                  {STEPS.length} lifecycle steps execute against the live database — photos analyzed, weather verified,
                  evidence linked, decisions scored, supplement priced, carrier approval won, invoice paid, claim closed.
                  You just watch.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                {STEPS.map((s, i) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[var(--background-alt)] border border-[var(--neutral-gray-200)] text-[var(--neutral-gray-500)]"
                    title={s.ai}
                  >
                    {s.icon} {i + 1}
                  </span>
                ))}
              </div>
              <button
                onClick={start}
                disabled={generating}
                className="px-8 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-[var(--brand-purple)] to-[var(--brand-cyan)] hover:opacity-90 transition-all shadow-xl hover:shadow-2xl active:scale-[0.98] disabled:opacity-60"
              >
                {generating ? 'Generating demo data…' : hasData ? '▶ Start Full Atlas Demo' : '▶ Generate data & Start Full Atlas Demo'}
              </button>
              <p className="text-[11px] text-[var(--neutral-gray-400)]">
                ≈ 5–8 minutes at 1× · Pause, Skip, Previous and Restart available any time · every step writes real data
              </p>
            </div>
          )}

          {/* Completion screen */}
          {isDone && (
            <div className="p-10 text-center space-y-5">
              <div className="mx-auto w-20 h-20 rounded-full bg-[var(--color-success)]/15 border-2 border-[var(--color-success)] flex items-center justify-center text-4xl">
                🏆
              </div>
              <h2 className="text-2xl font-bold text-[var(--foreground)]">Claim closed — recovery complete</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                <div className="bg-[var(--background-alt)] rounded-xl border border-[var(--neutral-gray-200)] p-4">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--neutral-gray-400)]">Requested</p>
                  <p className="text-lg font-bold font-mono text-[var(--foreground)]">{fmt(metrics?.totalRevenueRequested)}</p>
                </div>
                <div className="bg-[var(--background-alt)] rounded-xl border border-[var(--color-success)]/30 p-4">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--neutral-gray-400)]">Recovered</p>
                  <p className="text-lg font-bold font-mono text-[var(--color-success)]">{fmt(metrics?.totalRevenueApproved)}</p>
                </div>
                <div className="bg-[var(--background-alt)] rounded-xl border border-[var(--neutral-gray-200)] p-4">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--neutral-gray-400)]">Approval rate</p>
                  <p className="text-lg font-bold font-mono text-[var(--foreground)]">{metrics?.approvalRate ?? '—'}%</p>
                </div>
                <div className="bg-[var(--background-alt)] rounded-xl border border-[var(--neutral-gray-200)] p-4">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--neutral-gray-400)]">Increase</p>
                  <p className="text-lg font-bold font-mono text-[var(--brand-cyan)]">+417%</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={openClaim}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[var(--brand-purple)] hover:bg-[var(--brand-purple-light)] text-white transition-colors"
                >
                  Open claim in Atlas →
                </button>
                <button
                  onClick={restart}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] transition-colors"
                >
                  ↻ Replay
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] transition-colors"
                >
                  Export the final package below
                </button>
              </div>
            </div>
          )}

          {/* Running layout */}
          {running && (
            <div className="grid grid-cols-1 lg:grid-cols-5">
              {/* AI Console */}
              <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-[var(--neutral-gray-200)] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--neutral-gray-400)] mb-3">
                  Atlas AI Console {thinking && <span className="text-[var(--brand-purple)] animate-pulse">— thinking</span>}
                </p>
                <div ref={consoleRef} className="h-72 lg:h-80 overflow-y-auto space-y-2 pr-1">
                  {log.map((line, i) => (
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
                  {log.length === 0 && (
                    <p className="text-xs text-[var(--neutral-gray-400)] animate-pulse">Initializing Atlas runtime…</p>
                  )}
                </div>
              </div>

              {/* Step + metrics */}
              <div className="lg:col-span-2 p-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--neutral-gray-400)] mb-2">
                    Current step {Math.min(currentIdx + 1, STEPS.length)} of {STEPS.length}
                  </p>
                  {step && (
                    <div className="fade-up bg-[var(--background-alt)] rounded-xl border border-[var(--brand-purple)]/30 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{step.icon}</span>
                        <div>
                          <p className="font-bold text-[var(--foreground)]">{step.label}</p>
                          <p className="text-[11px] text-[var(--neutral-gray-500)]">{thinking ? step.ai : 'Step complete'}</p>
                        </div>
                      </div>
                      {stepDesc && <p className="text-xs text-[var(--neutral-gray-500)]">{stepDesc}</p>}
                    </div>
                  )}
                </div>

                {/* Live metrics */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--neutral-gray-400)] mb-2">Live metrics</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Revenue requested', value: fmt(metrics?.totalRevenueRequested), accent: 'text-[var(--foreground)]' },
                      { label: 'Revenue approved', value: fmt(metrics?.totalRevenueApproved), accent: 'text-[var(--color-success)]' },
                      { label: 'Approval rate', value: metrics?.approvalRate != null ? `${metrics.approvalRate}%` : '—', accent: 'text-[var(--brand-cyan)]' },
                      { label: 'Activities', value: String(metrics?.activities ?? '—'), accent: 'text-[var(--brand-purple)]' },
                    ].map((m) => (
                      <div key={m.label} className="metric-flash bg-[var(--background-alt)] rounded-lg border border-[var(--neutral-gray-200)] p-3">
                        <p className="text-[10px] text-[var(--neutral-gray-400)]">{m.label}</p>
                        <p className={`text-base font-bold font-mono ${m.accent}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Claim status */}
                {claim && (
                  <div className="flex items-center justify-between bg-[var(--background-alt)] rounded-lg border border-[var(--neutral-gray-200)] p-3">
                    <div>
                      <p className="text-[10px] text-[var(--neutral-gray-400)]">Claim status</p>
                      <p className="text-sm font-semibold text-[var(--foreground)] font-mono">{claim.claimNumber} · {claim.status}</p>
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
            </div>
          )}
        </div>

        {/* Progress rail */}
        <div className="px-5 py-3 border-t border-[var(--neutral-gray-200)] bg-[var(--background-alt)]">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-[var(--neutral-gray-200)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isDone ? 'bg-[var(--color-success)]' : 'bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-purple)]'
                }`}
                style={{ width: `${isDone ? 100 : progress}%` }}
              />
            </div>
            <span className="text-xs font-mono text-[var(--neutral-gray-500)] shrink-0">
              {isDone ? '100%' : `${Math.round(progress)}%`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
