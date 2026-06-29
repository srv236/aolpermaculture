import {
  startOfDay, startOfWeek, startOfMonth, format, parseISO, isWithinInterval,
} from "date-fns";

export type HarvestRow = {
  id: string;
  harvest_date: string;
  quantity_harvested: number | null;
  quality_grade?: string | null;
  harvest_sequence_number?: number | null;
  estimated_remaining_yield?: number | null;
  plot_id?: string;
  crop_id?: string;
  variety_id?: string;
  plots?: { plot_number?: string | null } | null;
  crops?: { crop_name?: string | null; variety_name?: string | null; crop_category?: string | null } | null;
};

export type Granularity = "day" | "week" | "month";

export type Filters = {
  from?: Date;
  to?: Date;
  plotIds: string[]; // empty = all
  cropIds: string[]; // empty = all
  granularity: Granularity;
};

// Harvest rows reference the crop variety via `variety_id` (legacy field name);
// expose a single accessor so the rest of the analytics code is agnostic.
export function cropKey(r: HarvestRow): string | undefined {
  return r.crop_id ?? r.variety_id;
}


export function cropLabel(r: HarvestRow): string {
  const n = r.crops?.crop_name || "Unknown";
  const v = r.crops?.variety_name;
  return v && v !== n ? `${n} — ${v}` : n;
}

export function plotLabel(r: HarvestRow): string {
  return r.plots?.plot_number ? `Plot ${r.plots.plot_number}` : "Unassigned";
}

export function applyFilters(rows: HarvestRow[], f: Filters): HarvestRow[] {
  return rows.filter((r) => {
    if (!r.harvest_date) return false;
    const d = parseISO(r.harvest_date);
    if (f.from && f.to && !isWithinInterval(d, { start: f.from, end: f.to })) return false;
    if (f.from && !f.to && d < f.from) return false;
    if (f.to && !f.from && d > f.to) return false;
    if (f.plotIds.length && (!r.plot_id || !f.plotIds.includes(r.plot_id))) return false;
    if (f.cropIds.length) {
      const k = cropKey(r);
      if (!k || !f.cropIds.includes(k)) return false;
    }
    return true;
  });
}


function bucketStart(d: Date, g: Granularity): Date {
  if (g === "day") return startOfDay(d);
  if (g === "week") return startOfWeek(d, { weekStartsOn: 1 });
  return startOfMonth(d);
}

function bucketLabel(d: Date, g: Granularity): string {
  if (g === "day") return format(d, "dd MMM");
  if (g === "week") return format(d, "dd MMM");
  return format(d, "MMM yyyy");
}

// Stacked area: x = period, one key per top crop, "Other" aggregates the tail.
export function aggregateByPeriod(
  rows: HarvestRow[],
  g: Granularity,
  topN = 6,
): { data: Array<Record<string, number | string>>; cropKeys: string[] } {
  const cropTotals = new Map<string, number>();
  for (const r of rows) {
    const k = cropLabel(r);
    cropTotals.set(k, (cropTotals.get(k) || 0) + (r.quantity_harvested || 0));
  }
  const topCrops = [...cropTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k]) => k);
  const topSet = new Set(topCrops);
  const cropKeys = [...topCrops, ...(cropTotals.size > topN ? ["Other"] : [])];

  const buckets = new Map<number, Record<string, number | string>>();
  for (const r of rows) {
    const d = bucketStart(parseISO(r.harvest_date), g);
    const ts = d.getTime();
    let entry = buckets.get(ts);
    if (!entry) {
      entry = { _ts: ts, period: bucketLabel(d, g) };
      for (const k of cropKeys) entry[k] = 0;
      buckets.set(ts, entry);
    }
    const k = cropLabel(r);
    const bucketKey = topSet.has(k) ? k : "Other";
    entry[bucketKey] = ((entry[bucketKey] as number) || 0) + (r.quantity_harvested || 0);
  }
  const data = [...buckets.values()].sort((a, b) => (a._ts as number) - (b._ts as number));
  return { data, cropKeys };
}

export function topCrops(rows: HarvestRow[], n = 10) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = cropLabel(r);
    map.set(k, (map.get(k) || 0) + (r.quantity_harvested || 0));
  }
  return [...map.entries()]
    .map(([crop, kg]) => ({ crop, kg: +kg.toFixed(2) }))
    .sort((a, b) => b.kg - a.kg)
    .slice(0, n);
}

export function plotShare(rows: HarvestRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = plotLabel(r);
    map.set(k, (map.get(k) || 0) + (r.quantity_harvested || 0));
  }
  return [...map.entries()]
    .map(([plot, kg]) => ({ plot, kg: +kg.toFixed(2) }))
    .sort((a, b) => b.kg - a.kg);
}

