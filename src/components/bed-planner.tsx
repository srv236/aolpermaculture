import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  Download, FileImage, FileText, Plus, Minus, MoreVertical, Trash2, GripVertical, X, Paintbrush,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { BedConfig, BedRow } from "@/lib/bed-plan";
import { defaultBedConfig, iconForCrop, colorForCrop, strongColorForCrop, variantMarker } from "@/lib/bed-plan";


type Crop = {
  id: string;
  crop_name: string;
  variety_name: string | null;
  crop_category: string | null;
};

/** Emoji icon + a tiny colored letter badge so crops sharing an icon are still distinguishable. */
function CropIcon({
  crop,
  size = 14,
}: {
  crop?: Crop | null | undefined;
  size?: number;
}) {
  const icon = iconForCrop(crop as any);
  const m = variantMarker(crop as any);
  const badge = Math.max(9, Math.round(size * 0.6));
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

/** Popover with a searchable crop picker — used on any cell/row/border directly on the bed.
 * If `brushCropId` is provided, clicking applies it directly instead of opening the picker. */
function InlineCropPicker({
  crops, value, onChange, children, disabled, brushCropId,
}: {
  crops: Crop[];
  value: string | null;
  onChange: (id: string | null) => void;
  children: React.ReactNode;
  disabled?: boolean;
  brushCropId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (disabled) return <>{children}</>;
  if (brushCropId) {
    const isSame = value === brushCropId;
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); onChange(isSame ? null : brushCropId); }}
        className="w-full h-full block focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-crosshair"
        title={isSame ? "Click to clear" : "Click to sow"}
      >
        {children}
      </button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="w-full h-full block focus:outline-none focus:ring-2 focus:ring-emerald-400">
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-64" align="start">
        <Command>
          <CommandInput placeholder="Search crop…" />
          <CommandList>
            <CommandEmpty>No crop found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__ empty clear"
                onSelect={() => { onChange(null); setOpen(false); }}
              >
                <span className="text-muted-foreground">— clear —</span>
              </CommandItem>
              {crops.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.crop_name} ${c.variety_name ?? ""}`}
                  onSelect={() => { onChange(c.id); setOpen(false); }}
                >
                  <span
                    className="w-6 h-6 rounded flex items-center justify-center mr-2 shrink-0"
                    style={{ background: colorForCrop(c) }}
                  >
                    <CropIcon crop={c} size={14} />
                  </span>
                  <span className="truncate">
                    {c.crop_name}
                    {c.variety_name ? <span className="text-muted-foreground"> · {c.variety_name}</span> : null}
                  </span>
                  {value === c.id && <span className="ml-auto text-emerald-600">✓</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
  const scrollWrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [brushCropId, setBrushCropId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const brushCrop = brushCropId ? crops.find((c) => c.id === brushCropId) ?? null : null;


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

  function patch(p: Partial<BedConfig>) { onChange({ ...cfg, ...p }); }
  function patchCycle(p: Partial<BedConfig["cycle"]>) { patch({ cycle: { ...cfg.cycle, ...p } }); }
  function updateRow(idx: number, row: BedRow) {
    const rows = [...cfg.cycle.rows]; rows[idx] = row; patchCycle({ rows });
  }
  function deleteRow(idx: number) {
    const rows = cfg.cycle.rows.filter((_, i) => i !== idx);
    patchCycle({ rows: rows.length ? rows : [{ kind: "cells", cells: Array.from({ length: totalCols }, () => ({ cropId: null })) }] });
  }
  function insertRowAfter(idx: number) {
    const rows = [...cfg.cycle.rows];
    rows.splice(idx + 1, 0, { kind: "cells", cells: Array.from({ length: totalCols }, () => ({ cropId: null })) });
    patchCycle({ rows });
  }
  function setRowKind(idx: number, kind: BedRow["kind"]) {
    if (kind === "empty") updateRow(idx, { kind: "empty" });
    else if (kind === "full") updateRow(idx, { kind: "full", cropId: null });
    else updateRow(idx, { kind: "cells", cells: Array.from({ length: totalCols }, () => ({ cropId: null })) });
  }
  function setColumnCount(n: number) {
    n = Math.max(1, Math.min(12, n));
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
    const sum = cols.reduce((s, c) => s + c.widthFt, 0);
    patch({ columns: cols, cycle: { ...cfg.cycle, rows }, bedWidthFt: Number(sum.toFixed(2)) });
  }
  function setRowCount(n: number) {
    n = Math.max(1, Math.min(500, n));
    const cols = cfg.columns.length;
    const rows = [...cfg.cycle.rows];
    while (rows.length < n) rows.push({ kind: "cells", cells: Array.from({ length: cols }, () => ({ cropId: null })) });
    rows.length = n;
    patch({ cycle: { repeats: 1, rows } });
  }
  function setColumnWidths(widths: number[]) {
    const cols = widths.map((w) => ({ widthFt: Math.max(0.1, Number(w.toFixed(2))) }));
    const sum = cols.reduce((s, c) => s + c.widthFt, 0);
    patch({ columns: cols, bedWidthFt: Number(sum.toFixed(2)) });
  }
  function toggleDrip(gapIndex: number) {
    const has = cfg.dripLines.includes(gapIndex);
    patch({
      dripLines: has
        ? cfg.dripLines.filter((g) => g !== gapIndex)
        : [...cfg.dripLines, gapIndex].sort((a, b) => a - b),
    });
  }


  function buildFilename(ext: "png" | "pdf") {
    const safeName = (bedName || "Bed_Plan").trim().replace(/[^\w-]+/g, "_");
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return `${safeName}_Plan_${iso}.${ext}`;
  }

  async function exportImage(kind: "png" | "pdf") {
    if (!printRef.current) return;
    const el = printRef.current;
    const scaledParent = el.parentElement as HTMLElement | null;
    const scrollWrap = scrollWrapRef.current;

    // Snapshot styles we'll temporarily override.
    const prevTransform = scaledParent?.style.transform ?? "";
    const prevScrollStyles = scrollWrap
      ? {
          maxHeight: scrollWrap.style.maxHeight,
          overflow: scrollWrap.style.overflow,
          height: scrollWrap.style.height,
        }
      : null;

    try {
      toast.loading(`Preparing ${kind.toUpperCase()}…`, { id: "bed-export" });

      // 1) Enter clean export state (hides +/– controls, helper text, dropdown carets, etc).
      setIsExporting(true);

      // 2) Neutralise zoom transform and let the scroll container grow to fit.
      if (scaledParent) scaledParent.style.transform = "none";
      if (scrollWrap) {
        scrollWrap.style.maxHeight = "none";
        scrollWrap.style.overflow = "visible";
        scrollWrap.style.height = "auto";
      }

      // 3) Wait two animation frames so React commits + browser lays out.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      const { default: html2canvas } = await import("html2canvas-pro");

      // Cap total pixels so we don't exceed the browser's max canvas size
      // (~16k px per side; very tall bed layouts otherwise render blank).
      const naturalW = el.offsetWidth;
      const naturalH = el.offsetHeight;
      const maxSide = 14000;
      const captureScale = Math.min(2, maxSide / Math.max(naturalW, naturalH));

      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: captureScale,
        useCORS: true,
        logging: false,
        windowWidth: naturalW,
        windowHeight: naturalH,
      });

      if (kind === "png") {
        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = buildFilename("png");
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success("PNG downloaded", { id: "bed-export" });
      } else {
        // PDF: split the captured image across A4 pages so tall layouts stay readable.
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const imgW = pageW;
        const imgH = (canvas.height * pageW) / canvas.width;

        const dataUrl = canvas.toDataURL("image/png");
        let heightLeft = imgH;
        let position = 0;
        pdf.addImage(dataUrl, "PNG", 0, position, imgW, imgH);
        heightLeft -= pageH;
        while (heightLeft > 0) {
          position -= pageH;
          pdf.addPage();
          pdf.addImage(dataUrl, "PNG", 0, position, imgW, imgH);
          heightLeft -= pageH;
        }
        pdf.save(buildFilename("pdf"));
        toast.success("PDF downloaded", { id: "bed-export" });
      }
    } catch (e: any) {
      console.error("Bed export failed:", e);
      toast.error(`Export failed: ${e?.message ?? "unknown error"}`, { id: "bed-export" });
    } finally {
      // Always restore UI, scroll and transform state.
      if (scaledParent) scaledParent.style.transform = prevTransform;
      if (scrollWrap && prevScrollStyles) {
        scrollWrap.style.maxHeight = prevScrollStyles.maxHeight;
        scrollWrap.style.overflow = prevScrollStyles.overflow;
        scrollWrap.style.height = prevScrollStyles.height;
      }
      setIsExporting(false);
    }
  }



  const gapPercents = useMemo(() => {
    const total = cfg.columns.reduce((s, c) => s + c.widthFt, 0) || 1;
    const cum: number[] = [0];
    for (const c of cfg.columns) cum.push(cum[cum.length - 1] + (c.widthFt / total) * 100);
    return cum;
  }, [cfg.columns]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
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
          {!readOnly && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground mr-1">Tip: click any cell to pick a crop.</span>
            </div>
          )}
          {!readOnly && (
            <BrushSelector
              crops={crops}
              value={brushCropId}
              onChange={setBrushCropId}
            />
          )}
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

        <div className="border rounded-md bg-gradient-to-br from-emerald-50/40 to-amber-50/30 p-4 overflow-auto max-h-[80vh]">
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: "fit-content" }}>
            <div ref={printRef} className="bg-white p-8 rounded-md shadow-sm" style={{ width: 1100 }}>
              {/* Title bar */}
              <div className="flex items-center gap-3 pb-3 mb-4 border-b-2 border-emerald-800">
                <div className="w-11 h-11 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xl shrink-0">🌱</div>
                <div>
                  <div className="text-2xl font-serif font-bold text-emerald-800 leading-tight">
                    Vegetable Bed Plan — {bedName}
                  </div>
                  <div className="text-sm text-emerald-900/70">
                    {plotLabel ? `${plotLabel} · ` : ""}Layout, crop cycle, crop categories, and land summary
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
                {/* LEFT: Bed layout panel */}
                <div>
                  <SectionHeader>BED LAYOUT — ONE RAISED BED ({cfg.bedLengthFt} ft × {cfg.bedWidthFt.toFixed(2)} ft)</SectionHeader>
                  <div className="pt-4 pl-14 pr-14 pb-3">
                    {/* Width arrow + column labels */}
                    <div className="mb-1 flex items-center justify-center">
                      <div className="text-[11px] font-semibold text-emerald-900 tracking-wide">
                        ← {cfg.bedWidthFt.toFixed(2)} ft (width) →
                      </div>
                    </div>
                    <div className="flex">
                      {/* Length axis label */}
                      <div className="relative w-8 shrink-0 flex items-center justify-center">
                        <div
                          className="text-[11px] font-semibold text-emerald-900 whitespace-nowrap tracking-wide"
                          style={{ transform: "rotate(-90deg)" }}
                        >
                          ↑ {cfg.bedLengthFt} ft (length) ↓
                        </div>
                      </div>

                      <div className="relative flex-1">
                        {/* Border markers */}
                        {cfg.border.enabled && (
                          <BorderMarkers
                            length={Math.min(totalRows, 24)}
                            crop={cropById.get(cfg.border.cropId || "")}
                            onPick={readOnly ? undefined : (id) => patch({ border: { ...cfg.border, cropId: id } })}
                            crops={crops}
                          />
                        )}

                        <BedGrid
                          cfg={cfg}
                          cropById={cropById}
                          gapPercents={gapPercents}
                          crops={crops}
                          readOnly={!!readOnly}
                          totalRows={totalRows}
                          onSetRowCount={setRowCount}
                          onSetColumnWidths={setColumnWidths}
                          onCellChange={(rowIdx, colIdx, cropId) => {
                            const row = cfg.cycle.rows[rowIdx];
                            if (row?.kind !== "cells") return;
                            const cells = [...row.cells];
                            while (cells.length < totalCols) cells.push({ cropId: null });
                            cells[colIdx] = { cropId };
                            updateRow(rowIdx, { kind: "cells", cells });
                          }}
                          onFillRow={(rowIdx, cropId) => {
                            updateRow(rowIdx, {
                              kind: "cells",
                              cells: Array.from({ length: totalCols }, () => ({ cropId })),
                            });
                          }}
                          onFullChange={(rowIdx, cropId) => updateRow(rowIdx, { kind: "full", cropId })}
                          onRowKindChange={setRowKind}
                          onInsertRow={insertRowAfter}
                          onDeleteRow={deleteRow}
                          onToggleDrip={toggleDrip}
                          brushCropId={brushCropId}
                          onAddColumn={() => setColumnCount(cfg.columns.length + 1)}
                          onRemoveColumn={() => setColumnCount(cfg.columns.length - 1)}
                        />
                      </div>
                    </div>
                    {cfg.border.enabled && (
                      <div className="mt-3 text-center text-xs text-emerald-900/80 italic">
                        Border planting at {cfg.border.spacingIn}″ spacing (plant to plant).
                      </div>
                    )}
                  </div>

                  {/* Layout notes */}
                  <div className="mt-4">
                    <SectionHeader>LAYOUT NOTES</SectionHeader>
                    <ul className="p-4 text-sm text-emerald-950 space-y-1 list-disc pl-8">
                      <li>Bed divided into {cfg.columns.length} column{cfg.columns.length > 1 ? "s" : ""} ({cfg.columns.map((c) => `${c.widthFt.toFixed(2)} ft`).join(", ")}).</li>
                      <li>{totalRows} horizontal rows along the {cfg.bedLengthFt} ft length.</li>
                      <li>{cfg.dripLines.length} drip line{cfg.dripLines.length === 1 ? "" : "s"} through the bed.</li>
                      {cfg.border.enabled && (
                        <li>Border planted at {cfg.border.spacingIn}″ spacing along both outer edges.</li>
                      )}
                      <li>Full-width rows are sown continuously across the bed and not counted by columns.</li>
                    </ul>
                  </div>
                </div>

                {/* RIGHT: Legend + categories + summary */}
                <div className="space-y-4">
                  <div>
                    <SectionHeader>LEGEND</SectionHeader>
                    <div className="p-3 space-y-2 text-sm">
                      {usedCropIds.length === 0 && (
                        <div className="text-xs text-muted-foreground">No crops placed yet.</div>
                      )}
                      {usedCropIds.map((id) => {
                        const c = cropById.get(id);
                        if (!c) return null;
                        return (
                          <div key={id} className="flex items-center gap-3">
                            <span
                              className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                              style={{ background: colorForCrop(c), boxShadow: `inset 0 0 0 2px ${strongColorForCrop(c)}` }}
                            >
                              <CropIcon crop={c} size={20} />
                            </span>
                            <span className="font-semibold" style={{ color: strongColorForCrop(c) }}>
                              {c.crop_name}{c.variety_name ? ` (${c.variety_name})` : ""}
                            </span>
                            <span className="ml-auto text-xs text-emerald-900/70">
                              {c.crop_category ? `= ${c.crop_category}` : ""}
                            </span>
                          </div>
                        );
                      })}
                      {cfg.dripLines.length > 0 && (
                        <div className="flex items-center gap-3 pt-1">
                          <span className="inline-block w-9 h-[2px] border-t-2 border-dashed border-blue-500" />
                          <span className="font-semibold text-blue-700">Drip line</span>
                          <span className="ml-auto text-xs text-emerald-900/70">= vertical dashed line</span>
                        </div>
                      )}
                      {cfg.border.enabled && cfg.border.cropId && (
                        <div className="flex items-center gap-3">
                          <span
                            className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                            style={{
                              background: colorForCrop(cropById.get(cfg.border.cropId)),
                              boxShadow: `inset 0 0 0 2px ${strongColorForCrop(cropById.get(cfg.border.cropId))}`,
                            }}
                          >
                            <CropIcon crop={cropById.get(cfg.border.cropId)} size={20} />
                          </span>
                          <span className="font-semibold" style={{ color: strongColorForCrop(cropById.get(cfg.border.cropId)) }}>
                            {cropById.get(cfg.border.cropId)?.crop_name} border
                          </span>
                          <span className="ml-auto text-xs text-emerald-900/70">@ {cfg.border.spacingIn}″</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <SectionHeader>CROP CATEGORIES</SectionHeader>
                    <CategoryTable crops={crops} />
                  </div>

                  <div>
                    <SectionHeader>AREA &amp; LAND SUMMARY</SectionHeader>
                    <table className="w-full text-sm">
                      <tbody>
                        <SummaryRow label="Bed size" value={`${cfg.bedLengthFt} ft × ${cfg.bedWidthFt.toFixed(2)} ft = ${bedArea.toFixed(0)} sq ft`} />
                        <SummaryRow label="Total rows" value={String(totalRows)} />
                        <SummaryRow label="Columns" value={cfg.columns.map((c) => `${c.widthFt.toFixed(2)} ft`).join(" + ")} />
                        <SummaryRow label="Cycle" value={`${cfg.cycle.rows.length} rows × ${cfg.cycle.repeats}`} />
                        <SummaryRow label="Drip lines" value={String(cfg.dripLines.length)} />
                        {cfg.border.enabled && (
                          <SummaryRow label="Border spacing" value={`${cfg.border.spacingIn}″`} />
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* RIGHT: Controls (simplified — most editing happens on the bed) */}
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
              min={1} max={12} onChange={setColumnCount} />
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

          <Section title="Row cycle">
            <NumRow label="Repeat cycles (× N)" value={cfg.cycle.repeats}
              min={1} max={100} onChange={(v) => patchCycle({ repeats: v })} />
            <div className="text-xs text-muted-foreground">
              Cycle rows: {cfg.cycle.rows.length} · Total: {totalRows}
            </div>
            <div className="text-xs text-muted-foreground">
              Add/remove/change rows directly on the bed using the row menu.
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
              <NumRow label="Spacing (inches)" value={cfg.border.spacingIn}
                onChange={(v) => patch({ border: { ...cfg.border, spacingIn: v } })} />
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

/* ---------- bed preview rendering (interactive) ---------- */

type BedGridProps = {
  cfg: BedConfig;
  cropById: Map<string, Crop>;
  gapPercents: number[];
  crops: Crop[];
  readOnly: boolean;
  totalRows: number;
  onSetRowCount: (n: number) => void;
  onSetColumnWidths: (widths: number[]) => void;
  onCellChange: (rowIdx: number, colIdx: number, cropId: string | null) => void;
  onFillRow: (rowIdx: number, cropId: string | null) => void;
  onFullChange: (rowIdx: number, cropId: string | null) => void;
  onRowKindChange: (rowIdx: number, kind: BedRow["kind"]) => void;
  onInsertRow: (rowIdx: number) => void;
  onDeleteRow: (rowIdx: number) => void;
  onToggleDrip: (gapIndex: number) => void;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
  brushCropId: string | null;
};

function BedGrid(props: BedGridProps) {
  const { cfg, readOnly, onAddColumn, onRemoveColumn, onToggleDrip, totalRows, onSetRowCount, onSetColumnWidths } = props;
  // For huge beds show first cycle + collapse indicator + last cycle
  const cycleLen = cfg.cycle.rows.length;
  const showFullCycles = cfg.cycle.repeats <= 2;
  const visualRepeats = showFullCycles ? cfg.cycle.repeats : 1;
  const headerRef = useRef<HTMLDivElement>(null);
  const totalFt = cfg.columns.reduce((s, c) => s + c.widthFt, 0) || 1;

  const startDrag = useCallback((e: React.PointerEvent, i: number) => {
    if (readOnly) return;
    e.preventDefault();
    const el = headerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startWidths = cfg.columns.map((c) => c.widthFt);
    const ftPerPx = totalFt / rect.width;
    const min = 0.25;
    const move = (ev: PointerEvent) => {
      const dxFt = (ev.clientX - startX) * ftPerPx;
      const a = startWidths[i];
      const b = startWidths[i + 1];
      const newA = Math.max(min, Math.min(a + b - min, a + dxFt));
      const newB = a + b - newA;
      const widths = [...startWidths];
      widths[i] = newA;
      widths[i + 1] = newB;
      onSetColumnWidths(widths);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [cfg.columns, totalFt, onSetColumnWidths, readOnly]);

  return (
    <div>
      {/* Row / Column inline-editable strip */}
      <div className="flex items-center justify-between gap-3 mb-2 pl-10 flex-wrap">
        <div className="flex items-center gap-3 text-xs">
          <InlineNumEdit label="Rows" value={totalRows} min={1} max={500} onChange={onSetRowCount} disabled={readOnly} />
          <InlineNumEdit label="Columns" value={cfg.columns.length} min={1} max={12}
            onChange={(n) => {
              const diff = n - cfg.columns.length;
              if (diff > 0) for (let k = 0; k < diff; k++) onAddColumn();
              else for (let k = 0; k < -diff; k++) onRemoveColumn();
            }}
            disabled={readOnly}
          />
          <span className="text-muted-foreground">Bed: {cfg.bedLengthFt}ft × {totalFt.toFixed(2)}ft</span>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7" onClick={onRemoveColumn} disabled={cfg.columns.length <= 1}>
              <Minus className="size-3.5 mr-1" /> Column
            </Button>
            <Button size="sm" variant="outline" className="h-7" onClick={onAddColumn} disabled={cfg.columns.length >= 12}>
              <Plus className="size-3.5 mr-1" /> Column
            </Button>
          </div>
        )}
      </div>


      <div className="border-4 border-emerald-800 rounded-sm bg-white shadow-sm" style={{ width: 560 }}>
        {/* Column widths + drag handles + drip toggle */}
        <div className="flex items-stretch border-b border-emerald-800/30 bg-emerald-50/60">
          <div className="w-10 shrink-0 border-r border-emerald-800/30" />
          <div ref={headerRef} className="relative flex-1 h-8">
            {/* per-column width labels */}
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: cfg.columns.map((c) => `${c.widthFt}fr`).join(" ") }}
            >
              {cfg.columns.map((c, i) => (
                <div key={i} className="flex items-center justify-center text-[11px] font-medium text-emerald-900 border-r last:border-r-0 border-emerald-800/20">
                  {c.widthFt.toFixed(2)} ft
                </div>
              ))}
            </div>
            {/* drag handles between adjacent columns */}
            {!readOnly && cfg.columns.slice(0, -1).map((_, i) => {
              const leftPct = ((cfg.columns.slice(0, i + 1).reduce((s, c) => s + c.widthFt, 0)) / totalFt) * 100;
              return (
                <div
                  key={`h-${i}`}
                  onPointerDown={(e) => startDrag(e, i)}
                  className="absolute top-0 bottom-0 -translate-x-1/2 w-4 cursor-col-resize flex items-center justify-center group/handle z-30"
                  style={{ left: `${leftPct}%` }}
                  title="Drag to resize columns"
                >
                  <span className="w-[3px] h-6 rounded bg-emerald-700/60 group-hover/handle:bg-emerald-600 relative flex items-center justify-center">
                    <GripVertical className="absolute size-3.5 text-emerald-800 bg-white rounded-sm border border-emerald-700/50" />
                  </span>
                </div>
              );
            })}
            {/* drip line toggle dots (over gaps 0..N) */}
            {!readOnly && Array.from({ length: cfg.columns.length + 1 }).map((_, g) => {
              const on = cfg.dripLines.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => onToggleDrip(g)}
                  title={on ? "Remove drip line" : "Add drip line"}
                  className="absolute -translate-x-1/2 -top-1 flex items-center justify-center w-4 h-4 z-20"
                  style={{ left: `${props.gapPercents[g]}%` }}
                >
                  <span className={`inline-block w-2.5 h-2.5 rounded-full border ${on ? "bg-blue-500 border-blue-600" : "bg-white border-neutral-400"}`} />
                </button>
              );
            })}
          </div>
        </div>

        {Array.from({ length: visualRepeats }).map((_, rep) => (
          <div key={rep}>
            {cfg.cycle.rows.map((row, rowIdx) => (
              <RowRender
                key={`${rep}-${rowIdx}`}
                {...props}
                row={row}
                rowIdx={rowIdx}
                rowNumber={rep * cycleLen + rowIdx + 1}
                isTemplate={rep === 0}
              />
            ))}
          </div>
        ))}

        {!showFullCycles && (
          <>
            <div className="flex items-stretch border-b border-t border-emerald-800/40 bg-amber-50">
              <div className="w-10 shrink-0 border-r border-emerald-800/30 flex items-center justify-center text-xs">…</div>
              <div className="flex-1 py-2 text-center text-xs italic text-amber-900">
                ↕ Repeat this {cycleLen}-row cycle × {cfg.cycle.repeats}
              </div>
            </div>
            {cfg.cycle.rows.map((row, rowIdx) => (
              <RowRender
                key={`tail-${rowIdx}`}
                {...props}
                row={row}
                rowIdx={rowIdx}
                rowNumber={cycleLen * cfg.cycle.repeats - cycleLen + rowIdx + 1}
                isTemplate={false}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}


function RowRender({
  cfg, row, rowIdx, rowNumber, isTemplate,
  cropById, crops, gapPercents, readOnly, brushCropId,
  onCellChange, onFillRow, onFullChange, onRowKindChange, onInsertRow, onDeleteRow,
}: BedGridProps & {
  row: BedRow; rowIdx: number; rowNumber: number; isTemplate: boolean;
}) {
  const height = 52;
  const columns = cfg.columns.length;
  const editable = !readOnly && isTemplate;
  const gridTemplate = cfg.columns.map((c) => `${c.widthFt}fr`).join(" ");

  // Detect merged row (all cells same non-null crop) — render as spanning band.
  const mergedCropId =
    row.kind === "cells" &&
    row.cells.length >= columns &&
    row.cells.slice(0, columns).every((c) => c.cropId && c.cropId === row.cells[0].cropId)
      ? row.cells[0].cropId
      : null;

  return (
    <div className="relative flex items-stretch border-b last:border-b-0 border-emerald-800/40 group">
      <div className="w-10 shrink-0 text-[12px] text-emerald-900 flex items-center justify-center border-r border-emerald-800/30 bg-emerald-50 font-medium">
        {rowNumber}
      </div>
      <div className="relative flex-1" style={{ height }}>
        {/* drip lines */}
        {cfg.dripLines.map((g) => (
          <div
            key={g}
            className="absolute top-0 bottom-0 border-l-2 border-dashed border-blue-500 pointer-events-none z-10"
            style={{ left: `${gapPercents[g]}%` }}
          />
        ))}

        {row.kind === "empty" ? (
          <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#f5f5f4,#f5f5f4_6px,#e7e5e4_6px,#e7e5e4_12px)] flex items-center justify-center text-xs text-neutral-500">
            {editable ? "empty — click row menu to change" : "empty"}
          </div>
        ) : row.kind === "full" ? (
          (() => {
            const c = row.cropId ? cropById.get(row.cropId) : undefined;
            const content = (
              <div
                className="h-full w-full flex items-center justify-center text-sm gap-2 font-medium"
                style={{
                  background: colorForCrop(c),
                  boxShadow: c ? `inset 0 0 0 2px ${strongColorForCrop(c)}` : undefined,
                  color: c ? "#1c1917" : "#78716c",
                }}
              >
                <CropIcon crop={c} size={24} />
                {c ? c.crop_name : (editable ? "click to pick crop" : "—")}
              </div>
            );
            return editable ? (
              <InlineCropPicker crops={crops} value={row.cropId} onChange={(id) => onFullChange(rowIdx, id)} brushCropId={brushCropId}>
                {content}
              </InlineCropPicker>
            ) : content;
          })()
        ) : mergedCropId ? (
          (() => {
            const c = cropById.get(mergedCropId);
            const content = (
              <div
                className="h-full w-full flex items-center justify-center text-sm gap-2 font-medium"
                style={{
                  background: colorForCrop(c),
                  boxShadow: c ? `inset 0 0 0 2px ${strongColorForCrop(c)}` : undefined,
                  color: "#1c1917",
                }}
              >
                <CropIcon crop={c} size={24} />
                {c?.crop_name}
              </div>
            );
            return editable ? (
              <InlineCropPicker crops={crops} value={mergedCropId} onChange={(id) => onFillRow(rowIdx, id)} brushCropId={brushCropId}>
                {content}
              </InlineCropPicker>
            ) : content;
          })()
        ) : (
          <div className="h-full w-full grid" style={{ gridTemplateColumns: gridTemplate }}>
            {Array.from({ length: columns }).map((_, ci) => {
              const cell = row.cells[ci] ?? { cropId: null };
              const c = cell.cropId ? cropById.get(cell.cropId) : undefined;
              const inner = (
                <div
                  className="h-full w-full flex items-center justify-center border-r last:border-r-0 border-emerald-800/10 transition-colors"
                  style={{
                    background: colorForCrop(c),
                    boxShadow: c ? `inset 0 0 0 2px ${strongColorForCrop(c)}` : undefined,
                  }}
                >
                  {c ? <CropIcon crop={c} size={26} /> : <span className="text-neutral-400 text-lg">＋</span>}
                </div>
              );
              return (
                <div key={ci} className="h-full">
                  {editable ? (
                    <InlineCropPicker
                      crops={crops}
                      value={cell.cropId}
                      onChange={(id) => onCellChange(rowIdx, ci, id)}
                      brushCropId={brushCropId}
                    >
                      {inner}
                    </InlineCropPicker>
                  ) : inner}
                </div>
              );
            })}
          </div>
        )}
      </div>


      {editable && (
        <div className="absolute -right-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onRowKindChange(rowIdx, "cells")}>Per-column cells</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRowKindChange(rowIdx, "full")}>Full-width crop</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRowKindChange(rowIdx, "empty")}>Empty (path)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onInsertRow(rowIdx)}>
                <Plus className="size-4 mr-2" /> Insert row below
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteRow(rowIdx)} className="text-destructive">
                <Trash2 className="size-4 mr-2" /> Delete row
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

function BorderMarkers({
  length, crop, crops, onPick,
}: {
  length: number;
  crop?: Crop | undefined;
  crops: Crop[];
  onPick?: (id: string | null) => void;
}) {
  const marker = (
    <span className="text-lg leading-none">
      <CropIcon crop={crop} size={16} />
    </span>
  );
  const side = (pos: "left" | "right") => (
    <div className={`absolute ${pos === "left" ? "-left-7" : "-right-7"} top-0 bottom-0 flex flex-col justify-between py-1`}>
      {Array.from({ length }).map((_, i) => (
        onPick ? (
          <InlineCropPicker key={i} crops={crops} value={crop?.id ?? null} onChange={onPick}>
            {marker}
          </InlineCropPicker>
        ) : <span key={i}>{marker}</span>
      ))}
    </div>
  );
  return <>{side("left")}{side("right")}</>;
}

function InlineNumEdit({
  label, value, min, max, onChange, disabled,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const n = Number(draft);
    if (!Number.isNaN(n)) {
      const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, Math.round(n)));
      onChange(clamped);
    }
    setEditing(false);
  };
  if (editing && !disabled) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-emerald-900 font-medium">{label}</span>
        <Input
          autoFocus
          type="number"
          value={draft}
          min={min}
          max={max}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="h-6 w-16 text-xs px-2"
        />
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-800/30 bg-white hover:bg-emerald-100 text-emerald-900 disabled:opacity-70"
      title={disabled ? undefined : "Click to edit"}
    >
      <span className="font-medium">{label}:</span>
      <span className="tabular-nums">{value}</span>
    </button>
  );
}

function BrushSelector({
  crops, value, onChange,
}: {
  crops: Crop[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value ? crops.find((c) => c.id === value) : null;
  if (active) {
    return (
      <div className="inline-flex items-center gap-1.5 h-8 px-2 rounded-md border-2 border-emerald-600 bg-emerald-50 shadow-sm">
        <Paintbrush className="size-3.5 text-emerald-700" />
        <span
          className="w-5 h-5 rounded flex items-center justify-center"
          style={{ background: colorForCrop(active) }}
        >
          <CropIcon crop={active} size={12} />
        </span>
        <span className="text-xs font-medium text-emerald-900 max-w-[120px] truncate">
          {active.crop_name}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 rounded-sm hover:bg-emerald-200 p-0.5"
          title="Stop sowing"
        >
          <X className="size-3.5 text-emerald-800" />
        </button>
      </div>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          <Paintbrush className="size-3.5 mr-1.5" /> Sow crop…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-64" align="end">
        <Command>
          <CommandInput placeholder="Pick a crop to sow…" />
          <CommandList>
            <CommandEmpty>No crop found.</CommandEmpty>
            <CommandGroup>
              {crops.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.crop_name} ${c.variety_name ?? ""}`}
                  onSelect={() => { onChange(c.id); setOpen(false); }}
                >
                  <span
                    className="w-6 h-6 rounded flex items-center justify-center mr-2 shrink-0"
                    style={{ background: colorForCrop(c) }}
                  >
                    <CropIcon crop={c} size={14} />
                  </span>
                  <span className="truncate">
                    {c.crop_name}
                    {c.variety_name ? <span className="text-muted-foreground"> · {c.variety_name}</span> : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}



