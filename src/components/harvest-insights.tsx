import { useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronDown, RotateCcw, Sprout, Leaf, MapPin, CalendarRange, Scale, BarChart3 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  applyFilters, aggregateByPeriod, topCrops, plotShare, monthlyMatrix,
  summaryStats, colorFor, cropLabel, plotLabel, cropKey, cropCategory,
  perCropStats, perPlotStats, perBucketStats,
  type HarvestRow, type Filters, type Granularity,
} from "@/lib/harvest-analytics";
import { TooltipCard, TooltipHeader, TooltipRow, Delta, fmtKg } from "@/components/insights-tooltip";
import { Input } from "@/components/ui/input";


type Preset = "30d" | "3m" | "ytd" | "12m" | "all";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "30d", label: "Last 30 days" },
  { id: "3m",  label: "Last 3 months" },
  { id: "ytd", label: "This year" },
  { id: "12m", label: "Last 12 months" },
  { id: "all", label: "All time" },
];

function rangeFromPreset(p: Preset, rows: HarvestRow[]): { from?: Date; to?: Date } {
  const now = new Date();
  switch (p) {
    case "30d": return { from: subMonths(now, 1), to: now };
    case "3m":  return { from: subMonths(now, 3), to: now };
    case "ytd": return { from: startOfYear(now), to: now };
    case "12m": return { from: subMonths(now, 12), to: now };
    case "all": {
      const dates = rows.map((r) => r.harvest_date).filter(Boolean).sort();
      return { from: dates.length ? parseISO(dates[0]) : undefined, to: now };
    }
  }
}

