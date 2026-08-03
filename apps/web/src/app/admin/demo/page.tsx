'use client';

// apps/web/src/app/admin/demo/page.tsx
// Full guided demo experience: flagship Carter Residence story, live metrics,
// quick actions, animated walkthroughs, personas, AI capabilities, live
// interactive modules (evidence graph, photo intelligence, decision review,
// interview, supplement builder, timeline playback, voice) and the
// "Start Full Atlas Demo" auto-player. Every section refreshes after
// generate / reset / clear via the demo event bus, and nothing ever renders
// blank — sections degrade to friendly fallbacks.

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { DemoToastProvider } from '@/components/demo/DemoToast';
import DemoMetrics from '@/components/demo/DemoMetrics';
import PersonaCards from '@/components/demo/PersonaCards';
import GuidedWalkthroughs from '@/components/demo/GuidedWalkthroughs';
import QuickActions from '@/components/demo/QuickActions';
import ScenarioGallery from '@/components/demo/ScenarioGallery';
import FlagshipCard, { type FlagshipInfo } from '@/components/demo/FlagshipCard';
import AIShowcase from '@/components/demo/AIShowcase';
import ExportPanel from '@/components/demo/ExportPanel';
import EvidenceGraph from '@/components/demo/EvidenceGraph';
import PhotoIntelligence from '@/components/demo/PhotoIntelligence';
import DecisionReview from '@/components/demo/DecisionReview';
import InterviewPlayer from '@/components/demo/InterviewPlayer';
import SupplementBuilder from '@/components/demo/SupplementBuilder';
import TimelinePlayback from '@/components/demo/TimelinePlayback';
import VoiceAssistant from '@/components/demo/VoiceAssistant';
import FullDemoPlayer from '@/components/demo/FullDemoPlayer';
import { subscribeDemoChanged, notifyDemoChanged } from '@/lib/demo-events';

interface DemoStatus {
  enabled: boolean;
  hasData: boolean;
  companyId: string | null;
  companyName?: string;
  flagship?: FlagshipInfo;
}

