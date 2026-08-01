import { Bell, Search, ChevronDown } from "lucide-react";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-white/5 bg-background/60 backdrop-blur-xl flex items-center gap-4 px-6">
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          placeholder="Search claims, companies, documents..."
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.03] border border-white/5 text-sm placeholder:text-muted-foreground focus:border-cyan/40 focus:outline-none focus:ring-2 focus:ring-cyan/20 transition"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button className="h-9 w-9 grid place-items-center rounded-lg hover:bg-white/[0.04] text-muted-foreground hover:text-foreground transition">
          <Search className="h-4 w-4" />
        </button>
        <button className="relative h-9 w-9 grid place-items-center rounded-lg hover:bg-white/[0.04] text-muted-foreground hover:text-foreground transition">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-cyan shadow-[0_0_6px_oklch(0.82_0.16_210/0.8)]" />
        </button>
        <div className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition cursor-pointer">
          <div className="h-8 w-8 rounded-full bg-gradient-purple grid place-items-center text-[11px] font-semibold text-primary-foreground">MO</div>
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-xs font-medium">Melissa October</span>
            <span className="text-[10px] text-muted-foreground">NPP Roofing & Restor...</span>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}
