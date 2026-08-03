'use client';

// apps/web/src/components/demo/AIShowcase.tsx
// Showcase of Atlas AI capabilities with realistic demo content, confidence
// and risk gauges. If the intelligence API is unavailable the panel falls back
// to "simulated demo intelligence" rather than showing an error.

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Capability {
  id: string;
  title: string;
  icon: string;
  tagline: string;
  color: string;
  confidence: number;
  detail: { label: string; value: string }[];
  narrative: string;
}

const CAPABILITIES: Capability[] = [
  {
    id: 'photo',
    title: 'Photo Intelligence',
    icon: '📷',
    tagline: '22 photos analyzed — hail impacts detected',
    color: 'from-cyan-500 to-blue-500',
    confidence: 88,
    detail: [
      { label: 'Photos analyzed', value: '22' },
      { label: 'Hail impact detections', value: '10' },
      { label: 'Ridge cap damage', value: '4' },
      { label: 'Torn flashing', value: '3' },
      { label: 'Damage confidence', value: '0.88' },
    ],
    narrative:
      'Every photo is tagged with GPS and analyzed for damage patterns. Atlas detected hail impacts across three roof planes and annotated each location on the damage map.',
  },
  {
    id: 'evidence',
    title: 'Evidence Graph',
    icon: '🕸️',
    tagline: '5 links — strongest 0.95',
    color: 'from-emerald-500 to-teal-500',
    confidence: 92,
    detail: [
      { label: 'Evidence links', value: '5' },
      { label: 'Primary reasons', value: '4' },
      { label: 'Best strength', value: '0.95' },
      { label: 'Coverage score', value: '92' },
    ],
    narrative:
      'Every recommendation is connected to its supporting documents. The 22-photo package (0.95) and weather verification (0.85) anchor the roof replacement scope.',
  },
  {
    id: 'decision',
    title: 'Decision Engine',
    icon: '🧠',
    tagline: 'Final score 90/100 — APPROVED',
    color: 'from-purple-500 to-indigo-500',
    confidence: 90,
    detail: [
      { label: 'Confidence', value: '88.5' },
      { label: 'Risk', value: '22' },
      { label: 'Evidence score', value: '88' },
      { label: 'Coverage score', value: '92' },
      { label: 'Final score', value: '90' },
    ],
    narrative:
      'The Decision Engine combines evidence strength, coverage, compliance and risk into one explainable score, with a full reasoning trace and per-factor weights.',
  },
  {
    id: 'compliance',
    title: 'Compliance Validator',
    icon: '🛡️',
    tagline: '94/100 — COMPLIANT',
    color: 'from-green-500 to-emerald-600',
    confidence: 94,
    detail: [
      { label: 'Compliance score', value: '94' },
      { label: 'Status', value: 'COMPLIANT' },
      { label: 'Code basis', value: '2023 FBC' },
      { label: 'Fraud indicators', value: '0' },
    ],
    narrative:
      'All flagged line items are code-required under the 2023 Florida Building Code (R905.2.8.2). No fabricated measurements, no inflated quantities, no unrealistic pricing.',
  },
  {
    id: 'interview',
    title: 'Interview AI',
    icon: '💬',
    tagline: 'FNOL transcript — 6 key facts',
    color: 'from-sky-500 to-cyan-500',
    confidence: 85,
    detail: [
      { label: 'Interview type', value: 'FNOL' },
      { label: 'Status', value: 'Completed' },
      { label: 'Key facts extracted', value: '6' },
      { label: '→ Claim created', value: 'CL-2026-0614' },
    ],
    narrative:
      'The guided interview captured loss date, cause, roof age and policy details, then generated the claim, property and initial scope automatically.',
  },
  {
    id: 'memory',
    title: 'Atlas Memory',
    icon: '🧠',
    tagline: '3 conversations retained',
    color: 'from-amber-500 to-orange-500',
    confidence: 80,
    detail: [
      { label: 'Conversations', value: '3' },
      { label: 'Recovery query', value: '$18,421.15' },
      { label: 'Evidence query', value: '5 docs' },
      { label: 'Timeline query', value: '8 events' },
    ],
    narrative:
      'Atlas remembers every conversation about the claim — recovery expectations, supporting documents and timeline — and answers follow-ups instantly.',
  },
  {
    id: 'supplement',
    title: 'Supplement Intelligence',
    icon: '💰',
    tagline: '$22,835.65 — 6 line items',
    color: 'from-rose-500 to-pink-500',
    confidence: 87,
    detail: [
      { label: 'Supplement', value: '$22,835.65' },
      { label: 'Line items', value: '6' },
      { label: 'Code-required', value: '3' },
      { label: 'Approved', value: '$18,421.15' },
    ],
    narrative:
      'Six Xactimate line items from shingles to soffit, each priced, categorized and linked to evidence. Approval predicted at 88%.',
  },
  {
    id: 'voice',
    title: 'Voice Assistant',
    icon: '🎙️',
    tagline: 'Simulated conversation',
    color: 'from-violet-500 to-purple-600',
    confidence: 78,
    detail: [
      { label: 'Mode', value: 'Simulated demo' },
      { label: '“Recovery?”', value: '$18,421.15' },
      { label: '“Evidence?”', value: '5 documents' },
      { label: '“Timeline?”', value: '8 events' },
    ],
    narrative:
      'Ask Atlas anything about the claim by voice. Without an API key the assistant answers from the live demo dataset in simulated mode.',
  },
];

