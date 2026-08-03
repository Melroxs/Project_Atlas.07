'use client';

// apps/web/src/components/demo/PhotoIntelligence.tsx
// Simulated Atlas photo intelligence: scans the 22 Carter Residence photos and
// reports detected damage with confidence, severity, affected area, recommended
// scope and supporting photos. Deterministic mock — no external AI API needed.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemoToast } from './DemoToast';

interface DamageType {
  id: string;
  label: string;
  icon: string;
  count: number;
  confidence: number;
  severity: 'High' | 'Medium' | 'Low' | 'None';
  area: string;
  scope: string;
  photos: string[];
}

const DAMAGE_TYPES: DamageType[] = [
  { id: 'hail', label: 'Hail impacts', icon: '🌨️', count: 10, confidence: 0.92, severity: 'High', area: '12% of roof area — south & west slopes', scope: 'Replace impacted shingles + underlayment', photos: ['03', '07', '09', '11', '13', '15', '17', '19', '21', '22'] },
  { id: 'missing', label: 'Missing shingles', icon: '🕳️', count: 2, confidence: 0.87, severity: 'High', area: 'South slope — 2 shingles', scope: 'Replace missing shingles; inspect underlayment', photos: ['06', '08'] },
  { id: 'lifted', label: 'Lifted shingles', icon: '💨', count: 3, confidence: 0.84, severity: 'Medium', area: 'West slope — 3 lifted tabs', scope: 'Re-secure with code-compliant nails + sealant', photos: ['04', '10', '16'] },
  { id: 'granule', label: 'Granule loss', icon: '🟫', count: 12, confidence: 0.89, severity: 'Medium', area: '12% of roof area', scope: 'Age + hail stress — supports full replacement', photos: ['02', '05', '09', '12', '14', '18', '20', '22'] },
  { id: 'ridge', label: 'Ridge damage', icon: '🏔️', count: 4, confidence: 0.81, severity: 'Medium', area: 'Ridge cap', scope: 'Replace ridge cap + ridge vent', photos: ['01', '11', '21'] },
  { id: 'flashing', label: 'Flashing damage', icon: '🔩', count: 3, confidence: 0.86, severity: 'High', area: 'Chimney & valley flashing', scope: 'Replace torn flashing — leak risk', photos: ['04', '13', '17'] },
  { id: 'gutter', label: 'Gutter dents', icon: '🚿', count: 3, confidence: 0.9, severity: 'Low', area: 'Front gutters & downspouts', scope: 'Replace gutters — hail-dented', photos: ['08', '19'] },
  { id: 'hvac', label: 'HVAC damage', icon: '❄️', count: 1, confidence: 0.78, severity: 'Medium', area: 'Condenser — west unit', scope: 'Repair coil fins; document for carrier', photos: ['14'] },
  { id: 'fence', label: 'Fence damage', icon: '🚧', count: 2, confidence: 0.72, severity: 'Low', area: 'Back fence — 2 panels', scope: 'Replace 2 panels (separate line item)', photos: ['12', '20'] },
  { id: 'leak', label: 'Interior leaks', icon: '💧', count: 0, confidence: 0.95, severity: 'None', area: 'No active moisture detected', scope: 'None — moisture scan clean', photos: [] },
];

const PHOTO_PLANES = ['south slope', 'west slope', 'ridge', 'chimney flashing', 'front gutters', 'fence', 'HVAC condenser', 'north slope', 'valley', 'soffit'];

const SEVERITY_STYLE: Record<DamageType['severity'], string> = {
  High: 'bg-[var(--color-error)]/15 text-[var(--color-error)] border-[var(--color-error)]/30',
  Medium: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)] border-[var(--color-warning)]/30',
  Low: 'bg-[var(--brand-cyan)]/15 text-[var(--brand-cyan)] border-[var(--brand-cyan)]/30',
  None: 'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30',
};

