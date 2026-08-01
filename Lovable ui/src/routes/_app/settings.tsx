import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atlas/PageHeader";
import { StatusPill } from "@/components/atlas/StatusPill";
import { Building, Users, Shield, Plug, Sparkles, Palette, CreditCard, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Atlas" }] }),
  component: SettingsPage,
});

const SECTIONS = [
  { id: "org", icon: Building, label: "Organization" },
  { id: "team", icon: Users, label: "Team & Permissions" },
  { id: "integrations", icon: Plug, label: "Integrations" },
  { id: "ai", icon: Sparkles, label: "AI Settings" },
  { id: "branding", icon: Palette, label: "Company Branding" },
  { id: "billing", icon: CreditCard, label: "Billing" },
  { id: "security", icon: Shield, label: "Security" },
  { id: "audit", icon: FileText, label: "Audit Logs" },
];

function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Workspace" title="Settings" description="Configure Atlas to fit how your team runs." />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <nav className="glass rounded-2xl p-3 h-fit space-y-1">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button key={s.id} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition ${i === 0 ? "bg-cyan/10 text-cyan" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"}`}>
                <Icon className="h-4 w-4" />
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="lg:col-span-3 space-y-6">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold">Organization</h2>
            <p className="text-xs text-muted-foreground mt-1">This information is shared across your workspace.</p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Organization name", value: "NPP Roofing & Restoration" },
                { label: "Legal entity", value: "NPP Restoration LLC" },
                { label: "Website", value: "npproofing.com" },
                { label: "Primary contact", value: "melissa@npproofing.com" },
                { label: "Timezone", value: "America/Chicago" },
                { label: "Currency", value: "USD ($)" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-[11px] tracking-widest uppercase text-muted-foreground font-medium">{f.label}</label>
                  <input defaultValue={f.value} className="mt-1.5 w-full h-10 px-3 rounded-lg bg-white/[0.02] border border-white/10 text-sm focus:border-cyan/40 focus:outline-none focus:ring-2 focus:ring-cyan/20" />
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Integrations</h2>
                <p className="text-xs text-muted-foreground mt-1">Bring adjuster tools, CRMs and estimating platforms into Atlas.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: "Xactimate", desc: "Sync estimates and line items", status: "Connected", tone: "green" as const },
                { name: "Symbility", desc: "Adjuster estimate parity", status: "Connected", tone: "green" as const },
                { name: "CompanyCam", desc: "Photo & video sync", status: "Connected", tone: "green" as const },
                { name: "HubSpot", desc: "CRM lead pipeline", status: "Available", tone: "muted" as const },
                { name: "QuickBooks", desc: "Invoicing & payments", status: "Connected", tone: "green" as const },
                { name: "DocuSign", desc: "Digital agreements", status: "Available", tone: "muted" as const },
              ].map((it) => (
                <div key={it.name} className="flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-cyan/20 transition">
                  <div className="h-10 w-10 rounded-lg bg-gradient-cyan grid place-items-center text-primary-foreground text-[10px] font-semibold">{it.name.slice(0,2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{it.name}</p>
                    <p className="text-[11px] text-muted-foreground">{it.desc}</p>
                  </div>
                  <StatusPill tone={it.tone}>{it.status}</StatusPill>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold">AI Settings</h2>
            <p className="text-xs text-muted-foreground mt-1">Tune how Atlas thinks, writes and recommends.</p>
            <div className="mt-6 space-y-4">
              {[
                { label: "Auto-generate supplements from claims", desc: "Atlas drafts a supplement whenever new documentation lands.", on: true },
                { label: "Suggest tasks from voice interviews", desc: "Extract action items from transcripts automatically.", on: true },
                { label: "Nightly claim review", desc: "Atlas scans open claims overnight and flags anomalies.", on: true },
                { label: "Send digest emails at 8:00 AM", desc: "Morning summary of everything Atlas noticed.", on: false },
              ].map((s) => (
                <label key={s.label} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                  </div>
                  <div className={`h-6 w-11 rounded-full relative transition ${s.on ? "bg-gradient-cyan" : "bg-white/10"}`}>
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${s.on ? "left-[22px]" : "left-0.5"}`} />
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
