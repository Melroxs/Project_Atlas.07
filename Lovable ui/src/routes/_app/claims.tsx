import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atlas/PageHeader";
import { StatCard } from "@/components/atlas/StatCard";
import { StatusPill } from "@/components/atlas/StatusPill";
import { AtlasInsights } from "@/components/atlas/AtlasInsights";
import { Filter, Plus, LayoutGrid, List, MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/_app/claims")({
  head: () => ({ meta: [{ title: "Claims — Atlas" }] }),
  component: ClaimsPage,
});

const CLAIMS = [
  { id: "NPP-2026-0848", carrier: "State Farm", property: "1245 Oakwood Dr, Austin TX", status: "In Progress", tone: "cyan" as const, risk: "$5,200", supplement: "$8,420", updated: "2m ago" },
  { id: "NPP-2026-0837", carrier: "Allstate", property: "88 Beachside Ave, Miami FL", status: "Pending Review", tone: "purple" as const, risk: "$3,150", supplement: "$6,780", updated: "15m ago" },
  { id: "NPP-2026-0821", carrier: "Farmers Insurance", property: "902 Hillcrest Rd, Denver CO", status: "Documentation", tone: "blue" as const, risk: "$2,940", supplement: "$4,120", updated: "1h ago" },
  { id: "NPP-2026-0815", carrier: "USAA", property: "31 Willow Ct, San Antonio TX", status: "Carrier Response", tone: "amber" as const, risk: "$1,850", supplement: "$3,210", updated: "2h ago" },
  { id: "NPP-2026-0803", carrier: "Liberty Mutual", property: "1400 Grove St, Portland OR", status: "Approved", tone: "green" as const, risk: "$0", supplement: "$0", updated: "1d ago" },
  { id: "NPP-2026-0798", carrier: "Progressive", property: "220 Marina Blvd, Tampa FL", status: "In Progress", tone: "cyan" as const, risk: "$4,300", supplement: "$5,900", updated: "1d ago" },
  { id: "NPP-2026-0790", carrier: "Nationwide", property: "512 Maple Ln, Nashville TN", status: "Pending Review", tone: "purple" as const, risk: "$2,100", supplement: "$3,650", updated: "2d ago" },
];

const COLUMNS = [
  { title: "Intake", tone: "cyan" as const, count: 4 },
  { title: "Documentation", tone: "blue" as const, count: 6 },
  { title: "Supplement", tone: "purple" as const, count: 3 },
  { title: "Approved", tone: "green" as const, count: 4 },
];

function ClaimsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Claims"
        description="97 active claims across 12 carriers. Atlas is watching every one."
        actions={
          <>
            <button className="h-9 px-3 rounded-lg border border-white/10 bg-white/[0.02] text-xs flex items-center gap-2 hover:bg-white/[0.05]">
              <Filter className="h-3.5 w-3.5" /> Filter
            </button>
            <div className="h-9 rounded-lg border border-white/10 bg-white/[0.02] flex">
              <button className="px-2.5 rounded-l-lg bg-cyan/10 text-cyan"><LayoutGrid className="h-3.5 w-3.5" /></button>
              <button className="px-2.5 rounded-r-lg text-muted-foreground hover:text-foreground"><List className="h-3.5 w-3.5" /></button>
            </div>
            <button className="h-9 px-3 rounded-lg bg-gradient-cyan text-primary-foreground text-xs font-medium flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" /> New claim
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Revenue at Risk" value="$42,380" data={[3,5,4,7,6,5,8,10,9,11,10,13]} tone="cyan" hint="7d" />
        <StatCard label="Supplements Pending" value="18" data={[8,10,9,12,11,14,13,15,12,16,15,18]} tone="purple" hint="7d" />
        <StatCard label="Claims Need Attention" value="6" data={[2,3,3,5,4,6,7,6,5,7,6,6]} tone="blue" hint="7d" />
        <StatCard label="Recovered Opportunity" value="$127,500" data={[20,30,45,50,60,72,80,88,100,110,120,127]} tone="green" hint="30d" />
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {COLUMNS.map((col) => (
          <div key={col.title} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <StatusPill tone={col.tone}>{col.title}</StatusPill>
                <span className="text-xs text-muted-foreground">{col.count}</span>
              </div>
              <button className="text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-2.5">
              {CLAIMS.slice(0, col.count > 3 ? 3 : col.count).map((c, i) => (
                <div key={c.id + i} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-cyan/20 hover:bg-white/[0.04] cursor-pointer transition">
                  <p className="text-[11px] text-muted-foreground">{c.id}</p>
                  <p className="text-sm font-medium mt-1 truncate">{c.carrier}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">{c.property}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-cyan font-medium">{c.supplement}</span>
                    <span className="text-[10px] text-muted-foreground">{c.updated}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium">Recent Claims</p>
            <button className="text-xs text-cyan hover:text-cyan/80">View all claims →</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                <th className="text-left font-medium px-5 py-2.5">Claim</th>
                <th className="text-left font-medium py-2.5">Status</th>
                <th className="text-left font-medium py-2.5">Revenue at Risk</th>
                <th className="text-left font-medium py-2.5">Potential Supplement</th>
                <th className="text-left font-medium py-2.5">Updated</th>
                <th className="py-2.5" />
              </tr>
            </thead>
            <tbody>
              {CLAIMS.map((c) => (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02] transition">
                  <td className="px-5 py-3">
                    <p className="font-medium">{c.id}</p>
                    <p className="text-[11px] text-muted-foreground">{c.carrier}</p>
                  </td>
                  <td><StatusPill tone={c.tone}>{c.status}</StatusPill></td>
                  <td className="text-foreground/80">{c.risk}</td>
                  <td className="text-cyan font-medium">{c.supplement}</td>
                  <td className="text-muted-foreground text-xs">{c.updated}</td>
                  <td className="pr-5"><MoreHorizontal className="h-4 w-4 text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AtlasInsights
          items={[
            { text: "Claim NPP-2026-0837 with Allstate is missing 3 line items — likely a $6,780 recovery.", tone: "cyan" },
            { text: "Ryan Chen (State Farm) usually responds within 2 days. Follow up tomorrow.", tone: "purple" },
            { text: "6 claims older than 48h are missing documentation. Batch upload from tasks.", tone: "green" },
          ]}
          action="Open Atlas review queue"
        />
      </div>
    </>
  );
}