function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-emerald-800 text-white text-sm font-bold tracking-wide px-3 py-2 rounded-t-md text-center border-2 border-emerald-800">
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b last:border-b-0 border-emerald-800/20">
      <td className="py-1.5 px-3 text-emerald-900 font-medium">{label}</td>
      <td className="py-1.5 px-3 text-right text-emerald-950 tabular-nums">{value}</td>
    </tr>
  );
}

function CategoryTable({ crops }: { crops: Crop[] }) {
  const groups = new Map<string, Crop[]>();
  for (const c of crops) {
    const k = (c.crop_category || "Other").toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(c);
  }
  const order = ["greens", "ground", "creeper", "root", "fruit", "other"];
  const sorted = [...groups.entries()].sort(
    ([a], [b]) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)),
  );
  if (sorted.length === 0) {
    return <div className="p-3 text-xs text-muted-foreground">No crops defined.</div>;
  }
  return (
    <table className="w-full text-sm">
      <tbody>
        {sorted.map(([cat, list]) => {
          const sample = list[0];
          return (
            <tr key={cat} className="border-b last:border-b-0 border-emerald-800/20 align-top">
              <td className="py-2 px-2 w-12">
                <span
                  className="w-9 h-9 rounded-md flex items-center justify-center"
                  style={{ background: colorForCrop(sample) }}
                >
                  <CropIcon crop={sample} size={20} />
                </span>
              </td>
              <td className="py-2 px-2 font-semibold text-emerald-900 capitalize w-28">
                {cat === "ground" ? "Ground veg." : cat === "creeper" ? "Creepers" : cat === "root" ? "Root veg." : cat}
              </td>
              <td className="py-2 px-2 text-xs text-emerald-950">
                {list.map((c) => c.crop_name).join(", ")}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
