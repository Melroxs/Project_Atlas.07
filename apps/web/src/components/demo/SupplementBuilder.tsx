'use client';

// apps/web/src/components/demo/SupplementBuilder.tsx
// Atlas builds the Carter Residence supplement live: Xactimate line items
// appear one by one with pricing, code-required tags and a running total vs
// the carrier estimate, ending with an approval prediction. Persists the
// supplement through the live demo runner when possible.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useDemoToast } from './DemoToast';

interface LineItem {
  code: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
  tag: 'Code-required' | 'Photo-backed';
}

const LINE_ITEMS: LineItem[] = [
  { code: 'RD-1', description: 'Roof deck replacement', qty: 7, unit: 'sheets', unitPrice: 121.05, total: 847.35, tag: 'Photo-backed' },
  { code: 'RD-2', description: 'Tear-off & disposal', qty: 26, unit: 'sq', unitPrice: 182.5, total: 4745.0, tag: 'Code-required' },
  { code: 'RD-3', description: 'Roof system replacement — architectural shingles', qty: 26, unit: 'sq', unitPrice: 452.5, total: 11765.0, tag: 'Photo-backed' },
  { code: 'RT-1', description: '2023 FBC underlayment upgrade', qty: 26, unit: 'sq', unitPrice: 42.3, total: 1099.8, tag: 'Code-required' },
  { code: 'ST-1', description: 'Ridge vent & hip cap', qty: 120, unit: 'lf', unitPrice: 8.4, total: 1008.0, tag: 'Code-required' },
  { code: 'FT-1', description: 'Flashing — chimney & valleys', qty: 3, unit: 'each', unitPrice: 190.0, total: 570.0, tag: 'Photo-backed' },
  { code: 'GT-1', description: 'Gutters & downspouts', qty: 128, unit: 'lf', unitPrice: 13.6, total: 1740.8, tag: 'Photo-backed' },
  { code: 'SF-1', description: 'Soffit & fascia', qty: 94, unit: 'lf', unitPrice: 7.55, total: 709.7, tag: 'Photo-backed' },
  { code: 'PM-1', description: 'Permit & final inspection', qty: 1, unit: 'each', unitPrice: 350.0, total: 350.0, tag: 'Code-required' },
];

const CARRIER_ESTIMATE = 4414.5;
const SUPPLEMENT_TOTAL = LINE_ITEMS.reduce((s, li) => s + li.total, 0);

const TAG_STYLE: Record<LineItem['tag'], string> = {
  'Code-required': 'bg-[var(--color-warning)]/15 text-[var(--color-warning)] border-[var(--color-warning)]/30',
  'Photo-backed': 'bg-[var(--brand-cyan)]/15 text-[var(--brand-cyan)] border-[var(--brand-cyan)]/30',
};