function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--neutral-gray-500)]">{label}</span>
        <span className="font-semibold text-[var(--foreground)]">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--neutral-gray-200)] overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function AIShowcase() {
  const [selected, setSelected] = useState<Capability | null>(null);
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiFetch('/intelligence/health')
      .then(() => mounted && setSimulated(false))
      .catch(() => mounted && setSimulated(true));
    return () => {
      mounted = false;
    };
  }, []);

  // Close the capability modal on Escape.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Atlas AI Capabilities</h2>
          <p className="text-sm text-[var(--neutral-gray-500)] mt-1">
            Every capability shown against the Carter Residence claim
          </p>
        </div>
        {simulated && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-warning)]/15 text-[var(--color-warning)]">
            Simulated demo intelligence
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CAPABILITIES.map((cap) => (
          <button
            key={cap.id}
            onClick={() => setSelected(cap)}
            className="text-left bg-[var(--background-alt)] hover:bg-[var(--neutral-gray-100)] rounded-xl border border-[var(--neutral-gray-200)] hover:border-[var(--brand-cyan)] transition-all duration-300 hover:shadow-lg p-4 group"
          >
            <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${cap.color} flex items-center justify-center text-xl shadow-md mb-3`}>
              {cap.icon}
            </div>
            <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--brand-cyan)] transition-colors">
              {cap.title}
            </h3>
            <p className="text-xs text-[var(--neutral-gray-500)] mt-1">{cap.tagline}</p>
            <div className="mt-3">
              <Gauge value={cap.confidence} label="Confidence" color={cap.color} />
            </div>
          </button>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-[95] bg-[var(--atlas-void)]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--neutral-gray-200)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className={`bg-gradient-to-r ${selected.color} px-6 py-5 flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selected.icon}</span>
                <div>
                  <h3 className="text-lg font-bold text-white">{selected.title}</h3>
                  <p className="text-white/80 text-sm">{selected.tagline}</p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-white/80 hover:text-white transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-[var(--neutral-gray-600)] leading-relaxed mb-5">{selected.narrative}</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {selected.detail.map((d) => (
                  <div key={d.label} className="bg-[var(--background-alt)] rounded-lg p-3 border border-[var(--neutral-gray-200)]">
                    <p className="text-xs text-[var(--neutral-gray-500)]">{d.label}</p>
                    <p className="text-sm font-bold text-[var(--foreground)] mt-0.5">{d.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-6">
                <Gauge value={selected.confidence} label="AI confidence" color={selected.color} />
                <Gauge value={100 - Math.round(selected.confidence * 0.35)} label="Risk (inverse)" color="from-[var(--color-error)] to-[var(--color-warning)]" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
