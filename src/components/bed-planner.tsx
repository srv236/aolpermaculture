// src/components/bed-planner.tsx
import React, { useState, useMemo } from 'react';
import {
  Sprout,
  Calendar,
  SlidersHorizontal,
  Layers,
  Plus,
  Trash2,
  Save,
  Droplets,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type SeasonalBedPlan,
  type BedZone,
  type BedZoneType,
  type PlannerCrop,
  DEFAULT_CROPS,
  DEFAULT_SEVEN_ZONES,
  POSTER_THREE_COL_ZONES,
  rebuildZonesForColumnCount,
  computeBedSummary,
  createDefaultSeasons,
} from '@/lib/seasonal-bed-engine';

export interface BedPlannerProps {
  [key: string]: any;
}

export function BedPlanner(props: BedPlannerProps) {
  const [seasons, setSeasons] = useState<Record<string, SeasonalBedPlan>>(() =>
    createDefaultSeasons()
  );
  const [activeSeasonKey, setActiveSeasonKey] = useState<string>('kharif');
  const [cropCatalog] = useState<PlannerCrop[]>(DEFAULT_CROPS);

  const activePlan = seasons[activeSeasonKey] || seasons.kharif;

  const updatePlan = (updater: (prev: SeasonalBedPlan) => SeasonalBedPlan) => {
    setSeasons((prev) => ({
      ...prev,
      [activeSeasonKey]: updater(prev[activeSeasonKey] || prev.kharif),
    }));
  };

  const cropById = useMemo(() => {
    const map: Record<string, PlannerCrop> = {};
    cropCatalog.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [cropCatalog]);

  const cropZones = useMemo(
    () => activePlan.zones.filter((z) => z.type === 'crop'),
    [activePlan.zones]
  );
  const borderZones = useMemo(
    () => activePlan.zones.filter((z) => z.type === 'border'),
    [activePlan.zones]
  );

  const summary = useMemo(() => computeBedSummary(activePlan), [activePlan]);

  // Adjust cycle length (number of rows in repeating cycle)
  const handleCycleRowsChange = (newCount: number) => {
    const count = Math.max(1, Math.min(30, newCount));
    updatePlan((prev) => {
      const nextRows = [...prev.cycleRows];
      if (count > nextRows.length) {
        for (let i = nextRows.length + 1; i <= count; i++) {
          nextRows.push({ rowIndex: i, mode: 'column', cells: {} });
        }
      } else {
        nextRows.length = count;
      }
      return { ...prev, cycleRowsCount: count, cycleRows: nextRows };
    });
  };

  // Add or remove zone in the adjustable cross-section
  const handleAddZone = (type: BedZoneType) => {
    const id = `z_${type}_${Date.now().toString().slice(-4)}`;
    const newZone: BedZone =
      type === 'pipe'
        ? { id, label: 'Pipe', type: 'pipe', widthFt: 0.1 }
        : type === 'border'
        ? { id, label: 'Border', type: 'border', widthFt: 0.25, borderCropId: 'radish', spacingInches: 12 }
        : { id, label: `Crop Col ${cropZones.length + 1}`, type: 'crop', widthFt: 1 };

    updatePlan((prev) => ({ ...prev, zones: [...prev.zones, newZone] }));
  };

  const handleMoveZone = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= activePlan.zones.length) return;
    updatePlan((prev) => {
      const copy = [...prev.zones];
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved);
      return { ...prev, zones: copy };
    });
  };

  const primaryBorderZone = borderZones[0];
  const primaryBorderCrop = primaryBorderZone?.borderCropId
    ? cropById[primaryBorderZone.borderCropId]
    : cropById['radish'];

  return (
    <div className="min-h-screen bg-[#f4f6f0] text-stone-800 flex flex-col">
      {/* TOP BAR: SEASON SELECTOR */}
      <div className="bg-[#123722] text-white px-5 py-3.5 border-b border-emerald-900 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-800 border border-emerald-500/40 flex items-center justify-center">
            <Sprout className="w-5 h-5 text-emerald-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight">
                Permaculture Seasonal Bed Planner
              </h1>
              <span className="text-[11px] bg-emerald-700/80 text-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-500/40 font-medium">
                Applies to all {activePlan.totalBedsInPlot} Beds in Plot
              </span>
            </div>
            <p className="text-xs text-emerald-200/80">
              {activePlan.zones.map((z) => z.label).join(' | ')}
            </p>
          </div>
        </div>

        {/* Season Switcher */}
        <div className="flex items-center gap-1.5 bg-[#0b2516] p-1 rounded-xl border border-emerald-800">
          {Object.values(seasons).map((s) => {
            const active = s.seasonKey === activeSeasonKey;
            return (
              <button
                key={s.seasonKey}
                type="button"
                onClick={() => setActiveSeasonKey(s.seasonKey)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-emerald-400 text-stone-950 shadow-2xs'
                    : 'text-emerald-100/80 hover:text-white hover:bg-white/5'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {s.seasonLabel}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            if (props.onSave) props.onSave(activePlan);
            toast.success(`Saved ${activePlan.seasonLabel} bed plan!`);
          }}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          Save Season Plan
        </button>
      </div>

      {/* MAIN SPLIT WORKSPACE */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 p-5 max-w-[1720px] w-full mx-auto items-start">
        
        {/* LEFT PANEL (5 COLS): ROW/COL PARAMETERS & 7-ZONE ANATOMY */}
        <div className="xl:col-span-5 space-y-4">
          
          {/* Card 1: Row, Column & Bed Dimensions */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#123722] flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Bed, Row & Column Parameters
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Bed Length (ft)</label>
                <input
                  type="number"
                  min={5}
                  value={activePlan.bedLengthFt}
                  onChange={(e) =>
                    updatePlan((p) => ({ ...p, bedLengthFt: Math.max(1, +e.target.value) }))
                  }
                  className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-600 mb-1">Bed Width (ft)</label>
                <input
                  type="number"
                  step="0.5"
                  min={1}
                  value={activePlan.bedWidthFt}
                  onChange={(e) =>
                    updatePlan((p) => ({ ...p, bedWidthFt: Math.max(0.5, +e.target.value) }))
                  }
                  className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-600 mb-1">Row Width (ft)</label>
                <input
                  type="number"
                  step="0.25"
                  min={0.25}
                  value={activePlan.rowWidthFt}
                  onChange={(e) =>
                    updatePlan((p) => ({ ...p, rowWidthFt: Math.max(0.25, +e.target.value) }))
                  }
                  className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-600 mb-1">Total Rows / Bed</label>
                <input
                  type="number"
                  min={1}
                  value={summary.totalRowsPerBed}
                  onChange={(e) => {
                    const rows = Math.max(1, +e.target.value);
                    updatePlan((p) => ({
                      ...p,
                      bedLengthFt: +(rows * p.rowWidthFt).toFixed(1),
                    }));
                  }}
                  className="w-full border border-stone-300 bg-stone-50 rounded-lg px-2.5 py-1.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-600 mb-1">Number of Cols</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={cropZones.length}
                  onChange={(e) => {
                    const count = +e.target.value;
                    updatePlan((p) => ({
                      ...p,
                      zones: rebuildZonesForColumnCount(p.zones, count, p.bedWidthFt),
                    }));
                  }}
                  className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-600 mb-1">Cycle Rows (N)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={activePlan.cycleRowsCount}
                  onChange={(e) => handleCycleRowsChange(+e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Adjustable 7-Zone Cross-Section */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#123722] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Adjustable Bed Cross-Section Layout
                </h3>
                <p className="text-[11px] text-stone-500">
                  Outer Border | Water Pipe | Left Crop | Pipe | Right Crop | Pipe | Right Border
                </p>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  updatePlan((p) => ({
                    ...p,
                    zones: DEFAULT_SEVEN_ZONES.map((z) => ({ ...z })),
                  }))
                }
                className="p-2 rounded-lg border border-emerald-600/40 bg-emerald-50/60 hover:bg-emerald-100/70 text-left text-xs cursor-pointer"
              >
                <div className="font-bold text-emerald-950">7-Zone Default</div>
                <div className="text-[10px] text-emerald-800">
                  Border | Pipe | Left | Pipe | Right | Pipe | Border
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  updatePlan((p) => ({
                    ...p,
                    zones: POSTER_THREE_COL_ZONES.map((z) => ({ ...z })),
                  }))
                }
                className="p-2 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 text-left text-xs cursor-pointer"
              >
                <div className="font-bold text-stone-800">3-Column Reference</div>
                <div className="text-[10px] text-stone-600">
                  Border | Col 1 | Drip | Col 2 | Drip | Col 3 | Border
                </div>
              </button>
            </div>

            {/* Zone List */}
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {activePlan.zones.map((zone, idx) => (
                <div
                  key={zone.id}
                  className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-stone-200 bg-stone-50/70 text-xs"
                >
                  <span className="font-mono text-[10px] font-bold text-stone-400 w-4">
                    {idx + 1}.
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                      zone.type === 'pipe'
                        ? 'bg-sky-100 text-sky-800'
                        : zone.type === 'border'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    {zone.type}
                  </span>

                  <input
                    type="text"
                    value={zone.label}
                    onChange={(e) =>
                      updatePlan((p) => ({
                        ...p,
                        zones: p.zones.map((z) =>
                          z.id === zone.id ? { ...z, label: e.target.value } : z
                        ),
                      }))
                    }
                    className="bg-white border border-stone-300 rounded px-2 py-1 font-semibold w-28"
                  />

                  {zone.type === 'crop' && (
                    <div className="flex items-center gap-1">
                      <span className="text-stone-500">Width:</span>
                      <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        value={zone.widthFt}
                        onChange={(e) =>
                          updatePlan((p) => ({
                            ...p,
                            zones: p.zones.map((z) =>
                              z.id === zone.id
                                ? { ...z, widthFt: Math.max(0.25, +e.target.value) }
                                : z
                            ),
                          }))
                        }
                        className="w-14 bg-white border border-stone-300 rounded px-1.5 py-1 text-center font-bold"
                      />
                      <span className="text-stone-500">ft</span>
                    </div>
                  )}

                  {zone.type === 'border' && (
                    <div className="flex items-center gap-1">
                      <select
                        value={zone.borderCropId || 'radish'}
                        onChange={(e) =>
                          updatePlan((p) => ({
                            ...p,
                            zones: p.zones.map((z) =>
                              z.id === zone.id ? { ...z, borderCropId: e.target.value } : z
                            ),
                          }))
                        }
                        className="bg-white border border-stone-300 rounded px-1.5 py-1 font-semibold"
                      >
                        {cropCatalog.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={2}
                        max={48}
                        value={zone.spacingInches || 12}
                        onChange={(e) =>
                          updatePlan((p) => ({
                            ...p,
                            zones: p.zones.map((z) =>
                              z.id === zone.id
                                ? { ...z, spacingInches: Math.max(1, +e.target.value) }
                                : z
                            ),
                          }))
                        }
                        className="w-11 bg-white border border-stone-300 rounded px-1 py-1 text-center font-bold"
                      />
                      <span className="text-stone-500">in</span>
                    </div>
                  )}

                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveZone(idx, -1)}
                      disabled={idx === 0}
                      className="px-1.5 py-0.5 rounded bg-white border border-stone-300 disabled:opacity-40 cursor-pointer"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveZone(idx, 1)}
                      disabled={idx === activePlan.zones.length - 1}
                      className="px-1.5 py-0.5 rounded bg-white border border-stone-300 disabled:opacity-40 cursor-pointer"
                    >
                      →
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updatePlan((p) => ({
                          ...p,
                          zones: p.zones.filter((z) => z.id !== zone.id),
                        }))
                      }
                      className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => handleAddZone('crop')}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-300 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Crop Col
              </button>
              <button
                type="button"
                onClick={() => handleAddZone('pipe')}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-sky-50 text-sky-900 border border-sky-300 cursor-pointer"
              >
                <Droplets className="w-3.5 h-3.5" /> Add Pipe
              </button>
              <button
                type="button"
                onClick={() => handleAddZone('border')}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-900 border border-rose-300 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Border
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL (7 COLS): LIVE BED LAYOUT VISUAL PREVIEW */}
        <div className="xl:col-span-7">
          <div className="bg-white rounded-2xl border-2 border-stone-300 shadow-sm p-6">
            <div className="border-2 border-stone-300 rounded-xl overflow-hidden bg-[#fafaf7]">
              <div className="bg-[#0f3d23] text-white text-center font-bold text-sm uppercase tracking-wider py-2.5 px-4">
                BED LAYOUT – ONE RAISED BED ({activePlan.bedLengthFt} ft × {activePlan.bedWidthFt} ft) — {activePlan.seasonLabel}
              </div>

              <div className="p-5">
                {/* Width & Column Width Arrows */}
                <div className="flex flex-col items-center mb-3">
                  <div className="flex items-center w-3/4 justify-center gap-2 text-xs font-bold text-stone-800">
                    <span className="flex-1 border-t border-stone-800 relative">
                      <span className="absolute -left-1 -top-1.5 text-[10px]">◀</span>
                    </span>
                    <span>{activePlan.bedWidthFt} ft (width)</span>
                    <span className="flex-1 border-t border-stone-800 relative">
                      <span className="absolute -right-1 -top-1.5 text-[10px]">▶</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-center w-3/4 mt-1 text-xs font-bold text-stone-700">
                    {cropZones.map((cz) => (
                      <div key={cz.id} className="flex-1 text-center">
                        ↔ {cz.label}: {cz.widthFt} ft
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cross-Section Anatomy Badges */}
                <div className="flex items-center justify-center gap-1 mb-4 flex-wrap">
                  {activePlan.zones.map((z, idx) => (
                    <React.Fragment key={z.id}>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          z.type === 'pipe'
                            ? 'bg-sky-100 text-sky-800 border border-sky-300'
                            : z.type === 'border'
                            ? 'bg-rose-100 text-rose-900 border border-rose-300'
                            : 'bg-stone-200 text-stone-800'
                        }`}
                      >
                        {z.label}
                      </span>
                      {idx < activePlan.zones.length - 1 && (
                        <span className="text-stone-400 text-xs">|</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* BED DIAGRAM WITH LEFT/RIGHT BORDERS & LENGTH CALLOUT */}
                <div className="flex items-stretch gap-2 max-w-xl mx-auto">
                  {/* Length Callout */}
                  <div className="w-12 flex flex-col items-center justify-between py-2 text-xs font-bold text-stone-800 select-none">
                    <span>▲</span>
                    <div className="flex-1 w-[1.5px] bg-stone-800 my-1" />
                    <div className="text-center leading-tight py-1">
                      <div className="text-sm font-extrabold">{activePlan.bedLengthFt} ft</div>
                      <div className="text-[10px] font-normal text-stone-600">(length)</div>
                    </div>
                    <div className="flex-1 w-[1.5px] bg-stone-800 my-1" />
                    <span>▼</span>
                  </div>

                  {/* Left Outer Border */}
                  {borderZones.length > 0 && (
                    <div className="w-7 flex flex-col items-center justify-around py-1 select-none">
                      {Array.from({ length: 14 }).map((_, i) => (
                        <span key={i} className="text-sm leading-none">
                          {primaryBorderCrop?.icon || '🌱'}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Raised Bed Frame */}
                  <div className="flex-1 border-[3px] border-[#5c3a21] rounded-xs bg-[#f5f3ef] overflow-hidden shadow-2xs">
                    {/* Top Cycle Rows (1..N) */}
                    {activePlan.cycleRows.map((row) => {
                      const contCrop = row.continuousCropId ? cropById[row.continuousCropId] : null;
                      return (
                        <div
                          key={`top_${row.rowIndex}`}
                          className="flex items-stretch border-b border-stone-400/80 min-h-[36px]"
                        >
                          <div className="w-9 shrink-0 bg-white border-r border-stone-400/80 flex items-center justify-center font-bold text-xs text-stone-800">
                            {row.rowIndex}
                          </div>

                          {row.mode === 'continuous' ? (
                            <div
                              style={{ backgroundColor: contCrop?.bgHex || '#cfe8b4' }}
                              className="flex-1 flex items-center justify-center gap-2 px-3 font-bold text-xs text-stone-900"
                            >
                              <span className="text-base">{contCrop?.icon || '🥬'}</span>
                              <span>{contCrop?.name || 'Palak / Spinach'}</span>
                            </div>
                          ) : (
                            <div className="flex-1 flex items-stretch">
                              {activePlan.zones
                                .filter((z) => z.type !== 'border')
                                .map((zone) => {
                                  if (zone.type === 'pipe') {
                                    return (
                                      <div
                                        key={zone.id}
                                        className="w-0 border-r-2 border-dashed border-sky-600"
                                        title={zone.label}
                                      />
                                    );
                                  }
                                  const cid = row.cells[zone.id];
                                  const cObj = cid ? cropById[cid] : null;
                                  return (
                                    <div
                                      key={zone.id}
                                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-xs font-semibold"
                                    >
                                      {cObj ? (
                                        <>
                                          <span className="text-base leading-none">{cObj.icon}</span>
                                          <span className="truncate">{cObj.name}</span>
                                        </>
                                      ) : (
                                        <span className="text-stone-400 font-bold">—</span>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Repeat Cycle Banner */}
                    {summary.showTailRows && (
                      <div className="bg-white py-3.5 px-4 border-b border-stone-400/80 text-center">
                        <div className="text-xs font-bold text-stone-700 mb-1">↑</div>
                        <div className="border-t border-b border-dashed border-stone-400 py-2">
                          <div className="font-extrabold text-sm text-stone-900">
                            Repeat this {activePlan.cycleRowsCount}-row cycle
                            <br />
                            along the full {activePlan.bedLengthFt}-ft bed (×{summary.repeatCycles})
                          </div>
                        </div>
                        <div className="text-xs font-bold text-stone-700 mt-1">↓</div>
                      </div>
                    )}

                    {/* Bottom Tail Rows (e.g., 93..100) */}
                    {summary.showTailRows &&
                      summary.tailRows.map((row) => {
                        const contCrop = row.continuousCropId ? cropById[row.continuousCropId] : null;
                        return (
                          <div
                            key={`tail_${row.actualRowNumber}`}
                            className="flex items-stretch border-b last:border-b-0 border-stone-400/80 min-h-[34px]"
                          >
                            <div className="w-9 shrink-0 bg-white border-r border-stone-400/80 flex items-center justify-center font-bold text-xs text-stone-800">
                              {row.actualRowNumber}
                            </div>

                            {row.mode === 'continuous' ? (
                              <div
                                style={{ backgroundColor: contCrop?.bgHex || '#cfe8b4' }}
                                className="flex-1 flex items-center justify-center gap-2 px-3 font-bold text-xs text-stone-900"
                              >
                                <span className="text-base">{contCrop?.icon || '🥬'}</span>
                                <span>{contCrop?.name || 'Palak / Spinach'}</span>
                              </div>
                            ) : (
                              <div className="flex-1 flex items-stretch">
                                {activePlan.zones
                                  .filter((z) => z.type !== 'border')
                                  .map((zone) => {
                                    if (zone.type === 'pipe') {
                                      return (
                                        <div
                                          key={zone.id}
                                          className="w-0 border-r-2 border-dashed border-sky-600"
                                        />
                                      );
                                    }
                                    const cid = row.cells[zone.id];
                                    const cObj = cid ? cropById[cid] : null;
                                    return (
                                      <div
                                        key={zone.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-xs font-semibold"
                                      >
                                        {cObj ? (
                                          <>
                                            <span className="text-base leading-none">{cObj.icon}</span>
                                            <span className="truncate">{cObj.name}</span>
                                          </>
                                        ) : (
                                          <span className="text-stone-400 font-bold">—</span>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* Right Outer Border */}
                  {borderZones.length > 1 && (
                    <div className="w-7 flex flex-col items-center justify-around py-1 select-none">
                      {Array.from({ length: 14 }).map((_, i) => (
                        <span key={i} className="text-sm leading-none">
                          {primaryBorderCrop?.icon || '🌱'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Border Planting Note */}
                {primaryBorderZone && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-stone-800">
                    <span className="text-base">{primaryBorderCrop?.icon || '🌱'}</span>
                    <span>
                      {primaryBorderCrop?.name || 'Radish'} planted along the outer border at{' '}
                      {primaryBorderZone.spacingInches || 12}-inch spacing (plant to plant).
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default BedPlanner;