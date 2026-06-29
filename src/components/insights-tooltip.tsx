import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtKg(n: number): string {
  return `${n.toFixed(1)} kg`;
}

export function Delta({ deltaKg, deltaPct }: { deltaKg: number; deltaPct: number | null }) {
  const Icon = deltaKg > 0 ? TrendingUp : deltaKg < 0 ? TrendingDown : Minus;
  const tone = deltaKg > 0 ? "text-emerald-600" : deltaKg < 0 ? "text-rose-600" : "text-muted-foreground";
  const pct = deltaPct == null ? "—" : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(0)}%`;
  const kg = `${deltaKg >= 0 ? "+" : ""}${deltaKg.toFixed(1)} kg`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", tone)}>
      <Icon className="size-3" />
      {kg} ({pct})
    </span>
  );
}

export function TooltipCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-popover text-popover-foreground shadow-md p-2.5 text-[12px] min-w-[200px] max-w-[280px]">
      {children}
    </div>
  );
}

export function TooltipHeader({
  title, subtitle,
}: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-1.5">
      <div className="font-medium">{title}</div>
      {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
    </div>
  );
}

export function TooltipRow({
  swatch, name, value, pct, deltaPct,
}: { swatch?: string; name: React.ReactNode; value?: React.ReactNode; pct?: number | null; deltaPct?: number | null }) {
  const dTone = deltaPct == null ? "text-muted-foreground"
    : deltaPct > 0 ? "text-emerald-600" : deltaPct < 0 ? "text-rose-600" : "text-muted-foreground";
  const dLabel = deltaPct == null ? "" : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(0)}%`;
  return (
    <div className="flex items-center gap-2 py-0.5">
      {swatch && <span className="size-2.5 rounded-sm shrink-0" style={{ background: swatch }} />}
      <span className="truncate flex-1">{name}</span>
      {value != null && <span className="tabular-nums text-muted-foreground">{value}</span>}
      {pct != null && <span className="tabular-nums text-[11px] text-muted-foreground w-9 text-right">{pct.toFixed(0)}%</span>}
      {deltaPct !== undefined && (
        <span className={cn("tabular-nums text-[11px] w-12 text-right", dTone)}>{dLabel || "—"}</span>
      )}
    </div>
  );
}

export { fmtKg };
