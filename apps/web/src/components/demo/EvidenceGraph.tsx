'use client';

// apps/web/src/components/demo/EvidenceGraph.tsx
// Interactive evidence graph for the Carter Residence claim. Nodes connect
// around the decision; clicking a node opens its supporting evidence.

import { useState } from 'react';

interface GraphNode {
  id: string;
  label: string;
  icon: string;
  x: number;
  y: number;
  evidence: string[];
  strength?: number;
}

const NODES: GraphNode[] = [
  { id: 'claim', label: 'Claim', icon: '📄', x: 50, y: 8, evidence: ['CL-2026-0614 — Wind & Hail', 'Carrier: Universal Property & Casualty', 'Loss date: 2026-06-14', 'Policy: UPC-55420-FL'] },
  { id: 'property', label: 'Property', icon: '🏠', x: 6, y: 26, evidence: ['1458 Oak Ridge Drive, Orlando, FL 32810', 'Roof: 26 squares, 3 planes', 'Age: 12 years', '12:12 main pitch'] },
  { id: 'photos', label: 'Photos', icon: '📷', x: 6, y: 62, evidence: ['22 inspection photos', '10 hail impacts detected', 'Ridge cap damage (4)', 'Torn flashing (3)', 'Gutter dents (3)'] },
  { id: 'interview', label: 'Interview', icon: '💬', x: 30, y: 92, evidence: ['FNOL transcript on file', '6 key facts extracted', 'Loss date confirmed', 'Cause: wind & hail'] },
  { id: 'weather', label: 'Weather', icon: '⛈️', x: 70, y: 92, evidence: ['NOAA verified — 61 mph gusts', '1.25-inch hail', 'Exceeds 55 mph policy threshold', 'Causation validated'] },
  { id: 'policy', label: 'Policy', icon: '📑', x: 94, y: 62, evidence: ['Policy UPC-55420-FL', '$1,000 deductible', 'Wind coverage: 55 mph threshold', 'Full roof replacement clause'] },
  { id: 'code', label: 'Code', icon: '📜', x: 94, y: 26, evidence: ['2023 Florida Building Code', 'R905.2.8.2 underlayment upgrade', '180 mph exposure B rating', 'Ridge vent per manufacturer'] },
  { id: 'decision', label: 'Decision', icon: '🧠', x: 50, y: 50, evidence: ['Final score 90/100 — APPROVED', 'Confidence 88.5 · Risk 22', 'Compliance 94/100', 'Recommendation: full roof replacement', 'Reasoning trace: photos → weather → code'] },
  { id: 'supplement', label: 'Supplement', icon: '💰', x: 22, y: 70, evidence: ['$22,835.65 requested', '6 Xactimate line items', '3 code-required', 'Approved: $18,421.15'] },
  { id: 'carrier', label: 'Carrier', icon: '🏛️', x: 78, y: 70, evidence: ['Universal Property & Casualty', 'Adjuster: Marta Alvarez', 'Approval received 2026-07-18', 'Payment via ACH'] },
  { id: 'invoice', label: 'Invoice', icon: '🧾', x: 50, y: 30, evidence: ['Invoice ATL-8821', '$18,421.15 — paid', 'Issued 2026-07-22', 'Balance $0.00'] },
  { id: 'timeline', label: 'Timeline', icon: '🗓️', x: 50, y: 78, evidence: ['Lead → Inspection → Interview', 'Photos → Weather → Decision', 'Supplement → Approval', 'Invoice → Closed (+417%)'] },
];

const EDGES: Array<[string, string, string]> = [
  ['claim', 'property', '1'],
  ['claim', 'photos', '1'],
  ['claim', 'interview', '1'],
  ['claim', 'weather', '1'],
  ['claim', 'policy', '1'],
  ['claim', 'code', '1'],
  ['photos', 'decision', '0.95'],
  ['weather', 'decision', '0.85'],
  ['interview', 'decision', '0.7'],
  ['code', 'decision', '0.88'],
  ['decision', 'supplement', '0.9'],
  ['supplement', 'carrier', '0.8'],
  ['carrier', 'invoice', '1'],
  ['decision', 'invoice', '0.9'],
  ['claim', 'timeline', '1'],
];

const nodeById = (id: string) => NODES.find((n) => n.id === id)!;

export default function EvidenceGraph() {
  const [selected, setSelected] = useState<GraphNode>(nodeById('decision'));

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Evidence Graph</h2>
          <p className="text-sm text-[var(--neutral-gray-500)] mt-1">
            How every piece of evidence connects to the decision
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--brand-cyan)]/15 text-[var(--brand-cyan)]">
          {NODES.length} nodes · {EDGES.length} links
        </span>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* Graph */}
        <div className="relative">
          <svg viewBox="0 0 100 100" className="w-full h-auto">
            {/* edges */}
            {EDGES.map(([from, to, strength], i) => {
              const a = nodeById(from);
              const b = nodeById(to);
              const stroke = selected.id === from || selected.id === to ? 'var(--brand-cyan)' : 'var(--neutral-gray-300)';
              return (
                <line
                  key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={stroke}
                  strokeWidth={selected.id === from || selected.id === to ? 1.2 : 0.6}
                  strokeOpacity={0.6}
                />
              );
            })}
            {/* nodes */}
            {NODES.map((n) => {
              const isSelected = selected.id === n.id;
              return (
                <g
                  key={n.id}
                  onClick={() => setSelected(n)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={n.x} cy={n.y} r={isSelected ? 7 : 6}
                    fill={isSelected ? 'var(--brand-cyan)' : 'var(--surface)'}
                    stroke={isSelected ? 'var(--brand-navy)' : 'var(--neutral-gray-400)'}
                    strokeWidth={0.8}
                  />
                  {isSelected && (
                    <circle cx={n.x} cy={n.y} r={10} fill="none" stroke="var(--brand-cyan)" strokeOpacity={0.5} className="graph-pulse" />
                  )}
                  <text x={n.x} y={n.y + 14} textAnchor="middle" fontSize={3.2} fill="var(--foreground)" fontWeight={isSelected ? 700 : 500}>
                    {n.icon} {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Evidence panel */}
        <div className="bg-[var(--background-alt)] rounded-xl border border-[var(--neutral-gray-200)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{selected.icon}</span>
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">{selected.label}</h3>
              {selected.strength && (
                <p className="text-xs text-[var(--brand-cyan)]">Link strength {selected.strength}</p>
              )}
            </div>
          </div>
          <ul className="space-y-2">
            {selected.evidence.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--neutral-gray-600)]">
                <span className="text-[var(--color-success)] mt-0.5">✓</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--neutral-gray-400)] mt-4">
            Tip: click any node to inspect its supporting evidence.
          </p>
        </div>
      </div>
    </div>
  );
}
