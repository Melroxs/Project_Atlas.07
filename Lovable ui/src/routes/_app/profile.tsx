import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atlas/PageHeader";
import { Mic, Bell, Shield, Palette } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — Atlas" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <>
      <PageHeader eyebrow="You" title="Profile" description="Personalize how Atlas talks to you, listens to you and looks for you." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 text-center">
          <div className="relative mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-purple opacity-40 blur-2xl" />
            <div className="relative mx-auto h-24 w-24 rounded-full bg-gradient-purple grid place-items-center text-2xl font-semibold text-primary-foreground">MO</div>
          </div>
          <h2 className="text-lg font-semibold">Melissa October</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Operations Lead · NPP Roofing & Restoration</p>
          <p className="text-[11px] text-cyan mt-3">Atlas Pro · Enterprise seat</p>
          <button className="mt-5 w-full h-9 rounded-lg border border-white/10 bg-white/[0.02] text-xs hover:bg-white/[0.05]">Change avatar</button>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold mb-4">Personal details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Full name", value: "Melissa October" },
                { label: "Email", value: "melissa@npproofing.com" },
                { label: "Phone", value: "+1 (512) 555-0138" },
                { label: "Role", value: "Operations Lead" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-[11px] tracking-widest uppercase text-muted-foreground font-medium">{f.label}</label>
                  <input defaultValue={f.value} className="mt-1.5 w-full h-10 px-3 rounded-lg bg-white/[0.02] border border-white/10 text-sm focus:border-cyan/40 focus:outline-none focus:ring-2 focus:ring-cyan/20" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: Palette, label: "Theme", value: "Atlas Dark", desc: "Cinematic dark palette" },
              { icon: Mic, label: "Voice", value: "Aurora · Warm", desc: "Voice used for Atlas replies" },
              { icon: Bell, label: "Notifications", value: "Everything", desc: "Adjust digest frequency and channels" },
              { icon: Shield, label: "Security", value: "MFA enabled", desc: "Managed via your SSO provider" },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="glass rounded-2xl p-5 flex items-start gap-4 hover:border-cyan/20 transition cursor-pointer">
                  <div className="h-10 w-10 rounded-xl bg-cyan/10 text-cyan grid place-items-center"><Icon className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">{c.label}</p>
                    <p className="text-sm font-medium mt-0.5">{c.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{c.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
