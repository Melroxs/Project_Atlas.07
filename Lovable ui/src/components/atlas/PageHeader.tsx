import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8", className)}>
      <div>
        {eyebrow && <p className="text-xs text-cyan tracking-[0.18em] uppercase mb-2 font-medium">{eyebrow}</p>}
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground max-w-xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
