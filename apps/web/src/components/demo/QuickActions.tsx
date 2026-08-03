'use client';

// apps/web/src/components/demo/QuickActions.tsx
// Every action is live: generate / reset / clear demo data, toggle demo mode
// and deep links into populated admin screens. Generation shows the animated
// pipeline overlay, and every result reports via toast + refreshes the page.
//
// hasData / enabled are passed from the page (which owns the single
// /demo/status fetch) to avoid a duplicate request on page load.

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { notifyDemoChanged } from '@/lib/demo-events';
import { useDemoToast } from './DemoToast';
import GenerationOverlay from './GenerationOverlay';

interface Action {
  label: string;
  icon: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
  requireData?: boolean;
}

export default function QuickActions({ hasData, enabled }: { hasData: boolean; enabled: boolean }) {
  const router = useRouter();
  const toast = useDemoToast();
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState<{ active: boolean; label: string }>({ active: false, label: '' });

  const generateDemoData = async (reset = false) => {
    setBusy(true);
    setOverlay({ active: true, label: reset ? 'Resetting demo data' : 'Generating demo data' });
    try {
      const res = await apiFetch<{ success: boolean; data?: { summary?: Record<string, number> } }>(
        reset ? '/demo/reset' : '/demo/generate',
        { method: 'POST' },
      );
      const claims = res.data?.summary?.claims ?? 0;
      notifyDemoChanged();
      toast.success(
        reset
          ? `Demo data reset — ${claims} claims, all workflows restored`
          : `Demo data generated — ${claims} claims with the Carter Residence flagship story`,
      );
    } catch (err) {
      console.error('Demo generate error:', err);
      toast.error('Could not generate demo data — please try again');
    } finally {
      setBusy(false);
      setOverlay({ active: false, label: '' });
    }
  };

  const clearDemoData = async () => {
    if (!window.confirm('Clear all demo data? This removes generated claims, documents and records.')) {
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/demo/clear', { method: 'DELETE' });
      notifyDemoChanged();
      toast.success('Demo data cleared — ready for a fresh generation');
    } catch (err) {
      console.error('Demo clear error:', err);
      toast.error('Could not clear demo data');
    } finally {
      setBusy(false);
    }
  };

  const toggleDemoMode = async () => {
    const next = !enabled;
    setBusy(true);
    try {
      await apiFetch('/demo/toggle-mode', { method: 'POST', body: JSON.stringify({ enabled: next }) });
      notifyDemoChanged();
      toast.info(next ? 'Demo mode enabled' : 'Demo mode turned off');
    } catch (err) {
      console.error('Demo toggle error:', err);
      toast.error('Could not toggle demo mode');
    } finally {
      setBusy(false);
    }
  };

  const nav = (path: string) => router.push(path);

  const actions: Action[] = [
    { label: 'Generate Demo Data', icon: '🎲', color: 'bg-[var(--brand-cyan)] hover:bg-[var(--brand-cyan-light)] text-[var(--brand-navy)]', onClick: () => generateDemoData(false), disabled: busy },
    { label: 'Reset Demo', icon: '🔄', color: 'bg-[var(--brand-purple)] hover:bg-[var(--brand-purple-light)] text-[var(--foreground)]', onClick: () => generateDemoData(true), disabled: busy || !hasData, requireData: true },
    { label: 'Clear Demo', icon: '🗑️', color: 'bg-[var(--color-error)] hover:bg-red-600 text-[var(--foreground)]', onClick: clearDemoData, disabled: busy || !hasData, requireData: true },
    {
      label: enabled ? 'Turn Demo Mode Off' : 'Enable Demo Mode',
      icon: enabled ? '🔴' : '🟢',
      color: enabled
        ? 'bg-[var(--neutral-gray-500)] hover:bg-gray-600 text-[var(--foreground)]'
        : 'bg-[var(--color-success)] hover:bg-green-600 text-[var(--foreground)]',
      onClick: toggleDemoMode,
      disabled: busy,
    },
    { label: 'Open Dashboard', icon: '📊', color: 'nav', onClick: () => nav('/admin') },
    { label: 'Open Companies', icon: '🏢', color: 'nav', onClick: () => nav('/admin/companies') },
    { label: 'Open Claims', icon: '📋', color: 'nav', onClick: () => nav('/admin/claims') },
    { label: 'Open Supplements', icon: '💰', color: 'nav', onClick: () => nav('/admin/supplements') },
    { label: 'Open Interviews', icon: '💬', color: 'nav', onClick: () => nav('/admin/interviews') },
    { label: 'Open Documents', icon: '📁', color: 'nav', onClick: () => nav('/admin/documents') },
    { label: 'Open Properties', icon: '🏠', color: 'nav', onClick: () => nav('/admin/properties') },
    { label: 'Open Adjusters', icon: '👷', color: 'nav', onClick: () => nav('/admin/adjusters') },
    { label: 'Open Activities', icon: '📈', color: 'nav', onClick: () => nav('/admin/activity') },
    { label: 'Open Tasks', icon: '✅', color: 'nav', onClick: () => nav('/admin/tasks') },
    { label: 'Open Decisions', icon: '🧠', color: 'nav', onClick: () => nav('/admin/decisions') },
    { label: 'Open Intelligence', icon: '🤖', color: 'nav', onClick: () => nav('/admin/intelligence') },
  ];

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Quick Actions</h2>
          <p className="text-sm text-[var(--neutral-gray-500)] mt-1">
            {hasData ? 'Demo data is live — everything below is populated' : 'Generate demo data to populate every screen'}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${enabled ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : 'bg-[var(--neutral-gray-200)] text-[var(--neutral-gray-500)]'}`}>
          {enabled ? 'Demo mode on' : 'Demo mode off'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {actions.map((action, index) => {
          const disabled = action.disabled || (action.requireData && !hasData);
          return (
            <button
              key={index}
              onClick={action.onClick}
              disabled={disabled}
              title={disabled && action.requireData ? 'Generate demo data first' : action.label}
              className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 ${
                disabled
                  ? 'opacity-40 cursor-not-allowed bg-[var(--neutral-gray-100)]'
                  : action.color === 'nav'
                    ? 'bg-[var(--background-alt)] hover:bg-[var(--neutral-gray-100)] text-[var(--foreground)] border border-[var(--neutral-gray-200)] hover:border-[var(--brand-cyan)]'
                    : action.color
              }`}
            >
              <span className="text-xl mb-1.5">{action.icon}</span>
              <span className="text-[11px] font-medium text-center leading-tight">{action.label}</span>
            </button>
          );
        })}
      </div>

      <GenerationOverlay active={overlay.active} label={overlay.label} />
    </div>
  );
}
