'use client';

// apps/web/src/components/demo/GuidedWalkthroughs.tsx
// Cards for the six guided demos. Each card offers two paths:
//  - "Guided tour": the animated WalkthroughPlayer narrative, with "open in
//    Atlas" navigation into the live, populated screens.
//  - "Run this workflow live": the player executes the full claim lifecycle
//    against the live database (real writes, metrics, timeline) so the
//    walkthrough is an actual workflow, not just a tour.

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { notifyDemoChanged, subscribeDemoChanged } from '@/lib/demo-events';
import WalkthroughPlayer from './WalkthroughPlayer';
import { buildWalkthroughs, resolveClaimIds, type WalkthroughDef } from './walkthroughs';

export default function GuidedWalkthroughs() {
  const [walkthroughs, setWalkthroughs] = useState<WalkthroughDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<{ walkthrough: WalkthroughDef; live: boolean } | null>(null);

  useEffect(() => {
    load();
    const unsubscribe = subscribeDemoChanged(() => load());
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      const response = (await apiFetch('/demo/claims')) as { claims?: Array<{ id: string; claimNumber: string }> };
      const claims = response?.claims || [];
      const claimIdMap = resolveClaimIds(claims);
      setWalkthroughs(buildWalkthroughs(claimIdMap));
    } catch (err) {
      console.error('Error loading walkthroughs:', err);
      // Offline fallback: walkthroughs still render with unresolved targets.
      setWalkthroughs(buildWalkthroughs({ flagship: '', denied: '', commercial: '', first: '' }));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-[var(--neutral-gray-200)] rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-[var(--neutral-gray-200)] rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Guided Walkthroughs</h2>
        <p className="text-sm text-[var(--neutral-gray-500)] mt-1">
          Narrated tours — or run any workflow live against the database, with real records, metrics and timelines
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {walkthroughs.map((walkthrough) => (
          <div
            key={walkthrough.id}
            className="text-left bg-[var(--background-alt)] hover:bg-[var(--neutral-gray-100)] rounded-xl border border-[var(--neutral-gray-200)] hover:border-[var(--brand-cyan)] transition-all duration-300 hover:shadow-lg group p-5 flex flex-col"
          >
            <button
              onClick={() => setActive({ walkthrough, live: false })}
              className="text-left flex-1"
              aria-label={`Start ${walkthrough.title} guided tour`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${walkthrough.color} flex items-center justify-center text-2xl shadow-md shrink-0`}>
                  {walkthrough.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--brand-cyan)] transition-colors">
                    {walkthrough.title}
                  </h3>
                  <p className="text-sm text-[var(--neutral-gray-500)] mt-1">{walkthrough.tagline}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-[var(--neutral-gray-400)]">{walkthrough.steps.length} steps</span>
                <span className="text-sm font-medium text-[var(--brand-cyan)] opacity-0 group-hover:opacity-100 transition-opacity">
                  Start walkthrough →
                </span>
              </div>
            </button>

            <div className="mt-4 pt-3 border-t border-[var(--neutral-gray-200)] flex gap-2">
              <button
                onClick={() => setActive({ walkthrough, live: false })}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--background-alt)] border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] hover:text-[var(--brand-cyan)] transition-colors"
              >
                ▶ Guided tour
              </button>
              <button
                onClick={() => setActive({ walkthrough, live: true })}
                title="Executes the full claim lifecycle against the live database — real records, metrics and timeline updates"
                className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-[var(--brand-purple)] to-[var(--brand-cyan)] text-white hover:opacity-90 transition-all shadow-md active:scale-[0.97]"
              >
                ⚡ Run this workflow live
              </button>
            </div>
          </div>
        ))}
      </div>

      <WalkthroughPlayer
        open={active !== null}
        walkthrough={active?.walkthrough ?? null}
        live={active?.live ?? false}
        onClose={() => setActive(null)}
        onLiveComplete={() => notifyDemoChanged()}
      />
    </div>
  );
}
