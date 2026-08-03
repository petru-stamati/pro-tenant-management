import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  deltaTone = "up",
  onClick,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down";
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-[14px] border border-border bg-card p-[18px] pb-4 text-left shadow-sm before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary",
        onClick && "transition-shadow hover:shadow-md",
      )}
    >
      <div className="text-[11.5px] font-semibold tracking-[0.6px] text-muted-foreground uppercase">{label}</div>
      <div className="font-mono-tabular mt-2 mb-1 font-mono text-[25px] font-semibold">{value}</div>
      {delta && (
        <div className={cn("text-xs font-semibold", deltaTone === "up" ? "text-primary" : "text-destructive")}>
          {delta}
        </div>
      )}
    </Comp>
  );
}
