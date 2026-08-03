'use client';

// apps/web/src/components/demo/FlagshipCard.tsx
// Hero showcase card for the flagship Carter Residence claim: initial
// estimate vs Atlas supplement vs revenue recovered, with animated count-up
// numbers and a 417% approval-increase badge.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface FlagshipInfo {
  claimId?: string | null;
  claimNumber: string;
  customerName: string;
  address: string;
  city: string;
  state: string;
  status?: string;
  estimate: number;
  supplementRequested: number;
  supplementApproved: number;
  approvalIncreasePct: number;
}

interface Props {
  flagship: FlagshipInfo | null;
  loading: boolean;
}

const fmt = (v: number) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function useCountUp(target: number, run: boolean, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!run) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, run, duration]);

  return value;
}

function Stat({
  label,
  value,
  prefix = '$',
  suffix = '',
  accent,
  run,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  accent: string;
  run: boolean;
}) {
  const animated = useCountUp(value, run);
  const isPct = suffix === '%';
  const display = isPct
    ? `${Math.round(animated)}%`
    : `${prefix}${animated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="bg-[var(--background-alt)] rounded-xl p-4 border border-[var(--neutral-gray-200)]">
      <p className="text-xs text-[var(--neutral-gray-500)] font-medium mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent}`}>{display}</p>
    </div>
  );
}

export default function FlagshipCard({ flagship, loading }: Props) {
  const router = useRouter();
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (flagship) {
      const t = window.setTimeout(() => setRun(true), 150);
      return () => window.clearTimeout(t);
    }
  }, [flagship]);

  if (loading) {
    return (
      <div className="bg-[var(--surface)] rounded-2xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[var(--neutral-gray-200)] rounded w-1/3" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-[var(--neutral-gray-200)] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!flagship) {
    return (
      <div className="bg-gradient-to-br from-[var(--brand-navy)] to-[var(--brand-purple)] rounded-2xl shadow-xl p-8 text-center">
        <p className="text-lg text-white/90 font-medium">
          🏠 Generate demo data to unlock the flagship <strong>Carter Residence</strong> story —
          a 417% recovery on a wind &amp; hail claim.
        </p>
      </div>
    );
  }

  const pct = flagship.estimate > 0
    ? Math.min((flagship.supplementApproved / flagship.estimate) * 100, 100)
    : 0;

  return (
    <div className="bg-gradient-to-br from-[var(--brand-navy)] via-[var(--brand-navy)] to-[var(--brand-purple)] rounded-2xl shadow-xl overflow-hidden relative">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-[var(--brand-cyan)] blur-3xl" />
      </div>
      <div className="relative p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-white/15 text-white text-xs font-medium">Flagship Demo Claim</span>
              <span className="px-2 py-0.5 rounded-full bg-[var(--color-success)]/25 text-[var(--color-success)] text-xs font-medium">
                {flagship.status === 'paid' ? 'Paid & Closed' : 'Active'}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white">{flagship.customerName}</h2>
            <p className="text-white/70 text-sm mt-1">
              {flagship.address}, {flagship.city}, {flagship.state} · {flagship.claimNumber} · Wind &amp; Hail
            </p>
          </div>
          <button
            onClick={() => flagship.claimId && router.push(`/admin/claims/${flagship.claimId}`)}
            className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg font-medium transition-colors"
          >
            Open claim →
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Carrier Initial Estimate" value={flagship.estimate} accent="text-white" run={run} />
          <Stat label="Atlas Supplement" value={flagship.supplementRequested} accent="text-[var(--brand-cyan)]" run={run} />
          <Stat label="Revenue Recovered" value={flagship.supplementApproved} accent="text-[var(--color-success)]" run={run} />
          <Stat label="Approval Increase" value={flagship.approvalIncreasePct} suffix="%" accent="text-[var(--color-warning)]" run={run} />
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-xs text-white/60 mb-1">
            <span>Estimate → Recovered</span>
            <span>+{flagship.approvalIncreasePct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--color-success)] transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
