import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atlas/PageHeader";
import { AtlasInsights } from "@/components/atlas/AtlasInsights";
import { StatusPill } from "@/components/atlas/StatusPill";
import { Play, Pause, Mic, ChevronRight } from "lucide-react";
import { AtlasMark } from "@/components/atlas/AtlasLogo";

export const Route = createFileRoute("/_app/interviews")({
  head: () => ({ meta: [{ title: "Interviews — Atlas" }] }),
  component: InterviewsPage,
});

const TRANSCRIPT = [
  { who: "Adjuster", time: "00:12", text: "I inspected the north elevation this morning. Ridge cap is missing across roughly 40 linear feet." },
  { who: "Contractor", time: "00:34", text: "That matches what we found. There's also decking damage in zone 3 that wasn't in the original estimate." },
  { who: "Homeowner", time: "01:02", text: "We first noticed the leak after the July 3rd storm. Water came through the ceiling above the master bedroom.", tone: "cyan" },
  { who: "Adjuster", time: "01:24", text: "Understood. I'll authorize an additional inspection to document interior damage before we close out the supplement." },
  { who: "Contractor", time: "01:58", text: "We can have drone imagery uploaded by end of day. Full documentation package tomorrow." },
];

const INTERVIEWS = [
  { name: "Miller Residence · Homeowner Interview", claim: "NPP-2026-0837", duration: "12:42", date: "Today", tone: "cyan" as const },
  { name: "Adjuster Chen · Site Walkthrough", claim: "ATL-2847", duration: "18:04", date: "Yesterday", tone: "purple" as const },
  { name: "Field Team · Denver Inspection", claim: "NPP-2026-0821", duration: "22:16", date: "2d ago", tone: "green" as const },
  { name: "Homeowner · Portland Wildfire Loss", claim: "NPP-2026-0803", duration: "9:28", date: "3d ago", tone: "amber" as const },
];

function InterviewsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Voice Intelligence"
        title="Interviews"
        description="Recorded conversations, transcribed and summarized by Atlas."
        actions={
          <button className="h-9 px-3 rounded-lg bg-gradient-cyan text-primary-foreground text-xs font-medium flex items-center gap-2">
            <Mic className="h-3.5 w-3.5" /> Record interview
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-4">
          <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium mb-3">Recent</p>
          <div className="space-y-2">
            {INTERVIEWS.map((i, idx) => (
              <div key={i.name} className={`rounded-xl p-3 cursor-pointer transition ${idx === 0 ? "bg-cyan/10 border border-cyan/20" : "hover:bg-white/[0.03] border border-transparent"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{i.name}</p>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{i.claim}</span><span>·</span><span>{i.duration}</span><span>·</span><span>{i.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] tracking-widest uppercase text-cyan/80 font-medium">Now playing</p>
                <h3 className="text-lg font-semibold mt-1">Miller Residence · Homeowner Interview</h3>
              </div>
              <StatusPill tone="cyan">Transcribed</StatusPill>
            </div>

            {/* Waveform */}
            <div className="glass rounded-xl p-4 flex items-center gap-4">
              <button className="h-10 w-10 rounded-full bg-gradient-cyan grid place-items-center text-primary-foreground glow-cyan"><Pause className="h-4 w-4" /></button>
              <div className="flex-1 flex items-end gap-[3px] h-10">
                {Array.from({ length: 64 }).map((_, i) => {
                  const h = 0.2 + Math.abs(Math.sin(i * 0.4)) * 0.8;
                  const played = i < 24;
                  return <span key={i} className={`w-[3px] rounded-full ${played ? "bg-cyan" : "bg-white/15"}`} style={{ height: `${h * 100}%` }} />;
                })}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">04:32 / 12:42</span>
            </div>

            {/* Transcript */}
            <div className="mt-6 space-y-4 max-h-[420px] overflow-y-auto scrollbar-thin pr-2">
              {TRANSCRIPT.map((t, i) => (
                <div key={i} className={`flex gap-3 ${t.tone ? "p-3 rounded-xl bg-cyan/5 border border-cyan/15" : ""}`}>
                  <div className="w-14 shrink-0 text-[11px] text-muted-foreground tabular-nums pt-1">{t.time}</div>
                  <div>
                    <p className="text-[11px] text-cyan/80 tracking-widest uppercase font-medium">{t.who}</p>
                    <p className="text-sm mt-1 leading-relaxed text-foreground/90">{t.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AtlasInsights
              title="Atlas Summary"
              items={[
                { text: "Missing ridge cap across 40 linear feet — north elevation.", tone: "cyan" },
                { text: "Interior water damage above master bedroom needs documentation.", tone: "purple" },
                { text: "Adjuster authorized additional inspection — action required.", tone: "green" },
              ]}
            />
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AtlasMark className="h-4 w-4" />
                <p className="text-[10px] tracking-[0.22em] uppercase text-cyan font-semibold">Action Items</p>
              </div>
              <ul className="space-y-2.5 text-sm">
                {[
                  "Upload drone imagery of north elevation by EOD",
                  "Document interior water damage in master bedroom",
                  "Send updated estimate to adjuster Chen",
                  "Follow up with homeowner on interior access",
                ].map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-cyan" />
                    <span className="text-foreground/90">{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
