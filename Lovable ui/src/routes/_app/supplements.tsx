import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atlas/PageHeader";
import { StatCard } from "@/components/atlas/StatCard";
import { StatusPill } from "@/components/atlas/StatusPill";
import { AtlasInsights } from "@/components/atlas/AtlasInsights";
import { Sparkles, FileText, ChevronRight, Filter, ArrowUpRight } from "lucide-react";
import { AtlasMark } from "@/components/atlas/AtlasLogo";

export const Route = createFileRoute("/_app/supplements")({
  head: () => ({ meta: [{ title: "Supplements — Atlas" }] }),
  component: SupplementsPage,
});

const QUEUE = [
  { id: "SUP-2847", claim: "NPP-2026-0837", carrier: "Allstate", priority: "High", tone: "rose" as const, amount: "$8,420", recovery: "$6,780", status: "Ready to submit", statusTone: "cyan" as const },
  { id: "SUP-2846", claim: "NPP-2026-0821", carrier: "Farmers", priority: "Medium", tone: "amber" as const, amount: "$4,120", recovery: "$3,290", status: "Awaiting docs", statusTone: "purple" as const },
  { id: "SUP-2845", claim: "NPP-2026-0815", carrier: "USAA", priority: "High", tone: "rose" as const, amount: "$5,900", recovery: "$4,800", status: "Under review", statusTone: "blue" as const },
  { id: "SUP-2844", claim: "NPP-2026-0803", carrier: "Liberty Mutual", priority: "Low", tone: "muted" as const, amount: "$2,100", recovery: "$1,850", status: "Approved", statusTone: "green" as const },
  { id: "SUP-2843", claim: "NPP-2026-0798", carrier: "Progressive", priority: "Medium", tone: "amber" as const, amount: "$3,650", recovery: "$2,940", status: "Ready to submit", statusTone: "cyan" as const },
];

function SupplementsPage() {
  return (
    <>
      <PageHeader
        eyebrow="AI Recovery Engine"
        title="Supplements"
        description="Atlas has drafted 18 supplements from your active claims."
        actions={
          <>
            <button className="h-9 px-3 rounded-lg border border-white/10 bg-white/[0.02] text-xs flex items-center gap-2"><Filter className="h-3.5 w-3.5" /> All carriers</button>
            <button className="h-9 px-3 rounded-lg bg-gradient-cyan text-primary-foreground text-xs font-medium flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Generate supplement</button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Queued" value="18" data={[8,10,12,11,14,13,16,15,17,16,18,18]} tone="cyan" />
        <StatCard label="Approval Rate" value="87%" data={[70,72,75,78,80,82,84,83,85,86,86,87]} tone="green" />
        <StatCard label="Avg Recovery" value="$4,120" data={[3000,3200,3400,3300,3500,3700,3900,4000,4050,4100,4110,4120]} tone="purple" />
        <StatCard label="Total Pipeline" value="$127K" data={[60,72,80,88,95,100,108,115,120,124,126,127]} tone="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan" />
              <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium">Supplement Queue</p>
            </div>
            <span className="text-xs text-muted-foreground">5 shown · 18 total</span>
          </div>
          <div className="divide-y divide-white/5">
            {QUEUE.map((s) => (
              <div key={s.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition cursor-pointer">
                <StatusPill tone={s.tone}>{s.priority}</StatusPill>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.id} · <span className="text-muted-foreground font-normal">{s.claim}</span></p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.carrier}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-cyan font-medium">{s.recovery}</p>
                  <p className="text-[10px] text-muted-foreground">of {s.amount}</p>
                </div>
                <StatusPill tone={s.statusTone}>{s.status}</StatusPill>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>

        <AtlasInsights
          items={[
            { text: "SUP-2847 (Allstate) is your highest expected recovery this week.", tone: "cyan" },
            { text: "Approval rate for supplements over $5K is 12% higher when submitted before Wednesday.", tone: "green" },
            { text: "Farmers has approved 4/4 supplements this month — worth prioritizing.", tone: "purple" },
          ]}
          action="Prioritize with Atlas"
        />
      </div>

      {/* AI generated supplement preview */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AtlasMark className="h-5 w-5" />
            <p className="text-[10px] tracking-[0.22em] uppercase text-cyan font-semibold">Atlas-generated preview · SUP-2847</p>
          </div>
          <button className="text-xs text-cyan flex items-center gap-1 hover:gap-2 transition-all">Open supplement <ArrowUpRight className="h-3 w-3" /></button>
        </div>
        <div className="grid md:grid-cols-3">
          <div className="md:col-span-2 p-6 border-r border-white/5">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground tracking-widest uppercase mb-2">
              <span>Claim ATL-2847</span>
              <span>·</span>
              <span>Allstate · Adjuster: R. Chen</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Residential Storm Damage — Supplement</h2>
            <p className="text-sm text-muted-foreground mt-1">Prepared by Atlas · Ready for review before submission.</p>

            <div className="mt-6 space-y-3">
              {[
                { label: "Roof decking replacement (240 sqft)", amt: "$2,140" },
                { label: "Ridge cap re-installation", amt: "$680" },
                { label: "Ice & water shield underlayment", amt: "$1,420" },
                { label: "Flashing & step flashing repair", amt: "$890" },
                { label: "Debris removal & disposal", amt: "$620" },
                { label: "Labor overhead & profit (10/10)", amt: "$3,030" },
              ].map((l) => (
                <div key={l.label} className="flex items-center justify-between text-sm border-b border-white/5 pb-2.5">
                  <span className="text-foreground/85">{l.label}</span>
                  <span className="text-cyan font-medium">{l.amt}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between p-4 rounded-xl bg-cyan/5 border border-cyan/20">
              <span className="text-sm text-muted-foreground">Total supplement</span>
              <span className="text-2xl font-semibold text-gradient-cyan">$8,780</span>
            </div>
          </div>
          <div className="p-6 bg-white/[0.015]">
            <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium mb-3">Signals</p>
            <ul className="space-y-2.5 text-sm">
              {["Missing documentation", "Estimate discrepancy detected", "Adjuster delay pattern", "3 unsupported line items"].map((s) => (
                <li key={s} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_6px_currentColor]" />{s}</li>
              ))}
            </ul>

            <div className="mt-6 p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Recommended action</p>
              <p className="text-sm">Prepare documentation review before supplement submission.</p>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="flex-1 h-9 rounded-lg bg-gradient-cyan text-primary-foreground text-xs font-medium">Submit to carrier</button>
              <button className="h-9 px-3 rounded-lg border border-white/10 bg-white/[0.02] text-xs">Edit</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
