import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atlas/PageHeader";
import { AtlasInsights } from "@/components/atlas/AtlasInsights";
import { StatusPill } from "@/components/atlas/StatusPill";
import { MapPin, Camera, Home, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/properties")({
  head: () => ({ meta: [{ title: "Properties — Atlas" }] }),
  component: PropertiesPage,
});

const PROPS = [
  { addr: "1245 Oakwood Dr", city: "Austin, TX", damage: "Storm", tone: "cyan" as const, inspections: 3, lat: "28%", lng: "42%" },
  { addr: "88 Beachside Ave", city: "Miami, FL", damage: "Hurricane", tone: "rose" as const, inspections: 5, lat: "62%", lng: "78%" },
  { addr: "902 Hillcrest Rd", city: "Denver, CO", damage: "Hail", tone: "purple" as const, inspections: 2, lat: "42%", lng: "34%" },
  { addr: "31 Willow Ct", city: "San Antonio, TX", damage: "Wind", tone: "amber" as const, inspections: 1, lat: "58%", lng: "44%" },
  { addr: "1400 Grove St", city: "Portland, OR", damage: "Wildfire", tone: "rose" as const, inspections: 4, lat: "22%", lng: "18%" },
  { addr: "220 Marina Blvd", city: "Tampa, FL", damage: "Storm", tone: "cyan" as const, inspections: 2, lat: "68%", lng: "72%" },
];

function PropertiesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Field"
        title="Properties"
        description="Every location Atlas is tracking, mapped and monitored."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass rounded-2xl overflow-hidden relative h-[420px]">
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse at 30% 30%, oklch(0.66 0.19 260 / 0.25), transparent 50%), radial-gradient(ellipse at 70% 70%, oklch(0.72 0.17 305 / 0.2), transparent 50%)",
          }} />
          <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(oklch(0.82_0.16_210)_1px,transparent_1px),linear-gradient(90deg,oklch(0.82_0.16_210)_1px,transparent_1px)] [background-size:48px_48px]" />
          {/* fake map continents */}
          <svg viewBox="0 0 100 60" className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="none">
            <path d="M10 30 Q 20 20 30 25 T 55 35 Q 65 40 75 30 T 90 25" stroke="oklch(0.82 0.16 210)" fill="none" strokeWidth="0.3" />
            <path d="M15 45 Q 30 40 45 48 T 80 42" stroke="oklch(0.66 0.19 260)" fill="none" strokeWidth="0.3" />
          </svg>
          {PROPS.map((p, i) => {
            const dot = { cyan: "bg-cyan text-cyan", purple: "bg-purple text-purple", rose: "bg-rose-400 text-rose-400", amber: "bg-amber-400 text-amber-400" }[p.tone];
            return (
              <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 group" style={{ left: p.lng, top: p.lat }}>
                <div className={`h-3 w-3 rounded-full shadow-[0_0_16px_currentColor] animate-atlas-pulse ${dot}`} />
                <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 glass rounded-lg px-3 py-2 text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                  <p className="font-medium">{p.addr}</p>
                  <p className="text-muted-foreground">{p.city}</p>
                </div>
              </div>
            );
          })}

          <div className="absolute top-4 left-4 glass rounded-lg px-3 py-2 flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-cyan" />
            <span className="text-xs">42 properties · 6 states</span>
          </div>
        </div>

        <AtlasInsights
          items={[
            { text: "Miami properties show 3x average damage severity this quarter.", tone: "purple" },
            { text: "Denver hail belt is trending — expect 4-6 new claims in next 10 days.", tone: "cyan" },
            { text: "5 properties need re-inspection based on new drone imagery.", tone: "green" },
          ]}
          action="Plan route"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROPS.map((p) => (
          <div key={p.addr} className="glass rounded-2xl overflow-hidden hover:border-cyan/20 transition cursor-pointer">
            <div className="h-32 relative bg-gradient-to-br from-white/[0.03] to-transparent">
              <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(135deg, oklch(0.24 0.038 264), oklch(0.16 0.03 260))` }} />
              <div className="absolute inset-0 grid place-items-center">
                <Home className="h-10 w-10 text-white/10" />
              </div>
              <div className="absolute top-3 left-3"><StatusPill tone={p.tone}><AlertTriangle className="h-2.5 w-2.5" /> {p.damage}</StatusPill></div>
              <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[11px] text-muted-foreground bg-black/40 backdrop-blur rounded-full px-2 py-0.5">
                <Camera className="h-3 w-3" /> {p.inspections}
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-medium">{p.addr}</p>
              <p className="text-xs text-muted-foreground">{p.city}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
