import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AtlasMark } from "@/components/atlas/AtlasLogo";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Project Atlas" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="min-h-screen relative overflow-hidden grid place-items-center px-4 py-10">
      {/* ambient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[720px] rounded-full bg-gradient-cyan opacity-25 blur-[120px]" />
        <div className="absolute bottom-0 -left-20 h-[420px] w-[520px] rounded-full bg-gradient-purple opacity-20 blur-[120px]" />
        <div className="absolute bottom-10 right-0 h-[380px] w-[420px] rounded-full bg-blue/20 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(oklch(1_0_0/0.5)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0/0.5)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5 animate-atlas-float">
            <div className="absolute inset-0 rounded-full bg-gradient-cyan opacity-40 blur-2xl" />
            <AtlasMark className="relative h-20 w-20" />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">
            <span className="text-foreground">Project </span>
            <span className="text-gradient">Atlas</span>
          </h1>
          <p className="mt-2 text-xs tracking-[0.24em] uppercase text-cyan/80">AI Operating System</p>
        </div>

        <div className="glass rounded-3xl p-8 relative">
          <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-cyan/60 to-transparent" />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/ask" });
            }}
            className="space-y-5"
          >
            <div>
              <label className="text-[11px] tracking-widest uppercase text-muted-foreground font-medium">Email</label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  defaultValue="melissa@npproofing.com"
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-white/[0.03] border border-white/10 text-sm placeholder:text-muted-foreground focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/20 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] tracking-widest uppercase text-muted-foreground font-medium">Password</label>
                <button type="button" className="text-[11px] text-cyan hover:text-cyan/80">Forgot password?</button>
              </div>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPw ? "text" : "password"}
                  defaultValue="••••••••••"
                  className="w-full h-11 pl-10 pr-10 rounded-lg bg-white/[0.03] border border-white/10 text-sm focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/20 transition"
                />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
              <input type="checkbox" defaultChecked className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-cyan" />
              Remember me for 30 days
            </label>

            <button
              type="submit"
              className="group relative w-full h-11 rounded-lg bg-gradient-cyan text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 overflow-hidden hover:opacity-95 transition"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative">Sign in to Atlas</span>
              <ArrowRight className="relative h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <div className="relative flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-white/10" />
              or
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => navigate({ to: "/ask" })}
              className="w-full h-11 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-sm font-medium flex items-center justify-center gap-2.5 transition"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.5l3.1-3C17.3 1.7 14.9 1 12 1 7.3 1 3.3 3.7 1.4 7.6L5 10.4C6 7.3 8.7 5 12 5z"/><path fill="#4285F4" d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.5h6.2c-.3 1.4-1.1 2.6-2.3 3.4l3.5 2.8c2-1.9 3.6-4.7 3.6-8.4z"/><path fill="#FBBC05" d="M5 13.6c-.3-.8-.4-1.6-.4-2.5 0-.9.2-1.7.4-2.5L1.4 5.7C.5 7.4 0 9.4 0 11.5s.5 4.1 1.4 5.8L5 13.6z"/><path fill="#34A853" d="M12 22c3 0 5.4-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-3.3 0-6-2.3-7-5.4L1.4 15c1.9 3.9 5.9 7 10.6 7z"/></svg>
              Continue with Google
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Protected by Atlas Security · SOC 2 · SSO · MFA
        </p>
      </div>
    </div>
  );
}
