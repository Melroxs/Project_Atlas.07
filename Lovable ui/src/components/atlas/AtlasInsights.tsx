import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AtlasMark } from "./AtlasLogo";

export function AtlasInsights({
  title = "Atlas Insights",
  items,
  action,
  className,
}: {
  title?: string;
  items: { text: string; tone?: "cyan" | "purple" | "green" }[];
  action?: string;
  className?: string;
}) {
  return (
    <div className={cn("glass rounded-2xl p-5 relative overflow-hidden", className)}>
      <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-cyan opacity-20 blur-3xl pointer-events-none" />
      <div className="flex items-center gap-2 mb-4">
        <AtlasMark className="h-5 w-5" />
        <span className="text-[10px] tracking-[0.22em] uppercase text-cyan font-semibold">{title}</span>
        <Sparkles className="h-3 w-3 text-cyan/70 ml-auto" />
      </div>
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-foreground/90 leading-relaxed">
            <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
              it.tone === "purple" ? "bg-purple" : it.tone === "green" ? "bg-green" : "bg-cyan",
              "shadow-[0_0_8px_currentColor]")} />
            <span>{it.text}</span>
          </li>
        ))}
      </ul>
      {action && (
        <button className="mt-5 flex items-center gap-2 text-xs text-cyan hover:gap-3 transition-all">
          {action} <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
