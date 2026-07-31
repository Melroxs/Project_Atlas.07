import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atlas/PageHeader";
import { StatCard } from "@/components/atlas/StatCard";
import { AtlasInsights } from "@/components/atlas/AtlasInsights";
import { Sparkline } from "@/components/atlas/Sparkline";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Atlas" }] }),
  component: AnalyticsPage,
});

const CARRIERS = [
  { name: "State Farm", rate: 92, revenue: "$318K", tone: "cyan" as const },
  { name: "Allstate", rate: 88, revenue: "$264K", tone: "purple" as const },
  { name: "Farmers", rate: 84, revenue: "$212K", tone: "blue" as const },
  { name: "USAA", rate: 79, revenue: "$188K", tone: "green" as const },
  { name: "Liberty Mutual", rate: 76, revenue: "$142K", tone: "cyan" as const },
  { name: "Progressive", rate: 72, revenue: "$108K", tone: "purple" as const },
];

const BARS = [45, 62, 58, 74, 68, 82, 76, 90, 84, 96, 92, 108];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function AnalyticsPage() {
  const max = Math.max(...BARS);
  return (
    <>
      <PageHeader
        eyebrow="Executive"
        title="Analytics"
        description="Portfolio-level intelligence across recovery, approval and performance."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Recovered" value="$1.42M" data={[800,850,900,950,1020,1080,1120,1180,1240,1300,1360,1420]} tone="green" hint="YTD" />
        <StatCard label="Approval Rate" value="87%" data={[72,75,78,80,82,83,84,85,85,86,86,87]} tone="cyan" hint="30d" />
        <StatCard label="Avg Cycle Time" value="14.2d" data={[22,20,19,18,17,16,16,15,15,14,14,14]} tone="purple" hint="30d" />
        <StatCard label="Supplements Won" value="132" data={[70,80,90,95,100,108,115,118,122,128,130,132]} tone="blue" hint="YTD" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium">Monthly Recovery</p>
              <h3 className="text-2xl font-semibold mt-1">$1.42M <span className="text-sm text-green">+18.4%</span></h3>
            </div>
            <div className="flex gap-2 text-[11px]">
              {["1M", "3M", "6M", "YTD", "1Y"].map((v, i) => (
                <button key={v} className={`px-2.5 py-1 rounded-md ${i === 3 ? "bg-cyan/10 text-cyan" : "text-muted-foreground hover:text-foreground"}`}>{v}</button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2 h-56">
            {BARS.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-cyan/20 to-cyan/80 group-hover:from-purple/30 group-hover:to-purple/80 transition-colors relative"
                    style={{ height: `${(b / max) * 100}%` }}
                  >
                    <div className="absolute inset-x-0 -top-8 text-center opacity-0 group-hover:opacity-100 transition text-[10px] font-medium">${b}K</div>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <AtlasInsights
          items={[
            { text: "October is projected to close at $138K based on your current pipeline velocity.", tone: "cyan" },
            { text: "Cycle time improved 32% since Q1 — Atlas automations saved ~48 hours/week.", tone: "green" },
            { text: "Approval rate for high-value supplements exceeds carrier averages by 12 points.", tone: "purple" },
          ]}
          action="Generate Q3 report"
        />
      </div>

      <div className="glass rounded-2xl p-6">
        <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium mb-5">Carrier Performance</p>
        <div className="space-y-4">
          {CARRIERS.map((c) => (
            <div key={c.name} className="grid grid-cols-12 items-center gap-4">
              <div className="col-span-3">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-[11px] text-muted-foreground">{c.revenue} · recovered</p>
              </div>
              <div className="col-span-7">
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-cyan shadow-[0_0_12px_oklch(0.82_0.16_210/0.5)]`}
                    style={{ width: `${c.rate}%` }}
                  />
                </div>
              </div>
              <div className="col-span-2 text-right">
                <p className="text-sm font-medium text-cyan">{c.rate}%</p>
                <p className="text-[10px] text-muted-foreground">approval</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {[
          { label: "Cyan trend", tone: "cyan" as const, data: [10,14,12,18,16,22,20,26,24,30,28,32] },
          { label: "Purple trend", tone: "purple" as const, data: [8,10,14,12,18,16,20,18,22,24,26,28] },
          { label: "Green trend", tone: "green" as const, data: [4,8,10,14,12,18,20,22,26,28,30,34] },
        ].map((t) => (
          <div key={t.label} className="glass rounded-2xl p-5">
            <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium mb-2">{t.label}</p>
            <Sparkline data={t.data} tone={t.tone} height={80} />
          </div>
        ))}
      </div>
    </>
  );
}
