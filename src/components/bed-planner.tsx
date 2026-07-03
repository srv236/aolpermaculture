import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Download, FileImage, FileText } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { BedConfig, BedRow } from "@/lib/bed-plan";
import { defaultBedConfig, iconForCrop, colorForCrop, variantMarker } from "@/lib/bed-plan";

/** Emoji icon + a tiny colored letter badge so crops sharing an icon are still distinguishable. */
function CropIcon({
  crop,
  size = 14,
}: {
  crop?: { id?: string; crop_name?: string | null; variety_name?: string | null; crop_category?: string | null } | null;
  size?: number;
}) {
  const icon = iconForCrop(crop as any);
  const m = variantMarker(crop as any);
  const badge = Math.max(9, Math.round(size * 0.7));
  return (
    <span
      className="relative inline-flex items-center justify-center leading-none"
      style={{ fontSize: size, lineHeight: 1 }}
    >
      <span>{icon}</span>
      {crop && (
        <span
          className="absolute font-bold text-white rounded-full flex items-center justify-center ring-1 ring-white"
          style={{
            background: m.color,
            width: badge,
            height: badge,
            fontSize: Math.round(badge * 0.7),
            lineHeight: `${badge}px`,
            right: -Math.round(badge * 0.35),
            bottom: -Math.round(badge * 0.35),
          }}
        >
          {m.label}
        </span>
      )}
    </span>
  );
}

type Crop = {
  id: string;
  crop_name: string;
  variety_name: string | null;
  crop_category: string | null;
};

type Props = {
  value: BedConfig;
  onChange: (c: BedConfig) => void;
  crops: Crop[];
  bedName: string;
  plotLabel?: string;
  readOnly?: boolean;
};

