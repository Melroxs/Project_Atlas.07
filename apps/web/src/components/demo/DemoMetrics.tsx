'use client';

// apps/web/src/components/demo/DemoMetrics.tsx
// Metrics are calculated server-side from live demo rows (see
// calculateMetrics in lib/demo-seed.ts) — nothing is hardcoded here. Values
// count up on load and flash when demo data changes.

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { subscribeDemoChanged } from '@/lib/demo-events';

interface DemoMetricsData {
  companies: number;
  customers: number;
  properties: number;
  documents: number;
  interviews: number;
  adjusters: number;
  activities: number;
  tasks: number;
  decisions: number;
  totalClaims: number;
  activeClaims: number;
  pendingSupplements: number;
  approvedSupplements: number;
  totalRevenueRequested: number;
  totalRevenueApproved: number;
  approvalRate: number;
  approvalRateByValue: number;
  aiAcceptanceRate: number;
  activeUsers: number;
}

function useCountUp(target: number, run: boolean, duration = 700) {
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

function MetricCard({
  icon,
  label,
  value,
  display,
  flash,
}: {
  icon: string;
  label: string;
  value: number;
  display: string;
  flash: boolean;
}) {
  const animated = useCountUp(value, true);
  const shown =
    display.includes('$') || display.endsWith('%') || display.endsWith('+')
      ? display
      : String(Math.round(animated));
  return (
    <div
      className={`bg-[var(--background-alt)] rounded-lg p-4 border border-[var(--neutral-gray-200)] hover:border-[var(--brand-cyan)] transition-colors ${flash ? 'count-up-flash' : ''}`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-xs text-[var(--neutral-gray-500)] font-medium">{label}</p>
      <p className="text-lg font-bold text-[var(--foreground)]">{shown}</p>
    </div>
  );
}

const money = (v: number) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function DemoMetrics() {
  const [metrics, setMetrics] = useState<DemoMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [flash, setFlash] = useState(false);
  const prevRef = useRef<string>('');

  const fetchMetrics = async (initial = false) => {
    try {
      const response = (await apiFetch('/demo/metrics')) as DemoMetricsData;
      const sig = JSON.stringify(response);
      if (!initial && prevRef.current && sig !== prevRef.current) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 1000);
      }
      prevRef.current = sig;
      setMetrics(response);
      setError(false);
    } catch (err) {
      console.error('Error fetching demo metrics:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics(true);
    const unsubscribe = subscribeDemoChanged(() => fetchMetrics());
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-[var(--neutral-gray-200)] rounded w-1/4" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-20 bg-[var(--neutral-gray-200)] rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6 text-center">
        <p className="text-[var(--neutral-gray-500)] mb-4">Demo metrics are temporarily unavailable.</p>
        <button
          onClick={() => {
            setLoading(true);
            fetchMetrics();
          }}
          className="px-4 py-2 bg-[var(--brand-cyan)] hover:bg-[var(--brand-cyan-light)] text-[var(--brand-navy)] rounded-lg font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const cards: Array<{ icon: string; label: string; display: string }> = [
    { icon: '🏢', label: 'Companies', display: String(metrics.companies) },
    { icon: '👥', label: 'Customers', display: String(metrics.customers) },
    { icon: '🏠', label: 'Properties', display: String(metrics.properties) },
    { icon: '📋', label: 'Claims', display: String(metrics.totalClaims) },
    { icon: '💰', label: 'Supplements', display: String(metrics.approvedSupplements + metrics.pendingSupplements) },
    { icon: '📁', label: 'Documents', display: String(metrics.documents) },
    { icon: '💬', label: 'Interviews', display: String(metrics.interviews) },
    { icon: '👷', label: 'Adjusters', display: String(metrics.adjusters) },
    { icon: '📈', label: 'Activities', display: String(metrics.activities) },
    { icon: '💵', label: 'Revenue Requested', display: money(metrics.totalRevenueRequested) },
    { icon: '✅', label: 'Revenue Approved', display: money(metrics.totalRevenueApproved) },
    { icon: '📊', label: 'Approval Rate', display: `${metrics.approvalRate}%` },
    { icon: '📝', label: 'Tasks', display: String(metrics.tasks) },
    { icon: '🧠', label: 'AI Decisions', display: String(metrics.decisions) },
    { icon: '🤖', label: 'AI Acceptance', display: `${metrics.aiAcceptanceRate}%` },
  ];

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Demo Metrics</h2>
        <span className="text-xs text-[var(--neutral-gray-400)]">Calculated live from demo data</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {cards.map((card, index) => (
          <MetricCard
            key={index}
            icon={card.icon}
            label={card.label}
            value={parseFloat(card.display.replace(/[^0-9.]/g, '')) || 0}
            display={card.display}
            flash={flash}
          />
        ))}
      </div>
    </div>
  );
}