function autoGran(from?: Date, to?: Date): Granularity {
  if (!from || !to) return "month";
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function HarvestInsights({ rows }: { rows: HarvestRow[] }) {
  const [preset, setPreset] = useState<Preset>("all");
  const [granOverride, setGranOverride] = useState<Granularity | "auto">("auto");
  const [plotIds, setPlotIds] = useState<string[]>([]);
  const [cropIds, setCropIds] = useState<string[]>([]);
  const [year, setYear] = useState<string>("all");       // "all" or "2025"
  const [month, setMonth] = useState<string>("all");     // "all" or "1".."12"

  // Years derived from data, descending
  const years = useMemo(() => {
    const s = new Set<number>();
    for (const r of rows) if (r.harvest_date) s.add(parseISO(r.harvest_date).getFullYear());
    return [...s].sort((a, b) => b - a);
  }, [rows]);

  const { from, to } = useMemo(() => {
    if (year !== "all") {
      const y = Number(year);
      if (month !== "all") {
        const m = Number(month) - 1;
        const start = new Date(y, m, 1);
        return { from: startOfMonth(start), to: endOfMonth(start) };
      }
      const start = new Date(y, 0, 1);
      return { from: startOfYear(start), to: endOfYear(start) };
    }
    return rangeFromPreset(preset, rows);
  }, [preset, rows, year, month]);
  const granularity: Granularity = granOverride === "auto" ? autoGran(from, to) : granOverride;

  const filters: Filters = { from, to, plotIds, cropIds, granularity };
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, from, to, plotIds, cropIds]);

  const stats = useMemo(() => summaryStats(filtered), [filtered]);
  // When the user has picked specific crops, show each as its own area.
  const seriesTopN = cropIds.length > 0 ? Math.max(cropIds.length, 6) : 6;
  const series = useMemo(() => aggregateByPeriod(filtered, granularity, seriesTopN), [filtered, granularity, seriesTopN]);
  const top = useMemo(() => topCrops(filtered, 10), [filtered]);
  const plotsAgg = useMemo(() => plotShare(filtered), [filtered]);
  const matrix = useMemo(() => monthlyMatrix(filtered), [filtered]);

  const bucketStats = useMemo(() => perBucketStats(filtered, granularity), [filtered, granularity]);
  const cropStatsMap = useMemo(() => perCropStats(filtered), [filtered]);
  const plotStatsMap = useMemo(() => perPlotStats(filtered), [filtered]);
  const filteredTotalKg = useMemo(
    () => filtered.reduce((s, r) => s + (r.quantity_harvested || 0), 0),
    [filtered]
  );

  // option lists from full rows so filters always show every choice
  const plotOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.plot_id) m.set(r.plot_id, plotLabel(r));
    return [...m.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);
  const cropOptions = useMemo(() => {
    const m = new Map<string, { id: string; label: string; category: string }>();
    for (const r of rows) {
      const k = cropKey(r);
      if (k) m.set(k, { id: k, label: cropLabel(r), category: cropCategory(r) });
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  // Totals respecting date+plot filters but NOT current crop selection (so Top N can re-pick).
  const cropTotalsForRange = useMemo(() => {
    const base = applyFilters(rows, { ...filters, cropIds: [] });
    const m = new Map<string, number>();
    for (const r of base) {
      const k = cropKey(r);
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + (r.quantity_harvested || 0));
    }
    return m;
  }, [rows, from, to, plotIds]);

  const reset = () => {
    setPreset("all"); setGranOverride("auto"); setPlotIds([]); setCropIds([]);
    setYear("all"); setMonth("all");
  };
  const filtersActive = preset !== "all" || granOverride !== "auto"
    || plotIds.length || cropIds.length || year !== "all" || month !== "all";


  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        <BarChart3 className="size-8 mx-auto mb-3 opacity-50" />
        No harvest records yet. Add a few from the Records tab to see insights here.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-4 text-muted-foreground" />
            <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Select value={granOverride} onValueChange={(v) => setGranOverride(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto ({granularity})</SelectItem>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>

          <Select value={year} onValueChange={(v) => { setYear(v); if (v === "all") setMonth("all"); }}>
            <SelectTrigger className="w-[110px]"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={month} onValueChange={setMonth} disabled={year === "all"}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {MONTH_NAMES.map((n, i) => <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>


          <MultiSelect
            icon={<MapPin className="size-3.5" />}
            label="Plots"
            options={plotOptions}
            value={plotIds}
            onChange={setPlotIds}
          />
          <MultiSelect
            icon={<Sprout className="size-3.5" />}
            label="Crops"
            options={cropOptions}
            value={cropIds}
            onChange={setCropIds}
            groupByCategory
            topN={(n) => {
              const ranked = [...cropTotalsForRange.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, n)
                .map(([k]) => k);
              setCropIds(ranked);
            }}
          />


          {filtersActive ? (
            <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
              <RotateCcw className="size-3.5 mr-1" /> Reset
            </Button>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground mt-3">
          Showing {filtered.length} of {rows.length} records
          {from && to ? <> · {formatDate(from.toISOString())} – {formatDate(to.toISOString())}</> : null}
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat icon={<Scale className="size-4" />} label="Total harvest" value={`${stats.totalKg.toFixed(1)} kg`} />
        <Stat icon={<Sprout className="size-4" />} label="Crops" value={stats.cropCount} />
        <Stat icon={<MapPin className="size-4" />} label="Plots" value={stats.plotCount} />
        <Stat icon={<Leaf className="size-4" />} label="Top crop"
              value={stats.topCrop?.name || "—"}
              sub={stats.topCrop ? `${stats.topCrop.kg.toFixed(1)} kg · ${stats.topCrop.pct.toFixed(0)}%` : undefined} />
        <Stat icon={<CalendarRange className="size-4" />} label="Best month"
              value={stats.bestMonth?.label || "—"}
              sub={stats.bestMonth ? `${stats.bestMonth.kg.toFixed(1)} kg` : undefined} />
        <Stat icon={<BarChart3 className="size-4" />} label="Avg per event"
              value={`${stats.avgPerEvent.toFixed(1)} kg`}
              sub={`${stats.events} events`} />
      </div>

      {/* Time series */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-medium">Harvest over time</h3>
            <p className="text-xs text-muted-foreground">Kilograms per {granularity}, stacked by crop</p>
          </div>
        </div>
        <div className="h-[320px]">
          {series.data.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.data} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.3 }}
                  content={(props: any) => (
                    <TimeSeriesTooltip
                      {...props}
                      series={series.data}
                      bucketStats={bucketStats}
                    />
                  )}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {series.cropKeys.map((k) => (
                  <Area
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stackId="1"
                    stroke={colorFor(k)}
                    fill={colorFor(k)}
                    fillOpacity={0.7}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Top crops + Plot share */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-medium mb-1">Top crops</h3>
          <p className="text-xs text-muted-foreground mb-3">Click a bar to filter by that crop</p>
          <div className="h-[340px]">
            {top.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top} layout="vertical" margin={{ top: 5, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="crop" type="category" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => `${Number(v).toFixed(1)} kg`}
                  />
                  <Bar dataKey="kg" radius={[0, 4, 4, 0]} onClick={(d: any) => {
                    const opt = cropOptions.find((o) => o.label === d.crop);
                    if (opt) setCropIds([opt.id]);
                  }}>
                    {top.map((d) => <Cell key={d.crop} fill={colorFor(d.crop)} cursor="pointer" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-medium mb-1">Plot contribution</h3>
          <p className="text-xs text-muted-foreground mb-3">Click a slice to filter by that plot</p>
          <div className="h-[340px]">
            {plotsAgg.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={plotsAgg}
                    dataKey="kg"
                    nameKey="plot"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                    onClick={(d: any) => {
                      const opt = plotOptions.find((o) => o.label === d.plot);
                      if (opt) setPlotIds([opt.id]);
                    }}
                  >
                    {plotsAgg.map((d) => <Cell key={d.plot} fill={colorFor(d.plot)} cursor="pointer" />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any, n: any) => [`${Number(v).toFixed(1)} kg`, n]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="p-5">
        <h3 className="font-medium mb-1">Seasonality</h3>
        <p className="text-xs text-muted-foreground mb-3">Kilograms harvested per crop per month — darker is more</p>
        {matrix.crops.length === 0 || matrix.months.length === 0 ? <EmptyChart /> : (
          <div className="overflow-x-auto">
            <table className="text-xs border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left pr-3 font-normal text-muted-foreground sticky left-0 bg-card">Crop</th>
                  {matrix.months.map((m) => (
                    <th key={m.ts} className="font-normal text-muted-foreground px-1 whitespace-nowrap">{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.crops.map((c) => (
                  <tr key={c}>
                    <td className="pr-3 whitespace-nowrap sticky left-0 bg-card">{c}</td>
                    {matrix.months.map((m) => {
                      const v = matrix.cell.get(`${c}|${m.ts}`) || 0;
                      const intensity = matrix.max ? v / matrix.max : 0;
                      return (
                        <td key={m.ts}
                            title={v ? `${c} · ${format(new Date(m.ts), "MMM yyyy")} — ${v.toFixed(1)} kg` : "—"}
                            className="rounded w-10 h-7 text-center align-middle"
                            style={{
                              backgroundColor: v ? `hsl(95 45% ${Math.max(20, 85 - intensity * 60)}%)` : "hsl(var(--muted))",
                              color: intensity > 0.5 ? "white" : "hsl(var(--foreground))",
                            }}>
                          {v ? v.toFixed(0) : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1.5 text-lg font-medium truncate" title={typeof value === "string" ? value : undefined}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function EmptyChart() {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data for the current filters</div>;
}

type MultiOption = { id: string; label: string; category?: string };

function MultiSelect({
  icon, label, options, value, onChange, groupByCategory, topN,
}: {
  icon: React.ReactNode;
  label: string;
  options: MultiOption[];
  value: string[];
  onChange: (v: string[]) => void;
  groupByCategory?: boolean;
  topN?: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  const summary = value.length === 0 ? `All ${label.toLowerCase()}` : `${value.length} selected`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      o.label.toLowerCase().includes(q) || (o.category || "").toLowerCase().includes(q)
    );
  }, [options, query]);

  const groups = useMemo(() => {
    if (!groupByCategory) return null;
    const m = new Map<string, MultiOption[]>();
    for (const o of filtered) {
      const c = o.category || "other";
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push(o);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupByCategory]);

  const selectAllVisible = () => {
    const ids = new Set(value);
    for (const o of filtered) ids.add(o.id);
    onChange([...ids]);
  };
  const selectGroup = (opts: MultiOption[]) => {
    const ids = new Set(value);
    for (const o of opts) ids.add(o.id);
    onChange([...ids]);
  };

  const renderRow = (o: MultiOption) => {
    const sel = value.includes(o.id);
    return (
      <button
        key={o.id}
        onClick={() => toggle(o.id)}
        className={cn(
          "w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-accent",
          sel && "text-foreground",
        )}
      >
        <span className={cn(
          "size-4 rounded border flex items-center justify-center",
          sel ? "bg-primary border-primary text-primary-foreground" : "border-input",
        )}>
          {sel && <Check className="size-3" />}
        </span>
        <span className="truncate">{o.label}</span>
      </button>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          {icon}
          <span className="ml-1.5">{label}:</span>
          <span className="ml-1 text-muted-foreground">{summary}</span>
          <ChevronDown className="size-3.5 ml-1.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="h-8 text-sm"
          />
          <div className="flex items-center gap-1 flex-wrap">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={selectAllVisible}>
              Select all{query ? " (filtered)" : ""}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange([])}>
              Clear
            </Button>
            {topN && (
              <>
                <span className="mx-1 h-4 w-px bg-border" />
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => topN(5)}>Top 5</Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => topN(10)}>Top 10</Button>
              </>
            )}
          </div>
        </div>
        <div className="max-h-72 overflow-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
          ) : groups ? (
            groups.map(([cat, opts]) => (
              <div key={cat}>
                <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {cat} · {opts.length}
                  </span>
                  <button
                    onClick={() => selectGroup(opts)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Select all
                  </button>
                </div>
                {opts.map(renderRow)}
              </div>
            ))
          ) : (
            filtered.map(renderRow)
          )}
        </div>
        {value.length > 0 && (
          <div className="border-t p-2 flex items-center justify-between">
            <Badge variant="secondary">{value.length} selected</Badge>
            <Button variant="ghost" size="sm" onClick={() => onChange([])}>Clear all</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