const fmt = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SupplementBuilder({ onComplete }: { onComplete?: () => void }) {
  const router = useRouter();
  const toast = useDemoToast();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [visible, setVisible] = useState(0);
  const [saving, setSaving] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => {
    timers.current.forEach((t) => window.clearTimeout(t));
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const generate = async () => {
    setPhase('running');
    setVisible(0);
    // Persist the supplement through the live runner (best-effort).
    setSaving(true);
    try {
      await apiFetch('/demo/run-step', { method: 'POST', body: JSON.stringify({ stepId: 'supplement' }) });
    } catch {
      // Continue with the demo numbers — the animation is the point.
    } finally {
      setSaving(false);
    }
    // Reveal line items progressively with pricing animation.
    for (let i = 0; i < LINE_ITEMS.length; i++) {
      later(() => setVisible((v) => v + 1), 750 * (i + 1));
    }
    later(() => {
      setPhase('done');
      toast.success(`Supplement generated — ${fmt(SUPPLEMENT_TOTAL)} requested, 9 line items`);
      onComplete?.();
    }, 750 * LINE_ITEMS.length + 900);
  };

  const runningTotal = LINE_ITEMS.slice(0, visible).reduce((s, li) => s + li.total, 0);

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="text-xl">💰</span> Supplement Builder
          </h3>
          <p className="text-xs text-[var(--neutral-gray-500)] mt-1">
            Xactimate pricing — code-required & photo-backed line items, built live
          </p>
        </div>
        {phase === 'done' && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-success)]/15 text-[var(--color-success)]">
            {fmt(SUPPLEMENT_TOTAL)} requested
          </span>
        )}
      </div>

      {phase === 'idle' && (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--neutral-gray-500)] mb-5">
            Watch Atlas price the roof system replacement — from carrier estimate of {fmt(CARRIER_ESTIMATE)} to a full
            {fmt(SUPPLEMENT_TOTAL)} supplement.
          </p>
          <button
            onClick={generate}
            disabled={saving}
            className="px-6 py-3 bg-[var(--color-success)] hover:bg-green-600 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? 'Persisting…' : '⚡ Generate Supplement Live'}
          </button>
        </div>
      )}

      {phase !== 'idle' && (
        <div className="space-y-3">
          {/* Line items */}
          <div className="space-y-2">
            {LINE_ITEMS.slice(0, visible).map((li, i) => (
              <div
                key={li.code}
                className="fade-up flex flex-wrap items-center justify-between gap-2 bg-[var(--background-alt)] rounded-lg border border-[var(--neutral-gray-200)] p-3"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-xs font-bold text-[var(--brand-cyan)] shrink-0">{li.code}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{li.description}</p>
                    <p className="text-[11px] text-[var(--neutral-gray-400)] font-mono">
                      {li.qty} {li.unit} × {fmt(li.unitPrice)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TAG_STYLE[li.tag]}`}>{li.tag}</span>
                  <span className="text-sm font-bold text-[var(--foreground)] font-mono">{fmt(li.total)}</span>
                </div>
              </div>
            ))}
            {visible === 0 && phase === 'running' && (
              <div className="flex items-center gap-2 text-sm text-[var(--neutral-gray-500)] py-4">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-[var(--brand-cyan)] border-t-transparent rounded-full" />
                Reading carrier estimate and building scope…
              </div>
            )}
          </div>

          {/* Running total vs carrier */}
          <div className="bg-[var(--background-alt)] rounded-lg border border-[var(--brand-cyan)]/25 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--neutral-gray-500)]">Running total</span>
              <span className="text-lg font-bold font-mono text-[var(--foreground)]">{fmt(runningTotal)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-[var(--neutral-gray-200)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-purple)] rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (runningTotal / SUPPLEMENT_TOTAL) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-[var(--neutral-gray-400)] font-mono shrink-0">vs carrier {fmt(CARRIER_ESTIMATE)}</span>
            </div>
          </div>

          {phase === 'done' && (
            <div className="fade-up space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--background-alt)] rounded-lg border border-[var(--neutral-gray-200)] p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--neutral-gray-400)]">Requested</p>
                  <p className="text-lg font-bold font-mono text-[var(--foreground)]">{fmt(SUPPLEMENT_TOTAL)}</p>
                </div>
                <div className="bg-[var(--background-alt)] rounded-lg border border-[var(--color-success)]/30 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--neutral-gray-400)]">Approval prediction</p>
                  <p className="text-lg font-bold font-mono text-[var(--color-success)]">84% · conf 0.91</p>
                </div>
              </div>
              <p className="text-xs text-[var(--neutral-gray-500)]">
                <span className="text-[var(--color-warning)]">Carrier estimate missed 6 items</span> — full roof system, underlayment
                upgrade, ridge vent, flashing, gutters and soffit. Atlas priced them with code references and photo evidence.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => router.push('/admin/supplements')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--brand-cyan)] hover:bg-[var(--brand-cyan-light)] text-white transition-colors shadow-md"
                >
                  Open supplements in Atlas →
                </button>
                <button
                  onClick={() => router.push('/admin/decisions')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] transition-colors"
                >
                  Open decision record
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
