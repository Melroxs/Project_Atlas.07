'use client';

// apps/web/src/components/demo/VoiceAssistant.tsx
// Atlas Voice — simulated voice session. Uses the browser speechSynthesis API
// when available (real speech, no external service) and always renders a
// typewritten transcript so the demo works in any browser.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemoToast } from './DemoToast';

interface Message {
  from: 'atlas' | 'user';
  text: string;
}

const OPENING =
  "Hi, I'm Atlas Voice. I manage the Carter Residence claim end to end. Ask me anything about the decision, the supplement, or the evidence.";

const REPLIES: Record<string, string> = {
  approved:
    "The carrier approved $18,421.15 of the $22,835.65 supplement. Atlas assembled 22 photos, NOAA weather verification, drone measurements and a code-compliance report — the strongest evidence link scored 0.95. The Decision Engine estimated an 84% probability of approval before submission.",
  confidence:
    'The 88.5 confidence reflects four weighted factors: evidence 88, coverage 92, compliance 94, and a low risk factor of 18. The final score of 90 places this recommendation in the high-confidence band — meaning Atlas is highly certain the scope is defensible.',
  evidence:
    'Five evidence links anchor the decision: inspection photos at 0.95, drone imagery at 0.90, weather verification at 0.85, roof measurements at 0.80, and the code-compliance report at 0.88. Every dollar in the supplement traces back to one of these documents.',
  summary:
    'Carter Residence, 1458 Oak Ridge Drive, Orlando — wind and hail on June 14th, 2026. The carrier initial estimate was $4,414.50. Atlas built a supplement for $22,835.65 and recovered $18,421.15 — a 417% increase. The claim is now closed and paid.',
  next:
    'I would start with the Final Claim Package export — it bundles the executive summary, FNOL, policy, inspection report, photos, weather, evidence graph, decision report, compliance validation, estimate, supplement, communications, invoice, permit and timeline into one document.',
  openclaim:
    'Opening the Carter Residence claim in Atlas now. You will see the complete lifecycle — 22 photos, weather verification, evidence graph, decision record and the approved supplement for $18,421.15.',
};

const PROMPTS = [
  { id: 'approved', label: 'Why was the supplement approved?' },
  { id: 'confidence', label: 'Explain the 88.5 confidence' },
  { id: 'evidence', label: 'What evidence supports the decision?' },
  { id: 'summary', label: 'Summarize the claim' },
  { id: 'next', label: 'What should we do next?' },
  { id: 'openclaim', label: 'Open the claim in Atlas' },
];

function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const speak = (text: string) => {
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      utter.pitch = 1;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore — typed transcript still renders.
    }
  };
  return { supported, speak };
}

export default function VoiceAssistant({ onComplete }: { onComplete?: () => void }) {
  const router = useRouter();
  const toast = useDemoToast();
  const { supported, speak } = useSpeech();
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [muted, setMuted] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const typeTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (typeTimer.current) window.clearInterval(typeTimer.current);
    if (supported && !muted) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing, listening]);

  const typeReply = (text: string) => {
    setTyping(true);
    let i = 0;
    if (typeTimer.current) window.clearInterval(typeTimer.current);
    typeTimer.current = window.setInterval(() => {
      i += 3;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.from === 'atlas') {
          next[next.length - 1] = { from: 'atlas', text: text.slice(0, i) };
        }
        return next;
      });
      if (i >= text.length) {
        if (typeTimer.current) window.clearInterval(typeTimer.current);
        setTyping(false);
      }
    }, 16);
  };

  const atlasSay = (text: string) => {
    setMessages((prev) => [...prev, { from: 'atlas', text: '' }]);
    if (!muted) speak(text);
    window.setTimeout(() => typeReply(text), 350);
  };

  const start = () => {
    setActive(true);
    setListening(true);
    window.setTimeout(() => {
      setListening(false);
      atlasSay(OPENING);
    }, 1800);
  };

  const ask = (id: string, label: string) => {
    setMessages((prev) => [...prev, { from: 'user', text: label }]);
    setListening(true);
    window.setTimeout(() => {
      setListening(false);
      atlasSay(REPLIES[id] ?? REPLIES.summary);
      onComplete?.();
      // Voice command with a navigation action — open the claim after the reply lands.
      if (id === 'openclaim') {
        window.setTimeout(() => router.push('/admin/claims'), 2600);
      }
    }, 1100);
  };

  const end = () => {
    if (typeTimer.current) window.clearInterval(typeTimer.current);
    setMessages((prev) => [
      ...prev,
      {
        from: 'atlas',
        text: 'Session complete — this conversation used the same reasoning the Decision Engine applies to every claim. Ask me anything in the real product.',
      },
    ]);
    toast.info('Voice session ended — transcript kept for reference');
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="text-xl">🎙️</span> Atlas Voice
          </h3>
          <p className="text-xs text-[var(--neutral-gray-500)] mt-1">
            {supported ? 'Browser speech synthesis · no external API needed' : 'Simulated conversation · typed transcript'}
          </p>
        </div>
        <div className="flex gap-2">
          {active && (
            <button
              onClick={() => setMuted((m) => !m)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--neutral-gray-300)] text-[var(--foreground)] hover:border-[var(--brand-cyan)] transition-colors"
            >
              {muted ? '🔇 Muted' : '🔊 Voice on'}
            </button>
          )}
          {active && (
            <button
              onClick={end}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-error)]/40 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
            >
              End session
            </button>
          )}
        </div>
      </div>

      {!active ? (
        <div className="text-center py-8">
          <div className="mx-auto mb-5 relative w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-[var(--brand-purple)]/20 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[var(--brand-purple)] to-[var(--brand-cyan)] flex items-center justify-center text-3xl">
              🎙️
            </div>
          </div>
          <p className="text-sm text-[var(--neutral-gray-500)] mb-5">
            Have a live conversation with Atlas about the Carter Residence claim — decisions, supplements and evidence.
          </p>
          <button
            onClick={start}
            className="px-6 py-3 bg-[var(--brand-purple)] hover:bg-[var(--brand-purple-light)] text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            Start Voice Demo
          </button>
        </div>
      ) : (
        <>
          <div ref={bodyRef} className="h-64 overflow-y-auto space-y-3 mb-4 pr-1">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                    m.from === 'user'
                      ? 'bg-[var(--brand-cyan)] text-white rounded-br-sm'
                      : 'bg-[var(--background-alt)] border border-[var(--neutral-gray-200)] text-[var(--foreground)] rounded-bl-sm'
                  }`}
                >
                  {m.from === 'atlas' && <span className="text-[10px] font-semibold text-[var(--brand-purple)] block mb-0.5">ATLAS VOICE</span>}
                  {m.text || <span className="typing-caret">▍</span>}
                </div>
              </div>
            ))}
            {listening && (
              <div className="flex items-center gap-2 text-xs text-[var(--neutral-gray-500)]">
                <span className="mic-pulse inline-block w-2 h-2 rounded-full bg-[var(--color-error)]" />
                Listening…
              </div>
            )}
            {typing && <p className="text-xs text-[var(--neutral-gray-400)] italic">Atlas is responding…</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <button
                key={p.id}
                onClick={() => ask(p.id, p.label)}
                disabled={listening || typing}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--neutral-gray-300)] text-[var(--neutral-gray-500)] hover:border-[var(--brand-purple)] hover:text-[var(--brand-purple)] disabled:opacity-40 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
