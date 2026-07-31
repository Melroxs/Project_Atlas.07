import { createFileRoute } from "@tanstack/react-router";
import { Mic, Send, Sparkles, TrendingUp, FileText, Search, Mail, ArrowUpRight, Zap } from "lucide-react";
import { AtlasMark } from "@/components/atlas/AtlasLogo";

export const Route = createFileRoute("/_app/ask")({
  head: () => ({ meta: [{ title: "Ask Atlas — Project Atlas" }] }),
  component: AskAtlas,
});

const SUGGESTIONS = [
  { icon: TrendingUp, label: "What should my team work on today?" },
  { icon: FileText, label: "Generate a supplement for claim ATL-2847" },
  { icon: Search, label: "Find claim 1042" },
  { icon: Sparkles, label: "Summarize yesterday" },
  { icon: Zap, label: "Show unpaid invoices" },
  { icon: Mail, label: "Draft a follow-up email to Allstate" },
];

const CONVERSATION = [
  {
    role: "user",
    text: "What's the state of my book this morning?",
  },
  {
    role: "atlas",
    text: "You're carrying 17 active claims worth $412,300 in estimated recovery. 3 supplements are queued for review — the highest value is NPP-2026-0837 with Allstate at $6,780. Adjuster Ryan Chen replied on the Miller residence claim at 2:14 AM.",
    highlights: [
      "$42,380 revenue currently at risk",
      "6 claims missing documentation older than 48h",
      "Approval rate is trending +8% week-over-week",
    ],
  },
];

export function AskAtlas() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Greeting */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan/20 bg-cyan/5 px-3 py-1 mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-atlas-pulse" />
          <span className="text-[11px] tracking-widest uppercase text-cyan/90">Atlas is listening</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
          Good morning, <span className="text-gradient">Melissa</span>.
        </h1>
        <p className="mt-3 text-muted-foreground text-base max-w-lg mx-auto">
          17 active claims · 3 supplements require review · 1 adjuster replied overnight
        </p>
      </div>

      {/* Voice halo */}
      <div className="relative flex justify-center mb-10">
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="h-52 w-52 rounded-full bg-gradient-cyan opacity-15 blur-3xl animate-atlas-pulse" />
        </div>
        <button className="relative h-24 w-24 rounded-full bg-gradient-cyan grid place-items-center glow-cyan group hover:scale-105 transition-transform">
          <div className="absolute inset-0 rounded-full border border-white/30" />
          <div className="absolute inset-2 rounded-full border border-white/10" />
          <Mic className="h-8 w-8 text-primary-foreground" />
          {/* waveform */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-end gap-1 h-6">
            {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.4].map((h, i) => (
              <span
                key={i}
                className="w-[3px] bg-cyan/70 rounded-full origin-center animate-atlas-pulse"
                style={{ height: `${h * 100}%`, animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        </button>
      </div>

      {/* Composer */}
      <div className="relative mb-8">
        <div className="absolute -inset-px rounded-2xl bg-gradient-cyan opacity-40 blur-md" />
        <div className="relative glass-strong rounded-2xl p-2 flex items-center gap-2">
          <div className="pl-3">
            <AtlasMark className="h-5 w-5" />
          </div>
          <input
            className="flex-1 h-12 bg-transparent px-2 text-sm placeholder:text-muted-foreground focus:outline-none"
            placeholder="Ask Atlas anything..."
          />
          <button className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-cyan text-primary-foreground hover:opacity-90 transition">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Suggestions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-10">
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-left text-sm text-foreground/90 hover:border-cyan/30 hover:bg-white/[0.04] transition-all"
            >
              <span className="h-8 w-8 rounded-lg bg-cyan/10 text-cyan grid place-items-center shrink-0 group-hover:bg-cyan/20 transition">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1">{s.label}</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
            </button>
          );
        })}
      </div>

      {/* Conversation */}
      <div className="space-y-6">
        <p className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground font-medium">Earlier this morning</p>
        {CONVERSATION.map((m, i) => (
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-white/[0.04] border border-white/5 px-4 py-3 text-sm">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 rounded-xl bg-gradient-cyan grid place-items-center shrink-0 mt-1">
                <AtlasMark className="h-5 w-5" />
              </div>
              <div className="flex-1 glass rounded-2xl rounded-tl-sm p-4">
                <p className="text-sm leading-relaxed text-foreground/90">{m.text}</p>
                {m.highlights && (
                  <ul className="mt-3 space-y-1.5">
                    {m.highlights.map((h) => (
                      <li key={h} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-cyan shadow-[0_0_6px_currentColor]" />
                        {h}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex gap-2 text-[11px]">
                  <button className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground">Copy</button>
                  <button className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground">Share</button>
                  <button className="px-2.5 py-1 rounded-md bg-cyan/10 text-cyan hover:bg-cyan/20">Open in Claims</button>
                </div>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
