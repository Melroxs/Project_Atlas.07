import { cn } from "@/lib/utils";

const VARIANT = {
  cyan: "bg-cyan/10 text-cyan border-cyan/25",
  purple: "bg-purple/10 text-purple border-purple/25",
  green: "bg-green/10 text-green border-green/25",
  blue: "bg-blue/10 text-blue border-blue/25",
  amber: "bg-amber-400/10 text-amber-300 border-amber-400/25",
  rose: "bg-rose-500/10 text-rose-300 border-rose-500/25",
  muted: "bg-white/5 text-muted-foreground border-white/10",
} as const;

export function StatusPill({
  children,
  tone = "cyan",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof VARIANT;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide", VARIANT[tone], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]")} />
      {children}
    </span>
  );
}
