'use client';

// apps/web/src/components/demo/ScenarioGallery.tsx
// Multiple demo scenarios (requirement: switch scenario). Each card maps to a
// seeded claim persona. Clicking a card ensures demo data exists (generating
// on demand if needed), then deep-links straight into that claim's workspace.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { notifyDemoChanged } from '@/lib/demo-events';
import { useDemoToast } from './DemoToast';

interface Scenario {
  id: string;
  title: string;
  icon: string;
  customer: string;
  claimNumber: string;
  color: string;
  blurb: string;
}

const SCENARIOS: Scenario[] = [
  { id: 'residential', title: 'Residential Roof', icon: '🏠', customer: 'Carter Residence', claimNumber: 'CL-2026-0614', color: 'from-cyan-500 to-blue-600', blurb: 'Wind & hail — $4,414.50 estimate → $18,421.15 recovered (+417%)' },
  { id: 'commercial', title: 'Commercial Roof', icon: '🏢', customer: 'Westgate Shopping Centre', claimNumber: 'CL-2023-1188', color: 'from-green-500 to-emerald-600', blurb: 'Three-building TPO roof system, $193,400 across three supplements' },
  { id: 'water', title: 'Water Damage', icon: '💧', customer: 'Emily Johnson', claimNumber: 'CL-2024-0228', color: 'from-sky-500 to-blue-500', blurb: 'Mold remediation — drying, demolition and antimicrobial scope' },
  { id: 'fire', title: 'Fire Damage', icon: '🔥', customer: 'Robert Garcia', claimNumber: 'CL-2024-0311', color: 'from-orange-500 to-red-600', blurb: 'Structural fire — demolition, rebuild and content restoration' },
  { id: 'hurricane', title: 'Hurricane', icon: '🌀', customer: 'Oak Valley Apartments', claimNumber: 'CL-2023-0977', color: 'from-indigo-500 to-violet-600', blurb: 'Multi-unit emergency mitigation — tarping, extraction, dry-out' },
  { id: 'hail', title: 'Hail', icon: '🌨️', customer: 'George Callahan', claimNumber: 'CL-2024-0601', color: 'from-purple-500 to-fuchsia-600', blurb: 'Hail — roof and impact damage with granule loss' },
  { id: 'wind', title: 'Wind', icon: '💨', customer: 'Lisa Chen', claimNumber: 'CL-2024-0405', color: 'from-teal-500 to-cyan-600', blurb: 'Wind — roof and siding uplift, blown-off shingles' },
  { id: 'denied', title: 'Denied Claim Recovery', icon: '⚠️', customer: 'Robert Garcia', claimNumber: 'CL-2024-0311', color: 'from-rose-500 to-pink-600', blurb: 'Denial → AI gap analysis → regenerated supplement → approval' },
];

export default function ScenarioGallery({ hasData }: { hasData: boolean }) {
  const router = useRouter();
  const toast = useDemoToast();
  const [claimMap, setClaimMap] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async (): Promise<Record<string, string>> => {
    const empty: Record<string, string> = {};
    try {
      const response = (await apiFetch('/demo/claims')) as { claims?: Array<{ id: string; claimNumber: string }> };
      const map: Record<string, string> = {};
      for (const c of response?.claims || []) map[c.claimNumber] = c.id;
      setClaimMap(map);
      return map;
    } catch {
      // data may not exist yet — cards still render and generate on click
      return empty;
    } finally {
      setLoaded(true);
    }
  };

  const openScenario = async (scenario: Scenario) => {
    setBusyId(scenario.id);
    try {
      let map = claimMap;
      if (!hasData) {
        toast.info('Generating demo data for this scenario…');
        await apiFetch('/demo/generate', { method: 'POST' });
        notifyDemoChanged();
        // Re-fetch the claim map after seeding and use the fresh result directly
        // (state updates are async — a stale closure would miss the new claims).
        map = await loadClaims();
        toast.success('Demo data ready — opening the scenario');
      }
      const id = map[scenario.claimNumber];
      if (id) {
        router.push(`/admin/claims/${id}`);
      } else {
        toast.info('Opening the scenario claim list');
        router.push('/admin/claims');
      }
    } catch (err) {
      console.error('Scenario open error:', err);
      toast.error('Could not open the scenario — please generate demo data first');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Demo Scenarios</h2>
        <p className="text-sm text-[var(--neutral-gray-500)] mt-1">
          Switch the story — every scenario has its own customer, property, evidence, documents, supplement and outcome
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SCENARIOS.map((scenario) => {
          const busy = busyId === scenario.id;
          return (
            <button
              key={scenario.id}
              onClick={() => openScenario(scenario)}
              disabled={busy}
              className="text-left bg-[var(--background-alt)] hover:bg-[var(--neutral-gray-100)] rounded-xl border border-[var(--neutral-gray-200)] hover:border-[var(--brand-cyan)] transition-all duration-300 hover:shadow-lg group p-4 disabled:opacity-60"
            >
              <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${scenario.color} flex items-center justify-center text-xl shadow-md mb-3`}>
                {busy ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  scenario.icon
                )}
              </div>
              <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--brand-cyan)] transition-colors text-sm">
                {scenario.title}
              </h3>
              <p className="text-xs text-[var(--neutral-gray-500)] mt-1 line-clamp-2">{scenario.blurb}</p>
              <p className="text-[11px] font-mono text-[var(--brand-cyan)] mt-2">
                {scenario.customer} · {scenario.claimNumber}
              </p>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-[var(--neutral-gray-400)] mt-4">
        {loaded ? 'Every scenario resolves to its own populated claim, documents and evidence' : 'Loading scenario map…'}
      </p>
    </div>
  );
}
