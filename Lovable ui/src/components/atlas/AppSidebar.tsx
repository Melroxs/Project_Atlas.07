import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sparkles, Building2, FileText, Home, FolderOpen, ClipboardCheck,
  Mic, CheckSquare, Calendar, BarChart3, Bell, Settings, User,
  ChevronDown, Search,
} from "lucide-react";
import { AtlasWordmark } from "./AtlasLogo";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/ask", label: "Ask Atlas", icon: Sparkles, badge: "AI" },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/claims", label: "Claims", icon: FileText },
  { to: "/properties", label: "Properties", icon: Home },
  { to: "/documents", label: "Documents", icon: FolderOpen },
  { to: "/supplements", label: "Supplements", icon: ClipboardCheck },
  { to: "/interviews", label: "Interviews", icon: Mic },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/notifications", label: "Notifications", icon: Bell, badge: "6" },
] as const;

const BOTTOM = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="hidden md:flex w-[260px] shrink-0 flex-col border-r border-white/5 bg-sidebar/60 backdrop-blur-xl">
      <div className="px-5 pt-6 pb-4">
        <AtlasWordmark />
      </div>
      <div className="px-4 mb-4">
        <button className="w-full flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground hover:border-white/10 transition">
          <Search className="h-3.5 w-3.5" /> Search Atlas...
          <span className="ml-auto text-[10px] rounded border border-white/10 px-1.5 py-0.5">⌘K</span>
        </button>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV.map((it) => {
          const active = pathname === it.to || pathname.startsWith(it.to + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                active
                  ? "bg-cyan/10 text-cyan"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]",
              )}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-cyan shadow-[0_0_10px_oklch(0.82_0.16_210/0.8)]" />}
              <Icon className={cn("h-4 w-4", active && "drop-shadow-[0_0_6px_oklch(0.82_0.16_210/0.7)]")} />
              <span className="flex-1">{it.label}</span>
              {"badge" in it && it.badge && (
                <span className={cn(
                  "text-[9px] tracking-wider px-1.5 py-0.5 rounded font-semibold",
                  it.badge === "AI" ? "bg-gradient-cyan text-primary-foreground" : "bg-white/10 text-foreground",
                )}>
                  {it.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-2 space-y-0.5 border-t border-white/5">
        {BOTTOM.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                active ? "bg-cyan/10 text-cyan" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]",
              )}
            >
              <Icon className="h-4 w-4" /> {it.label}
            </Link>
          );
        })}
      </div>
      <div className="mx-3 mb-4 mt-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-gradient-purple grid place-items-center text-[11px] font-semibold text-primary-foreground">NP</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">NPP Roofing & Restoration</p>
          <p className="text-[10px] text-muted-foreground">Company · Enterprise</p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </aside>
  );
}
