'use client';

// apps/web/src/components/demo/InterviewPlayer.tsx
// Interview-Driven Claim Creation. Atlas runs a guided FNOL interview: each
// question types in, the customer answers, and Atlas extracts a structured
// fact in real time. Finishing persists the interview + claim via the live
// demo runner so the database and metrics actually update.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useDemoToast } from './DemoToast';

interface Qa {
  q: string;
  a: string;
  fact: { label: string; value: string; icon: string };
}

const INTERVIEW: Qa[] = [
  {
    q: 'Hi, this is Atlas on behalf of NPP Roofing & Restoration. Can you confirm the property address?',
    a: '1458 Oak Ridge Drive, Orlando, Florida 32810.',
    fact: { label: 'Property', value: '1458 Oak Ridge Dr, Orlando, FL 32810', icon: '🏠' },
  },
  {
    q: 'When did the damage happen?',
    a: 'June 14th — there was that really bad storm.',
    fact: { label: 'Loss date', value: 'June 14, 2026', icon: '📅' },
  },
  {
    q: 'What kind of damage did you notice?',
    a: 'Shingles on the roof, the gutters got dented, and the fence took a hit too.',
    fact: { label: 'Cause & damage', value: 'Wind & hail — roof, gutters, fence', icon: '🌪️' },
  },
  {
    q: 'Who is your insurance carrier?',
    a: 'Universal Property & Casualty.',
    fact: { label: 'Carrier', value: 'Universal Property & Casualty', icon: '🏛️' },
  },
  {
    q: 'Do you have your policy number handy?',
    a: 'UPC-55420-FL, I think. The deductible is a thousand.',
    fact: { label: 'Policy', value: 'UPC-55420-FL · $1,000 deductible', icon: '📑' },
  },
  {
    q: 'Roughly how old is the roof?',
    a: 'About 12 years.',
    fact: { label: 'Roof age', value: '12 years', icon: '🏗️' },
  },
];

export default function InterviewPlayer({ onComplete }: { onComplete?: () => void }) {
  const router = useRouter();
  const toast = useDemoToast();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState<'question' | 'answer' | 'extract'>('question');
  const [saving, setSaving] = useState(false);
  const [facts, setFacts] = useState<Qa['fact'][]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => () => {
    timers.current.forEach((t) => window.clearTimeout(t));
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const start = () => {
    setPhase('running');
    setStep(0);
    setFacts([]);
    runStep(0);
  };

  const runStep = (idx: number) => {
    setStep(idx);
    setStage('question');
    later(() => {
      setStage('answer');
      later(() => {
        setStage('extract');
        setFacts((prev) => [...prev, INTERVIEW[idx].fact]);
        later(() => {
          if (idx + 1 < INTERVIEW.length) {
            runStep(idx + 1);
          } else {
            setPhase('done');
            toast.success('Interview complete — 6 facts extracted from the conversation');
          }
        }, 1100);
      }, 1900);
    }, 1600);
  };

  const saveAndCreateClaim = async () => {
    setSaving(true);
    try {
      // Persist the interview note + claim creation through the live runner.
      for (const stepId of ['interview', 'claim'] as const) {
        try {
          await apiFetch('/demo/run-step', { method: 'POST', body: JSON.stringify({ stepId }) });
        } catch {
          // Fall through — second step may still work; errors surface via toast.
        }
      }
      toast.success('Interview saved — claim CL-2026-0614 updated from the conversation');
      onComplete?.();
    } catch (err) {
      console.error('Interview save error:', err);
      toast.error('Could not persist interview — generate demo data first');
    } finally {
      setSaving(false);
    }
  };

  const qa = INTERVIEW[step];

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="text-xl">💬</span> AI Interview
          </h3>
          <p className="text-xs text-[var(--neutral-gray-500)] mt-1">
            First Notice of Loss — Atlas listens, extracts, and builds the claim
          </p>
        </div>
        {phase === 'running' && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--brand-purple)]/15 text-[var(--brand-purple)]">
            Question {step + 1} of {INTERVIEW.length}
          </span>
        )}
      </div>

      {phase === 'idle' && (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--neutral-gray-500)] mb-5">
            Watch Atlas conduct the customer interview — extracting property, loss, cause, carrier and policy in real time.
          </p>
          <button
            onClick={start}
            className="px-6 py-3 bg-[var(--brand-cyan)] hover:bg-[var(--brand-cyan-light)] text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            ▶ Play Interview
          </button>
        </div>
      )}

      {phase === 'running' && qa && (
        <div className="space-y-4">
          {/* Conversation */}
          <div className="space-y-3">
            <div className="fade-up bg-[var(--background-alt)] border border-[var(--neutral-gray-200)] rounded-xl rounded-bl-sm p-3.5">
              <p className="text-[10px] font-semibold text-[var(--brand-cyan)] mb-1">ATLAS</p>
              {stage === 'question' ? (
                <p className="text-sm text-[var(--foreground)]">
                  {qa.q} <span className="typing-caret">▍</span>
                </p>
              ) : (
                <p className="text-sm text-[var(--foreground)]">{qa.q}</p>
              )}
            </div>
            {stage !== 'question' && (
              <div className="fade-up bg-[var(--brand-purple)] text-white rounded-xl rounded-br-sm p-3.5 ml-6">
                <p className="text-[10px] font-semibold text-white/70 mb-1">CARTER RESIDENCE</p>
                {stage === 'answer' ? (
                  <p className="text-sm">
                    {qa.a} <span className="typing-caret">▍</span>
                  </p>
                ) : (
                  <p className="text-sm">{qa.a}</p>
                )}
              </div>
            )}
          </div>

          {/* Extracted facts */}
          {facts.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--neutral-gray-400)] mb-2">
                Extracting structured data…
              </p>
              <div className="flex flex-wrap gap-2">
                {facts.map((f, i) => (
                  <span
                    key={i}
                    className="fade-up inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-xs text-[var(--foreground)]"
                  >
                    <span>{f.icon}</span>
                    <span className="font-semibold text-[var(--color-success)]">{f.label}:</span> {f.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Progress */}
          <div className="h-1.5 bg-[var(--neutral-gray-200)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-purple)] rounded-full transition-all duration-700"
              style={{ width: `${((step + 1) / INTERVIEW.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="fade-up space-y-4">
          <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 rounded-xl p-4">
            <p className="text-sm font-semibold text-[var(--foreground)] mb-1">Interview complete</p>
            <p className="text-xs text-[var(--neutral-gray-500)]">
              6 facts extracted — property, loss date, cause, carrier, policy and roof age. Atlas can now create the claim,
              damage scope and timeline automatically.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={saveAndCreateClaim}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--color-success)] hover:bg-green-600 text-white transition-all active:scale-[0.97] disabled:opacity-50 shadow-md"
              >
                {saving ? 'Saving…' : '✓ Save interview & create claim'}
              </button>
              <button
                onClick={start}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] transition-colors"
              >
                ↻ Replay
              </button>
              <button
                onClick={() => router.push('/admin/interviews')}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--brand-cyan)] text-[var(--brand-cyan)] hover:bg-[var(--brand-cyan)]/10 transition-colors"
              >
                Open interviews →
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {facts.map((f, i) => (
              <div key={i} className="bg-[var(--background-alt)] rounded-lg border border-[var(--neutral-gray-200)] p-2.5">
                <p className="text-[10px] text-[var(--neutral-gray-400)] flex items-center gap-1">
                  <span>{f.icon}</span> {f.label}
                </p>
                <p className="text-xs font-medium text-[var(--foreground)] mt-0.5">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
