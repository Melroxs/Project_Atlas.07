'use client';

// apps/web/src/components/demo/TimelinePlayback.tsx
// Animated claim history — events pop onto a vertical timeline one at a time,
// with a progress line filling between them. Falls back to the canonical
// Carter Residence story, or renders live events passed by the caller.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemoToast } from './DemoToast';

export interface TimelineEvent {
  label: string;
  description: string;
  icon?: string;
}

const CANONICAL: TimelineEvent[] = [
  { label: 'Lead Created', description: 'Carter Residence entered from the storm-damage report', icon: '📥' },
  { label: 'Inspection Scheduled', description: 'Estimator assigned with a 22-photo checklist', icon: '📅' },
  { label: 'Inspection Complete', description: 'Roof inspected — 26 squares, 3 planes', icon: '🔍' },
  { label: 'Interview Finished', description: 'FNOL interview — 6 facts extracted', icon: '💬' },
  { label: 'Photos Uploaded', description: '22 inspection photos + drone imagery', icon: '📷' },
  { label: 'Weather Verified', description: 'NOAA — 61 mph gusts on loss date', icon: '⛈️' },
  { label: 'AI Analysis Complete', description: 'Hail impacts, granule loss, flashing damage', icon: '🤖' },
  { label: 'Decision Generated', description: 'Confidence 88.5 · Risk 22 · Final 90/100', icon: '🧠' },
  { label: 'Supplement Submitted', description: '$22,835.65 requested to Universal Property & Casualty', icon: '💰' },
  { label: 'Carrier Approved', description: '$18,421.15 approved — 81% of requested', icon: '🏛️' },
  { label: 'Invoice Issued', description: 'ATL-8821 issued and paid via ACH', icon: '🧾' },
  { label: 'Claim Closed', description: '+417% over the initial $4,414.50 estimate', icon: '🏁' },
];

export default function TimelinePlayback({
  events,
  claimId,
  onComplete,
}: {
  events?: TimelineEvent[];
  claimId?: string | null;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const toast = useDemoToast();
  const list = events && events.length > 0 ? events : CANONICAL;
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle');
  const [shown, setShown] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => {
    timers.current.forEach((t) => window.clearTimeout(t));
  }, []);

  const play = () => {
    setPhase('playing');
    setShown(0);
    for (let i = 0; i < list.length; i++) {
      timers.current.push(window.setTimeout(() => setShown((s) => s + 1), 620 * (i + 1)));
    }
    timers.current.push(
      window.setTimeout(() => {
        setPhase('done');
        toast.success(`Timeline complete — ${list.length} events in the claim story`);
        onComplete?.();
      }, 620 * list.length + 500),
    );
  };

  const openClaim = () => {
    if (claimId) {
      router.push(`/admin/claims/${claimId}`);
    } else {
      toast.info('Open the claim from the Flagship card above');
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="text-xl">🕐</span> Timeline Playback
          </h3>
          <p className="text-xs text-[var(--neutral-gray-500)] mt-1">
            The full claim story — {list.length} events, animated in order
          </p>
        </div>
        {phase !== 'idle' && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--brand-cyan)]/15 text-[var(--brand-cyan)]">
            {shown}/{list.length}
          </span>
        )}
      </div>

      {phase === 'idle' && (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--neutral-gray-500)] mb-5">
            Replay how Atlas moved the Carter Residence claim from first contact to a paid, closed recovery.
          </p>
          <button
            onClick={play}
            className="px-6 py-3 bg-[var(--brand-cyan)] hover:bg-[var(--brand-cyan-light)] text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            ▶ Play Timeline
          </button>
        </div>
      )}

      {phase !== 'idle' && (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-[var(--neutral-gray-200)] rounded-full overflow-hidden">
            <div
              className="w-full bg-gradient-to-b from-[var(--brand-cyan)] to-[var(--brand-purple)] transition-all duration-500"
              style={{ height: `${(shown / list.length) * 100}%` }}
            />
          </div>
          <div className="space-y-3">
            {list.slice(0, shown).map((e, i) => (
              <div key={i} className="fade-up relative flex gap-3">
                <span
                  className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 ${
                    i === shown - 1 && phase === 'playing'
                      ? 'bg-[var(--brand-cyan)] border-[var(--surface)] ring-2 ring-[var(--brand-cyan)]/40'
                      : 'bg-[var(--brand-purple)] border-[var(--surface)]'
                  }`}
                />
                <div className="flex-1 bg-[var(--background-alt)] rounded-lg border border-[var(--neutral-gray-200)] p-3">
                  <p className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                    <span>{e.icon ?? '•'}</span> {e.label}
                  </p>
                  <p className="text-xs text-[var(--neutral-gray-500)] mt-0.5">{e.description}</p>
                </div>
              </div>
            ))}
          </div>

          {phase === 'done' && (
            <div className="fade-up mt-4 flex flex-wrap gap-2">
              <button
                onClick={play}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--background-alt)] border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] transition-colors"
              >
                ↻ Replay
              </button>
              <button
                onClick={openClaim}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--brand-purple)] hover:bg-[var(--brand-purple-light)] text-white transition-all shadow-md"
              >
                Open claim in Atlas →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Deep links into the populated records */}
      <div className="mt-4 pt-3 border-t border-[var(--neutral-gray-200)]">
        <p className="text-[10px] uppercase tracking-wide text-[var(--neutral-gray-400)] mb-2">Open the related records</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Claims', path: '/admin/claims' },
            { label: 'Decision record', path: '/admin/decisions' },
            { label: 'Documents', path: '/admin/documents' },
            { label: 'Supplements', path: '/admin/supplements' },
            { label: 'Interviews', path: '/admin/interviews' },
            { label: 'Activity log', path: '/admin/activity' },
          ].map((l) => (
            <button
              key={l.path}
              onClick={() => router.push(l.path)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--neutral-gray-300)] text-[var(--neutral-gray-500)] hover:border-[var(--brand-cyan)] hover:text-[var(--brand-cyan)] transition-colors"
            >
              {l.label} →
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