// Crop × Month matrix for heatmap
export function monthlyMatrix(rows: HarvestRow[]) {
  const cropTotals = new Map<string, number>();
  const monthSet = new Set<number>();
  const cell = new Map<string, number>(); // "crop|ts" → kg
  for (const r of rows) {
    const d = startOfMonth(parseISO(r.harvest_date));
    const ts = d.getTime();
    const c = cropLabel(r);
    monthSet.add(ts);
    cropTotals.set(c, (cropTotals.get(c) || 0) + (r.quantity_harvested || 0));
    const key = `${c}|${ts}`;
    cell.set(key, (cell.get(key) || 0) + (r.quantity_harvested || 0));
  }
  const months = [...monthSet].sort((a, b) => a - b)
    .map((ts) => ({ ts, label: format(new Date(ts), "MMM ''yy") }));
  const crops = [...cropTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
  let max = 0;
  for (const v of cell.values()) if (v > max) max = v;
  return { months, crops, cell, max };
}

export function summaryStats(rows: HarvestRow[]) {
  const totalKg = rows.reduce((s, r) => s + (r.quantity_harvested || 0), 0);
  const crops = new Set(rows.map((r) => r.crop_id).filter(Boolean));
  const plots = new Set(rows.map((r) => r.plot_id).filter(Boolean));
  const events = rows.length;

  // top crop
  const ct = new Map<string, number>();
  for (const r of rows) {
    const k = cropLabel(r);
    ct.set(k, (ct.get(k) || 0) + (r.quantity_harvested || 0));
  }
  const top = [...ct.entries()].sort((a, b) => b[1] - a[1])[0];

  // best month
  const mt = new Map<string, number>();
  for (const r of rows) {
    if (!r.harvest_date) continue;
    const m = format(parseISO(r.harvest_date), "MMM yyyy");
    mt.set(m, (mt.get(m) || 0) + (r.quantity_harvested || 0));
  }
  const best = [...mt.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    totalKg,
    cropCount: crops.size,
    plotCount: plots.size,
    events,
    avgPerEvent: events ? totalKg / events : 0,
    topCrop: top ? { name: top[0], kg: top[1], pct: totalKg ? (top[1] / totalKg) * 100 : 0 } : null,
    bestMonth: best ? { label: best[0], kg: best[1] } : null,
  };
}

// Stable palette via crop-name hash → semantic-ish HSL anchored on earthy hues.
const PALETTE = [
  "hsl(95 40% 45%)",   // green
  "hsl(30 70% 50%)",   // orange
  "hsl(15 60% 50%)",   // terracotta
  "hsl(50 70% 50%)",   // mustard
  "hsl(150 35% 40%)",  // forest
  "hsl(355 55% 50%)",  // brick
  "hsl(200 40% 45%)",  // teal
  "hsl(280 30% 50%)",  // plum
  "hsl(75 45% 45%)",   // olive
  "hsl(0 0% 55%)",     // grey for Other
];

export function colorFor(key: string): string {
  if (key === "Other") return PALETTE[9];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % (PALETTE.length - 1)];
}

export function cropCategory(r: HarvestRow): string {
  return (r.crops?.crop_category || "other").toLowerCase();
}

// Per-crop stats over a row set (for top-crops bar tooltip).
export function perCropStats(rows: HarvestRow[]) {
  const total = rows.reduce((s, r) => s + (r.quantity_harvested || 0), 0);
  const m = new Map<string, { kg: number; events: number; plots: Set<string> }>();
  for (const r of rows) {
    const k = cropLabel(r);
    let e = m.get(k);
    if (!e) { e = { kg: 0, events: 0, plots: new Set() }; m.set(k, e); }
    e.kg += r.quantity_harvested || 0;
    e.events += 1;
    if (r.plot_id) e.plots.add(r.plot_id);
  }
  const out = new Map<string, { kg: number; events: number; plotCount: number; pct: number }>();
  for (const [k, v] of m) out.set(k, { kg: v.kg, events: v.events, plotCount: v.plots.size, pct: total ? (v.kg / total) * 100 : 0 });
  return out;
}

// Per-plot stats with top crops (for donut tooltip).
export function perPlotStats(rows: HarvestRow[]) {
  const total = rows.reduce((s, r) => s + (r.quantity_harvested || 0), 0);
  const m = new Map<string, { kg: number; events: number; crops: Map<string, number> }>();
  for (const r of rows) {
    const k = plotLabel(r);
    let e = m.get(k);
    if (!e) { e = { kg: 0, events: 0, crops: new Map() }; m.set(k, e); }
    e.kg += r.quantity_harvested || 0;
    e.events += 1;
    const ck = cropLabel(r);
    e.crops.set(ck, (e.crops.get(ck) || 0) + (r.quantity_harvested || 0));
  }
  const out = new Map<string, { kg: number; events: number; pct: number; topCrops: { name: string; kg: number; pct: number }[] }>();
  for (const [k, v] of m) {
    const topCropsArr = [...v.crops.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, kg]) => ({ name, kg, pct: v.kg ? (kg / v.kg) * 100 : 0 }));
    out.set(k, { kg: v.kg, events: v.events, pct: total ? (v.kg / total) * 100 : 0, topCrops: topCropsArr });
  }
  return out;
}

// Per-bucket stats keyed by period label (matches series.data items).
export function perBucketStats(
  rows: HarvestRow[],
  g: Granularity,
): Map<string, { kg: number; events: number; ts: number }> {
  const m = new Map<string, { kg: number; events: number; ts: number }>();
  for (const r of rows) {
    if (!r.harvest_date) continue;
    const d = bucketStart(parseISO(r.harvest_date), g);
    const label = bucketLabel(d, g);
    let e = m.get(label);
    if (!e) { e = { kg: 0, events: 0, ts: d.getTime() }; m.set(label, e); }
    e.kg += r.quantity_harvested || 0;
    e.events += 1;
  }
  return m;
}
