'use client';

// apps/web/src/components/demo/GenerationOverlay.tsx
// Full-screen overlay with an animated stage sequence + progress bar shown
// while demo data is generating / resetting. Parent controls `active` and
// `label`; the overlay cycles through realistic pipeline stages on its own.

import { useEffect, useState } from 'react';

const STAGES = [
  'Creating company profile',
  'Adding customers & properties',
  'Seeding adjusters & carriers',
  'Building claims & FNOL interviews',
  'Uploading documents & photos',
  'Running photo intelligence',
  'Verifying weather data',
  'Measuring roof planes',
  'Checking code compliance',
  'Running Decision Engine',
  'Building evidence graph',
  'Assembling claim packages',
  'Finalizing metrics',
];

interface Props {
  active: boolean;
  label?: string;
}

export default function GenerationOverlay({ active, label = 'Generating demo data' }: Props) {
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setStageIndex(0);
      setProgress(0);
      return;
    }
    setProgress(0);
    const step = window.setInterval(() => {
      setStageIndex((i) => {
        const next = i + 1;
        if (next >= STAGES.length) {
          window.clearInterval(step);
          return i;
        }
        return next;
      });
      setProgress((p) => Math.min(p + Math.random() * 14 + 6, 92));
    }, 420);
    return () => window.clearInterval(step);
  }, [active]);

  if (!active) return null;

  const pct = Math.min(Math.round(progress), 99);
  const stage = STAGES[Math.min(stageIndex, STAGES.length - 1)];

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--atlas-void)]/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--neutral-gray-200)] rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-[var(--brand-cyan)]/30 overlay-pulse" />
            <div className="absolute inset-1 rounded-full border-2 border-t-[var(--brand-cyan)] animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">{label}…</h3>
            <p className="text-sm text-[var(--brand-cyan)] font-medium">{stage}</p>
          </div>
        </div>

        <div className="h-2 rounded-full bg-[var(--neutral-gray-200)] overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-purple)] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-[var(--neutral-gray-400)]">
          <span>Atlas pipeline</span>
          <span>{pct}%</span>
        </div>

        <div className="mt-6 space-y-2">
          {STAGES.slice(0, 5).map((s, i) => (
            <div key={s} className="flex items-center gap-2 text-sm">
              <span className={`w-4 text-center ${i < stageIndex ? 'text-[var(--color-success)]' : i === stageIndex ? 'text-[var(--brand-cyan)]' : 'text-[var(--neutral-gray-300)]'}`}>
                {i < stageIndex ? '✓' : i === stageIndex ? '◌' : '·'}
              </span>
              <span className={i === stageIndex ? 'text-[var(--foreground)] font-medium' : i < stageIndex ? 'text-[var(--neutral-gray-500)]' : 'text-[var(--neutral-gray-400)]'}>
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