export default function PhotoIntelligence({ onComplete }: { onComplete?: () => void }) {
  const router = useRouter();
  const toast = useDemoToast();
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [scanPhoto, setScanPhoto] = useState(1);
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scan animation: cycle through 22 photos, then reveal results progressively.
  useEffect(() => {
    if (phase !== 'scanning') return;
    let photo = 1;
    const interval = window.setInterval(() => {
      photo += 1;
      if (photo > 22) {
        window.clearInterval(interval);
        setPhase('done');
        setRevealed(0);
        return;
      }
      setScanPhoto(photo);
    }, 130);
    return () => window.clearInterval(interval);
  }, [phase]);

  // Progressive reveal of damage cards after scan completes.
  useEffect(() => {
    if (phase !== 'done') return;
    if (revealed >= DAMAGE_TYPES.length) {
      toast.success('Photo intelligence complete — 22 photos analyzed, 0.88 confidence');
      onComplete?.();
      return;
    }
    const t = window.setTimeout(() => setRevealed((r) => r + 1), 260);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, revealed]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const detected = DAMAGE_TYPES.filter((d) => d.count > 0);
  const totalFindings = detected.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="text-xl">📷</span> Photo Intelligence
          </h3>
          <p className="text-xs text-[var(--neutral-gray-500)] mt-1">
            22 inspection photos · drone + ground · deterministic AI analysis
          </p>
        </div>
        {phase === 'done' && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-success)]/15 text-[var(--color-success)]">
            {totalFindings} findings · confidence 0.88
          </span>
        )}
      </div>

      {phase === 'idle' && (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--neutral-gray-500)] mb-5">
            Atlas will scan every photo, classify damage, and map each finding to the claim scope.
          </p>
          <button
            onClick={() => setPhase('scanning')}
            className="px-6 py-3 bg-[var(--brand-purple)] hover:bg-[var(--brand-purple-light)] text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            Run Photo Intelligence
          </button>
        </div>
      )}

      {phase === 'scanning' && (
        <div className="py-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="scanline w-8 h-8 rounded-lg bg-[var(--brand-purple)]/20 border border-[var(--brand-purple)]/40 flex items-center justify-center text-[var(--brand-purple)]">
              <span className="animate-pulse">📷</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Analyzing photo {String(scanPhoto).padStart(2, '0')} —{' '}
                {PHOTO_PLANES[(scanPhoto - 1) % PHOTO_PLANES.length]}…
              </p>
              <div className="mt-2 h-1.5 bg-[var(--neutral-gray-200)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-purple)] rounded-full transition-all duration-150"
                  style={{ width: `${Math.round((scanPhoto / 22) * 100)}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-mono text-[var(--neutral-gray-400)]">{Math.round((scanPhoto / 22) * 100)}%</span>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {Array.from({ length: 22 }, (_, i) => (
              <span
                key={i}
                className={`w-6 h-6 rounded text-[10px] font-mono flex items-center justify-center border transition-colors ${
                  i + 1 <= scanPhoto
                    ? 'bg-[var(--brand-cyan)]/20 border-[var(--brand-cyan)]/40 text-[var(--brand-cyan)]'
                    : 'bg-[var(--background-alt)] border-[var(--neutral-gray-200)] text-[var(--neutral-gray-400)]'
                }`}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DAMAGE_TYPES.map((d, idx) => {
            if (idx >= revealed) return null;
            const isDetected = d.count > 0;
            return (
              <div
                key={d.id}
                className={`fade-up rounded-lg border p-3.5 ${
                  isDetected
                    ? 'border-[var(--neutral-gray-200)] bg-[var(--background-alt)]'
                    : 'border-dashed border-[var(--neutral-gray-200)] bg-[var(--background-alt)]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-semibold text-sm text-[var(--foreground)] flex items-center gap-2">
                    <span>{d.icon}</span> {d.label}
                  </p>
                  {isDetected ? (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SEVERITY_STYLE[d.severity]}`}>
                      {d.severity}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-success)]/10 text-[var(--color-success)]">
                      ✓ Clear
                    </span>
                  )}
                </div>
                <div className="space-y-1 text-xs text-[var(--neutral-gray-500)]">
                  <p>
                    <span className="text-[var(--foreground)] font-medium">{isDetected ? d.count : '0'}</span>{' '}
                    {isDetected ? `photo${d.count > 1 ? 's' : ''}` : 'instances'} · {d.area}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--neutral-gray-400)]">Confidence</span>
                    <span className="flex-1 h-1 bg-[var(--neutral-gray-200)] rounded-full overflow-hidden">
                      <span
                        className={`h-full rounded-full ${isDetected ? 'bg-[var(--brand-cyan)]' : 'bg-[var(--color-success)]'}`}
                        style={{ width: `${Math.round(d.confidence * 100)}%` }}
                      />
                    </span>
                    <span className="font-mono">{Math.round(d.confidence * 100)}%</span>
                  </p>
                  {isDetected && (
                    <>
                      <p>🔧 {d.scope}</p>
                      {d.photos.length > 0 && (
                        <p className="font-mono text-[10px] text-[var(--neutral-gray-400)]">
                          Photos: {d.photos.map((p) => `#${p}`).join(' · ')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {revealed >= DAMAGE_TYPES.length && (
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 mt-1">
              <p className="text-xs text-[var(--neutral-gray-500)]">
                Every finding is linked to the scope in the Evidence Graph and Decision Engine.
              </p>
              <button
                onClick={() => {
                  setPhase('idle');
                  setRevealed(0);
                }}
                className="px-4 py-2 text-xs font-semibold bg-[var(--background-alt)] border border-[var(--neutral-gray-200)] hover:border-[var(--brand-cyan)] text-[var(--foreground)] rounded-lg transition-colors"
              >
                ↻ Re-run analysis
              </button>
              <button
                onClick={() => router.push('/admin/documents')}
                className="px-4 py-2 text-xs font-semibold bg-[var(--brand-cyan)] hover:bg-[var(--brand-cyan-light)] text-white rounded-lg transition-all shadow-md"
              >
                Open documents in Atlas →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