export function BedPlanner({ value, onChange, crops, bedName, plotLabel, readOnly }: Props) {
  const cfg = value ?? defaultBedConfig();
  const printRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const cropById = useMemo(() => new Map(crops.map((c) => [c.id, c])), [crops]);
  const usedCropIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of cfg.cycle.rows) {
      if (r.kind === "full" && r.cropId) s.add(r.cropId);
      if (r.kind === "cells") for (const c of r.cells) if (c.cropId) s.add(c.cropId);
    }
    if (cfg.border.enabled && cfg.border.cropId) s.add(cfg.border.cropId);
    return [...s];
  }, [cfg]);

  const totalRows = cfg.cycle.rows.length * cfg.cycle.repeats;
  const totalCols = cfg.columns.length;
  const bedArea = cfg.bedLengthFt * cfg.bedWidthFt;

  function patch(p: Partial<BedConfig>) {
    onChange({ ...cfg, ...p });
  }
  function patchCycle(p: Partial<BedConfig["cycle"]>) {
    patch({ cycle: { ...cfg.cycle, ...p } });
  }
  function updateRow(idx: number, row: BedRow) {
    const rows = [...cfg.cycle.rows];
    rows[idx] = row;
    patchCycle({ rows });
  }
  function setRowCount(n: number) {
    const cur = cfg.cycle.rows;
    const rows: BedRow[] = [];
    for (let i = 0; i < n; i++) {
      rows.push(
        cur[i] ?? {
          kind: "cells",
          cells: Array.from({ length: totalCols }, () => ({ cropId: null })),
        },
      );
    }
    patchCycle({ rows });
  }
  function setColumnCount(n: number) {
    const cols = [...cfg.columns];
    while (cols.length < n) cols.push({ widthFt: 1 });
    cols.length = n;
    const rows = cfg.cycle.rows.map<BedRow>((r) => {
      if (r.kind !== "cells") return r;
      const cells = [...r.cells];
      while (cells.length < n) cells.push({ cropId: null });
      cells.length = n;
      return { kind: "cells", cells };
    });
    patch({ columns: cols, cycle: { ...cfg.cycle, rows } });
  }
  function toggleDrip(gapIndex: number) {
    const has = cfg.dripLines.includes(gapIndex);
    patch({
      dripLines: has
        ? cfg.dripLines.filter((g) => g !== gapIndex)
        : [...cfg.dripLines, gapIndex].sort((a, b) => a - b),
    });
  }

  async function exportImage(kind: "png" | "pdf") {
    if (!printRef.current) return;
    const { default: html2canvas } = await import("html2canvas-pro");
    const canvas = await html2canvas(printRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
    });
    const dataUrl = canvas.toDataURL("image/png");
    if (kind === "png") {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${bedName || "bed-plan"}.png`;
      a.click();
      return;
    }
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "pt",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(`${bedName || "bed-plan"}.pdf`);
  }

  const gapPercents = useMemo(() => {
    const total = cfg.columns.reduce((s, c) => s + c.widthFt, 0) || 1;
    const cum: number[] = [0];
    for (const c of cfg.columns) cum.push(cum[cum.length - 1] + (c.widthFt / total) * 100);
    return cum;
  }, [cfg.columns]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
      {/* LEFT: Preview */}
      <div className="space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Zoom</Label>
            <Input
              type="range" min={0.5} max={2} step={0.1} value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Download className="size-3.5 mr-1.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportImage("png")}>
                <FileImage className="size-4 mr-2" /> Save as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportImage("pdf")}>
                <FileText className="size-4 mr-2" /> Save as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="border rounded-md bg-muted/30 p-4 overflow-auto max-h-[75vh]">
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: "fit-content" }}>
            <div ref={printRef} className="bg-white p-8 rounded-md shadow-sm" style={{ width: 900 }}>
              <div className="text-center mb-3">
                <div className="text-lg font-serif font-semibold text-emerald-800">
                  Vegetable Bed Plan — {bedName}
                </div>
                {plotLabel && <div className="text-xs text-muted-foreground">{plotLabel}</div>}
                <div className="text-xs text-muted-foreground mt-1">
                  {cfg.bedLengthFt} ft × {cfg.bedWidthFt} ft &nbsp;·&nbsp;
                  {totalRows} rows &nbsp;·&nbsp; {totalCols} columns
                </div>
              </div>

              <div className="flex gap-6 justify-center">
                {/* Bed rendering */}
                <div className="relative">
                  {/* Border markers (radish) */}
                  {cfg.border.enabled && (
                    <BorderMarkers
                      length={Math.min(totalRows, 24)}
                      icon={iconForCrop(cropById.get(cfg.border.cropId || ""))}
                    />
                  )}

                  <BedGrid
                    cfg={cfg}
                    cropById={cropById}
                    gapPercents={gapPercents}
                  />
                </div>

                {/* Legend */}
                <div className="text-sm space-y-3 w-64 shrink-0">
                  <div className="font-semibold text-emerald-800 border-b pb-1.5 text-base">Legend</div>
                  {usedCropIds.map((id) => {
                    const c = cropById.get(id);
                    if (!c) return null;
                    return (
                      <div key={id} className="flex items-center gap-3">
                        <span
                          className="w-9 h-9 rounded flex items-center justify-center shrink-0"
                          style={{ background: colorForCrop(c) }}
                        >
                          <CropIcon crop={c} size={20} />
                        </span>
                        <span>
                          {c.crop_name}
                          {c.variety_name ? ` (${c.variety_name})` : ""}
                        </span>
                      </div>
                    );
                  })}
                  {cfg.dripLines.length > 0 && (
                    <div className="flex items-center gap-3 pt-1">
                      <span className="inline-block w-7 h-[2px] border-t-2 border-dashed border-blue-500" />
                      <span>Drip line</span>
                    </div>
                  )}
                  {cfg.border.enabled && (
                    <div className="flex items-center gap-3">
                      <span className="inline-flex w-9 h-9 items-center justify-center">
                        <CropIcon crop={cropById.get(cfg.border.cropId || "")} size={20} />
                      </span>
                      <span>Border @ {cfg.border.spacingIn}″</span>
                    </div>
                  )}

                  <div className="pt-3 border-t mt-2 text-xs text-muted-foreground space-y-1">
                    <div>Bed area: {bedArea} sq ft</div>
                    <div>Cycle: {cfg.cycle.rows.length} rows × {cfg.cycle.repeats}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Controls */}
      {!readOnly && (
        <div className="space-y-4 text-sm">
          <Section title="Bed dimensions">
            <NumRow label="Length (ft)" value={cfg.bedLengthFt}
              onChange={(v) => patch({ bedLengthFt: v })} />
            <NumRow label="Width (ft)" value={cfg.bedWidthFt}
              onChange={(v) => patch({ bedWidthFt: v })} />
          </Section>

          <Section title="Columns">
            <NumRow label="Number of columns" value={cfg.columns.length}
              min={1} max={10} onChange={setColumnCount} />
            <div className="space-y-1">
              {cfg.columns.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-muted-foreground">Col {i + 1}</span>
                  <Input
                    type="number" step="0.25" value={c.widthFt}
                    onChange={(e) => {
                      const cols = [...cfg.columns];
                      cols[i] = { widthFt: Number(e.target.value) };
                      patch({ columns: cols });
                    }}
                    className="h-8"
                  />
                  <span className="text-xs text-muted-foreground">ft</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Drip lines">
            <div className="text-xs text-muted-foreground">Toggle a drip line in each gap between columns.</div>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: cfg.columns.length + 1 }).map((_, i) => (
                <label key={i} className="flex items-center gap-1 border rounded px-2 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cfg.dripLines.includes(i)}
                    onChange={() => toggleDrip(i)}
                  />
                  <span className="text-xs">Gap {i}</span>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Row cycle">
            <NumRow label="Rows per cycle" value={cfg.cycle.rows.length}
              min={1} max={40} onChange={setRowCount} />
            <NumRow label="Repeat cycles (× N)" value={cfg.cycle.repeats}
              min={1} max={100} onChange={(v) => patchCycle({ repeats: v })} />
            <div className="text-xs text-muted-foreground">
              Total rows: {totalRows}
            </div>

            <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
              {cfg.cycle.rows.map((row, i) => (
                <RowEditor
                  key={i}
                  index={i}
                  row={row}
                  columns={cfg.columns.length}
                  crops={crops}
                  onChange={(r) => updateRow(i, r)}
                />
              ))}
            </div>
          </Section>

          <Section title="Border planting">
            <div className="flex items-center justify-between">
              <Label>Enable border</Label>
              <Switch
                checked={cfg.border.enabled}
                onCheckedChange={(v) => patch({ border: { ...cfg.border, enabled: v } })}
              />
            </div>
            {cfg.border.enabled && (
              <>
                <div>
                  <Label className="text-xs">Border crop</Label>
                  <CropSelect
                    crops={crops}
                    value={cfg.border.cropId}
                    onChange={(v) => patch({ border: { ...cfg.border, cropId: v } })}
                  />
                </div>
                <NumRow label="Spacing (inches)" value={cfg.border.spacingIn}
                  onChange={(v) => patch({ border: { ...cfg.border, spacingIn: v } })} />
              </>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

/* ---------- sub-components ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-md p-3 space-y-2 bg-card">
      <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function NumRow({
  label, value, onChange, min, max,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="flex-1 text-xs">{label}</Label>
      <Input
        type="number" value={value} min={min} max={max}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-8 w-24"
      />
    </div>
  );
}

function CropSelect({
  crops, value, onChange, placeholder = "Select crop",
}: { crops: Crop[]; value: string | null; onChange: (id: string | null) => void; placeholder?: string }) {
  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : v)}
    >
      <SelectTrigger className="h-8"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— none —</SelectItem>
        {crops.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {iconForCrop(c)} {c.crop_name}{c.variety_name ? ` · ${c.variety_name}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RowEditor({
  index, row, columns, crops, onChange,
}: {
  index: number;
  row: BedRow;
  columns: number;
  crops: Crop[];
  onChange: (r: BedRow) => void;
}) {
  return (
    <div className="border rounded p-2 space-y-2 bg-background">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium w-10">Row {index + 1}</span>
        <Select
          value={row.kind}
          onValueChange={(k) => {
            if (k === "empty") onChange({ kind: "empty" });
            else if (k === "full") onChange({ kind: "full", cropId: null });
            else onChange({ kind: "cells", cells: Array.from({ length: columns }, () => ({ cropId: null })) });
          }}
        >
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cells">Per column</SelectItem>
            <SelectItem value="full">Full width</SelectItem>
            <SelectItem value="empty">Empty</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {row.kind === "full" && (
        <CropSelect
          crops={crops}
          value={row.cropId}
          onChange={(id) => onChange({ kind: "full", cropId: id })}
        />
      )}
      {row.kind === "cells" && (
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
          {Array.from({ length: columns }).map((_, ci) => {
            const cell = row.cells[ci] ?? { cropId: null };
            return (
              <CropSelect
                key={ci}
                crops={crops}
                value={cell.cropId}
                onChange={(id) => {
                  const cells = [...row.cells];
                  while (cells.length < columns) cells.push({ cropId: null });
                  cells[ci] = { cropId: id };
                  onChange({ kind: "cells", cells });
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- bed preview rendering ---------- */

function BedGrid({
  cfg, cropById, gapPercents,
}: {
  cfg: BedConfig;
  cropById: Map<string, Crop>;
  gapPercents: number[];
}) {
  // Render all rows for a faithful preview but cap the visual to something sane.
  const allRows: (BedRow & { cycleIdx: number })[] = [];
  for (let r = 0; r < cfg.cycle.repeats; r++) {
    for (let i = 0; i < cfg.cycle.rows.length; i++) {
      allRows.push({ ...cfg.cycle.rows[i], cycleIdx: r });
    }
  }
  // For very tall beds, insert a "…" collapse in the middle so the export still fits nicely.
  const MAX_VISUAL = 26;
  let rowsToRender: (BedRow & { cycleIdx: number; label?: string; collapsed?: boolean })[] = allRows;
  if (allRows.length > MAX_VISUAL) {
    const head = allRows.slice(0, cfg.cycle.rows.length);
    const tail = allRows.slice(-cfg.cycle.rows.length);
    rowsToRender = [
      ...head,
      { kind: "empty", cycleIdx: -1, collapsed: true, label: `Repeat this ${cfg.cycle.rows.length}-row cycle × ${cfg.cycle.repeats}` },
      ...tail,
    ];
  }

  return (
    <div className="border-2 border-emerald-800 rounded-sm bg-white" style={{ width: 460 }}>
      {rowsToRender.map((row, i) => {
        const rowNum = row.collapsed
          ? "…"
          : row.cycleIdx * cfg.cycle.rows.length +
            (allRows.indexOf(row as any) - row.cycleIdx * cfg.cycle.rows.length) +
            1;
        return (
          <RowRender
            key={i}
            row={row}
            rowNumber={typeof rowNum === "number" ? computeRowNumber(cfg, i, rowsToRender.length) : rowNum}
            collapsedLabel={row.collapsed ? row.label : undefined}
            columns={cfg.columns.length}
            cropById={cropById}
            dripLines={cfg.dripLines}
            gapPercents={gapPercents}
          />
        );
      })}
    </div>
  );
}

function computeRowNumber(cfg: BedConfig, visualIdx: number, total: number) {
  const cycleLen = cfg.cycle.rows.length;
  const totalReal = cycleLen * cfg.cycle.repeats;
  if (total <= totalReal) return visualIdx + 1;
  // With collapse: first cycleLen are 1..cycleLen; then collapsed row; then tail = last cycleLen rows.
  if (visualIdx < cycleLen) return visualIdx + 1;
  if (visualIdx === cycleLen) return "…" as any;
  const tailPos = visualIdx - cycleLen - 1;
  return totalReal - cycleLen + tailPos + 1;
}

function RowRender({
  row, rowNumber, columns, cropById, dripLines, gapPercents, collapsedLabel,
}: {
  row: BedRow;
  rowNumber: number | string;
  columns: number;
  cropById: Map<string, Crop>;
  dripLines: number[];
  gapPercents: number[];
  collapsedLabel?: string;
}) {
  const height = 44;
  return (
    <div className="relative flex items-stretch border-b last:border-b-0 border-emerald-800/30">
      <div className="w-10 shrink-0 text-[12px] text-muted-foreground flex items-center justify-center border-r border-emerald-800/30 bg-emerald-50">
        {rowNumber}
      </div>
      <div className="relative flex-1" style={{ height }}>
        {/* drip lines overlay */}
        {dripLines.map((g) => (
          <div
            key={g}
            className="absolute top-0 bottom-0 border-l-2 border-dashed border-blue-500 pointer-events-none"
            style={{ left: `${gapPercents[g]}%` }}
          />
        ))}
        {collapsedLabel ? (
          <div className="h-full w-full flex items-center justify-center text-[10px] italic text-muted-foreground">
            ↕ {collapsedLabel}
          </div>
        ) : row.kind === "empty" ? (
          <div className="h-full w-full bg-neutral-100" />
        ) : row.kind === "full" ? (
          (() => {
            const c = row.cropId ? cropById.get(row.cropId) : undefined;
            return (
              <div className="h-full w-full flex items-center justify-center text-sm gap-2" style={{ background: colorForCrop(c) }}>
                <CropIcon crop={c} size={22} />
                {c ? `${c.crop_name}` : "—"}
              </div>
            );
          })()
        ) : (
          <div className="h-full w-full grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
            {row.cells.map((cell, ci) => {
              const c = cell.cropId ? cropById.get(cell.cropId) : undefined;
              return (
                <div key={ci} className="h-full flex items-center justify-center border-r last:border-r-0 border-emerald-800/10"
                  style={{ background: colorForCrop(c) }}>
                  {c ? <CropIcon crop={c} size={22} /> : <span className="text-muted-foreground text-base">—</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BorderMarkers({ length, icon }: { length: number; icon: string }) {
  // decorative left/right border markers
  return (
    <>
      <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-between py-1 pointer-events-none">
        {Array.from({ length }).map((_, i) => (
          <span key={i} className="text-base leading-none">{icon}</span>
        ))}
      </div>
      <div className="absolute -right-6 top-0 bottom-0 flex flex-col justify-between py-1 pointer-events-none">
        {Array.from({ length }).map((_, i) => (
          <span key={i} className="text-base leading-none">{icon}</span>
        ))}
      </div>
    </>
  );
}