function DemoExperienceInner() {
  const router = useRouter();
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullDemoOpen, setFullDemoOpen] = useState(false);

  useEffect(() => {
    checkDemoStatus();
    const unsubscribe = subscribeDemoChanged(() => checkDemoStatus());
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkDemoStatus = async (attempt = 0) => {
    try {
      const response = (await apiFetch('/demo/status')) as DemoStatus;
      setStatus(response);
      setLoading(false);
    } catch (error) {
      console.error('Error checking demo status:', error);
      // Automatic retry — transient network/API hiccups shouldn't blank the page.
      if (attempt < 2) {
        setTimeout(() => checkDemoStatus(attempt + 1), 900);
        return;
      }
      setStatus({ enabled: true, hasData: false, companyId: null });
      setLoading(false);
    }
  };

  const enableDemoMode = async () => {
    try {
      await apiFetch('/demo/toggle-mode', { method: 'POST', body: JSON.stringify({ enabled: true }) });
      notifyDemoChanged();
    } catch (err) {
      console.error('Enable demo mode error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-[var(--brand-cyan)] rounded-full animate-bounce" />
          <div className="w-3 h-3 bg-[var(--brand-purple)] rounded-full animate-bounce [animation-delay:150ms]" />
          <div className="w-3 h-3 bg-[var(--brand-cyan)] rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

  const demoOff = status?.enabled === false;

  return (
    <div className="space-y-8">
      {/* Welcome Screen */}
      <div className="text-center space-y-4">
        <div className="relative w-20 h-20 mx-auto">
          <Image
            src="/brand/logo-icon.svg"
            alt="Project Atlas"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-4xl font-bold text-[var(--foreground)]">Welcome to Atlas</h1>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${status?.enabled ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : 'bg-[var(--neutral-gray-200)] text-[var(--neutral-gray-500)]'}`}>
            {status?.enabled ? 'Demo mode' : 'Demo mode off'}
          </span>
        </div>
        <p className="text-xl text-[var(--brand-cyan)] font-medium">
          AI Operating System for Insurance Restoration
        </p>
        <p className="text-[var(--neutral-gray-500)] max-w-2xl mx-auto">
          {status?.companyName ? (
            <>
              Company <strong className="text-[var(--foreground)]">{status.companyName}</strong> — experience the
              full Carter Residence recovery, guided walkthroughs and AI capabilities.
            </>
          ) : (
            'Choose a scenario below to experience how Atlas manages restoration projects from first contact through claim completion.'
          )}
        </p>
        {!status?.hasData && (
          <p className="text-sm text-[var(--color-warning)] bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg max-w-md mx-auto px-4 py-3">
            No demo data yet — use <strong>Generate Demo Data</strong> or <strong>Start Full Atlas Demo</strong> below to seed
            a realistic company with the flagship <strong>Carter Residence</strong> claim, supplements, documents, evidence and AI records.
          </p>
        )}
      </div>

      {/* Start Full Atlas Demo — hero CTA */}
      {!demoOff && (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--brand-purple)]/30 bg-gradient-to-br from-[var(--brand-purple)]/15 via-[var(--surface)] to-[var(--brand-cyan)]/15 p-8 text-center">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[var(--brand-purple)]/10 blur-2xl" />
          <div className="absolute -bottom-20 -left-16 w-64 h-64 rounded-full bg-[var(--brand-cyan)]/10 blur-2xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/25 mb-4">
              <span className="mic-pulse inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
              Live — Atlas is running the claim lifecycle against the database
            </span>
            <h2 className="text-3xl font-bold text-[var(--foreground)]">
              Watch Atlas run the entire claim — end to end
            </h2>
            <p className="text-sm text-[var(--neutral-gray-500)] max-w-2xl mx-auto mt-3">
              17 lifecycle steps auto-execute against the live database: lead → inspection → interview → claim → photo
              intelligence → weather → evidence graph → decision engine → compliance → supplement → carrier approval →
              invoice → closed. Real AI reasoning, live metrics, animated progress — you just watch.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {['Auto-plays', 'Pause & skip', 'Live DB updates', '~5–8 min', 'Exportable package'].map((chip) => (
                <span key={chip} className="px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--background-alt)] border border-[var(--neutral-gray-200)] text-[var(--neutral-gray-500)]">
                  {chip}
                </span>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setFullDemoOpen(true)}
                className="px-8 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-[var(--brand-purple)] to-[var(--brand-cyan)] hover:opacity-90 transition-all shadow-xl hover:shadow-2xl active:scale-[0.98]"
              >
                🚀 Start Full Atlas Demo
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="px-8 py-4 rounded-xl text-base font-semibold border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] hover:text-[var(--brand-cyan)] transition-colors"
              >
                Open Dashboard →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Demo-mode-off banner */}
      {demoOff && (
        <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-[var(--foreground)]">Demo mode is off</p>
            <p className="text-sm text-[var(--neutral-gray-500)]">
              Guided walkthroughs, live modules, AI showcase and exports are hidden while demo mode is off. Your data is safe.
            </p>
          </div>
          <button
            onClick={enableDemoMode}
            className="px-5 py-2.5 bg-[var(--color-success)] hover:bg-green-600 text-white rounded-lg font-semibold transition-colors"
          >
            Enable Demo Mode
          </button>
        </div>
      )}

      {/* Flagship story */}
      <FlagshipCard flagship={status?.flagship || null} loading={false} />

      {/* Demo Metrics */}
      <DemoMetrics />

      {/* Quick Actions */}
      <QuickActions />

      {/* Demo Scenarios — switch the story */}
      <ScenarioGallery hasData={!!status?.hasData} />

      {/* Guided Walkthroughs */}
      {!demoOff && <GuidedWalkthroughs />}

      {/* Personas */}
      {!demoOff && <PersonaCards />}

      {/* Live Modules */}
      {!demoOff && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Live Modules</h2>
            <p className="text-sm text-[var(--neutral-gray-500)] mt-1">
              Interact with Atlas while it works — everything below runs against the Carter Residence dataset.
            </p>
          </div>

          {/* Evidence Graph — flagship visualization */}
          <EvidenceGraph />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <PhotoIntelligence />
            <DecisionReview onRefresh={() => notifyDemoChanged()} />
            <InterviewPlayer />
            <SupplementBuilder />
            <TimelinePlayback claimId={status?.flagship?.claimId} />
            <VoiceAssistant />
          </div>
        </div>
      )}

      {/* AI Capabilities */}
      {!demoOff && <AIShowcase />}

      {/* Export */}
      {!demoOff && (
        <div id="demo-export" className="scroll-mt-8">
          <ExportPanel />
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-[var(--neutral-gray-400)] pb-6">
        <button
          onClick={() => router.push('/admin')}
          className="hover:text-[var(--brand-cyan)] transition-colors"
        >
          Open the full dashboard →
        </button>
      </div>

      {/* Full Atlas Demo player */}
      <FullDemoPlayer
        open={fullDemoOpen}
        onClose={() => setFullDemoOpen(false)}
        hasData={!!status?.hasData}
        onDemoChanged={notifyDemoChanged}
      />
    </div>
  );
}

export default function DemoExperiencePage() {
  return (
    <DemoToastProvider>
      <DemoExperienceInner />
    </DemoToastProvider>
  );
}
