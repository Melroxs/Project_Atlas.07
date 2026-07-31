import atlasMark from "@/assets/atlas-mark.png.asset.json";
import atlasLogo from "@/assets/atlas-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function AtlasMark({ className }: { className?: string }) {
  return <img src={atlasMark.url} alt="Atlas" className={cn("h-8 w-8 object-contain drop-shadow-[0_0_12px_oklch(0.82_0.16_210/0.6)]", className)} />;
}

export function AtlasWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <AtlasMark />
      <div className="flex flex-col leading-none">
        <span className="text-[13px] font-semibold tracking-[0.22em] text-foreground">ATLAS</span>
        <span className="text-[9px] tracking-[0.28em] text-cyan/80">INTELLIGENCE</span>
      </div>
    </div>
  );
}

export function AtlasFullLogo({ className }: { className?: string }) {
  return <img src={atlasLogo.url} alt="Project Atlas" className={cn("object-contain", className)} />;
}
