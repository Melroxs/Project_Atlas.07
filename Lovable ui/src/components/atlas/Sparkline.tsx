import { cn } from "@/lib/utils";

type Tone = "cyan" | "purple" | "green" | "blue";

const TONE: Record<Tone, { stroke: string; fill: string; glow: string }> = {
  cyan: { stroke: "oklch(0.82 0.16 210)", fill: "oklch(0.82 0.16 210 / 0.25)", glow: "oklch(0.82 0.16 210 / 0.5)" },
  blue: { stroke: "oklch(0.66 0.19 260)", fill: "oklch(0.66 0.19 260 / 0.25)", glow: "oklch(0.66 0.19 260 / 0.5)" },
  purple: { stroke: "oklch(0.72 0.17 305)", fill: "oklch(0.72 0.17 305 / 0.25)", glow: "oklch(0.72 0.17 305 / 0.5)" },
  green: { stroke: "oklch(0.78 0.19 155)", fill: "oklch(0.78 0.19 155 / 0.25)", glow: "oklch(0.78 0.19 155 / 0.5)" },
};

export function Sparkline({
  data,
  tone = "cyan",
  className,
  height = 56,
}: {
  data: number[];
  tone?: Tone;
  className?: string;
  height?: number;
}) {
  const w = 300;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 8) - 4}`);
  const line = `M ${points.join(" L ")}`;
  const area = `${line} L ${w},${h} L 0,${h} Z`;
  const t = TONE[tone];
  const id = `spark-${tone}-${data.length}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("w-full", className)} style={{ height, filter: `drop-shadow(0 0 8px ${t.glow})` }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={t.fill} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={t.stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
