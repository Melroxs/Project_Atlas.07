import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atlas/PageHeader";
import { AtlasInsights } from "@/components/atlas/AtlasInsights";
import { StatusPill } from "@/components/atlas/StatusPill";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

export const Route = createFileRoute("/_app/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Atlas" }] }),
  component: CalendarPage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVENTS: Record<number, { title: string; time: string; tone: "cyan" | "purple" | "green" | "amber" }[]> = {
  3: [{ title: "Site inspection · Miller", time: "9:00 AM", tone: "cyan" }],
  8: [{ title: "Adjuster call · Chen", time: "11:30 AM", tone: "purple" }],
  12: [
    { title: "Interview · Homeowner", time: "10:00 AM", tone: "green" },
    { title: "Team standup", time: "3:00 PM", tone: "cyan" },
  ],
  15: [
    { title: "Supplement submission", time: "9:30 AM", tone: "cyan" },
    { title: "Site visit · Denver", time: "2:00 PM", tone: "amber" },
    { title: "Q3 review prep", time: "4:30 PM", tone: "purple" },
  ],
  18: [{ title: "Carrier follow-up · Allstate", time: "10:15 AM", tone: "purple" }],
  22: [{ title: "Property inspection · Tampa", time: "8:00 AM", tone: "cyan" }],
  27: [{ title: "Monthly recovery report", time: "1:00 PM", tone: "green" }],
};

function CalendarPage() {
  const today = 15;
  const days = Array.from({ length: 35 }, (_, i) => i - 2); // fake month starting offset
  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Calendar"
        description="Inspections, adjuster meetings and site visits — synced with your team."
        actions={
          <>
            <div className="h-9 rounded-lg border border-white/10 bg-white/[0.02] flex text-xs">
              {["Day", "Week", "Month"].map((v) => (
                <button key={v} className={`px-3 ${v === "Month" ? "bg-cyan/10 text-cyan" : "text-muted-foreground"}`}>{v}</button>
              ))}
            </div>
            <button className="h-9 px-3 rounded-lg bg-gradient-cyan text-primary-foreground text-xs font-medium flex items-center gap-2"><Plus className="h-3.5 w-3.5" /> New event</button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">July 2026</h2>
            <div className="flex items-center gap-1">
              <button className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/[0.05] text-muted-foreground"><ChevronLeft className="h-4 w-4" /></button>
              <button className="h-8 px-3 rounded-lg hover:bg-white/[0.05] text-xs text-cyan">Today</button>
              <button className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/[0.05] text-muted-foreground"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
            {DAYS.map((d) => <div key={d} className="px-2 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const inMonth = d > 0 && d <= 31;
              const evs = EVENTS[d] || [];
              const isToday = d === today;
              return (
                <div key={i} className={`min-h-[100px] rounded-lg border p-2 transition ${
                  isToday
                    ? "border-cyan/50 bg-cyan/5 shadow-[inset_0_0_20px_oklch(0.82_0.16_210/0.15)]"
                    : inMonth
                      ? "border-white/5 bg-white/[0.02] hover:border-white/10"
                      : "border-transparent opacity-40"
                }`}>
                  <div className={`text-xs font-medium ${isToday ? "text-cyan" : "text-muted-foreground"}`}>{inMonth ? d : ""}</div>
                  <div className="mt-1.5 space-y-1">
                    {evs.map((e, j) => {
                      const cls = {
                        cyan: "bg-cyan/15 text-cyan border-cyan/30",
                        purple: "bg-purple/15 text-purple border-purple/30",
                        green: "bg-green/15 text-green border-green/30",
                        amber: "bg-amber-400/15 text-amber-300 border-amber-400/30",
                      }[e.tone];
                      return (
                        <div key={j} className={`text-[10px] px-1.5 py-1 rounded truncate border ${cls}`}>
                          {e.time} · {e.title}
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium mb-4">Today · Jul 15</p>
            <div className="space-y-3">
              {(EVENTS[15] || []).map((e, i) => {
                const bar = { cyan: "bg-cyan", purple: "bg-purple", green: "bg-green", amber: "bg-amber-400" }[e.tone];
                return (
                  <div key={i} className="flex gap-3">
                    <div className={`w-1 rounded-full ${bar} shadow-[0_0_8px_currentColor]`} />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">{e.time}</p>
                      <p className="text-sm font-medium">{e.title}</p>
                    </div>
                    <StatusPill tone={e.tone}>Live</StatusPill>
                  </div>
                );
              })}

            </div>
          </div>
          <AtlasInsights
            items={[
              { text: "Thursday is packed — Atlas moved 2 low-priority tasks to Friday.", tone: "cyan" },
              { text: "3 adjuster calls scheduled this week. Prep decks auto-generated.", tone: "purple" },
              { text: "Consider batching Denver + Boulder site visits on Jul 22.", tone: "green" },
            ]}
          />
        </div>
      </div>
    </>
  );
}
