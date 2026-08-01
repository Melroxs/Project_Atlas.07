import { Sparkline } from "./Sparkline";
import { cn } from "@/lib/utils";

type Tone = "cyan" | "purple" | "green" | "blue";

const VALUE_TONE: Record<Tone, string> = {
  cyan: "text-cyan",
  blue: "text-blue",
  purple: "text-purple",
  green: "text-green",
};

export function StatCard({
  label,
  value,
  data,
  tone = "cyan",
  hint,
  className,
}: {
  label: string;
  value: string;
  data: number[];
  tone?: Tone;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("glass rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden group hover:border-white/10 transition-all", className)}>
      <div className="flex items-start justify-between">
        <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase font-medium">{label}</p>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <p className={cn("text-4xl font-semibold tracking-tight", VALUE_TONE[tone])}>{value}</p>
      <Sparkline data={data} tone={tone} height={44} />
    </div>
  );
}
