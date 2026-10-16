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
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// DATA MODELS & DEFAULTS
// ============================================================================

export type CropCategory = 'greens' | 'ground' | 'creeper' | 'root' | 'friendly';

export interface PlannerCrop {
  id: string;
  name: string;
  category: CropCategory;
  icon: string;
  bgHex: string;
  borderHex: string;
  textHex: string;
  plantingStyle: 'column' | 'continuous' | 'border';
}

export type BedZoneType = 'border' | 'pipe' | 'crop';

export interface BedZone {
  id: string;
  label: string;
  type: BedZoneType;
  widthFt: number;
  borderCropId?: string | null;
  spacingInches?: number;
}

export interface BedCycleRow {
  rowIndex: number;
  mode: 'column' | 'continuous' | 'empty';
  continuousCropId?: string | null;
  cells: Record<string, string | null>;
}

export interface SeasonalBedPlan {
  seasonKey: string;
  seasonLabel: string;
  plotTitle: string;
  landAcres: number;
  totalLandSqFt: number;
  totalBedsInPlot: number;
  pathwayWidthFt: number;
  bedLengthFt: number;
  bedWidthFt: number;
  rowWidthFt: number;
  cycleRowsCount: number;
  zones: BedZone[];
  cycleRows: BedCycleRow[];
}

// Your 7-Zone Farm Layout:
// outer border crop | water pipe | left crop | pipe | right crop | pipe | right border crop
export const DEFAULT_SEVEN_ZONES: BedZone[] = [
  { id: 'z_border_l', label: 'Outer Border', type: 'border', widthFt: 0.25, borderCropId: 'radish', spacingInches: 12 },
  { id: 'z_pipe_l', label: 'Water Pipe', type: 'pipe', widthFt: 0.1 },
  { id: 'z_crop_l', label: 'Left Crop', type: 'crop', widthFt: 1.5 },
  { id: 'z_pipe_m', label: 'Pipe', type: 'pipe', widthFt: 0.1 },
  { id: 'z_crop_r', label: 'Right Crop', type: 'crop', widthFt: 1.5 },
  { id: 'z_pipe_r', label: 'Pipe', type: 'pipe', widthFt: 0.1 },
  { id: 'z_border_r', label: 'Right Border', type: 'border', widthFt: 0.25, borderCropId: 'radish', spacingInches: 12 },
];

// Reference Image 3-Column Layout (3 cols × 1 ft + 2 drip lines + outer borders)
export const POSTER_THREE_COL_ZONES: BedZone[] = [
  { id: 'z_border_l', label: 'Outer Border', type: 'border', widthFt: 0.25, borderCropId: 'radish', spacingInches: 12 },
  { id: 'z_col_1', label: 'Col 1', type: 'crop', widthFt: 1 },
  { id: 'z_pipe_1', label: 'Drip Line 1', type: 'pipe', widthFt: 0.1 },
  { id: 'z_col_2', label: 'Col 2', type: 'crop', widthFt: 1 },
  { id: 'z_pipe_2', label: 'Drip Line 2', type: 'pipe', widthFt: 0.1 },
  { id: 'z_col_3', label: 'Col 3', type: 'crop', widthFt: 1 },
  { id: 'z_border_r', label: 'Right Border', type: 'border', widthFt: 0.25, borderCropId: 'radish', spacingInches: 12 },
];

export const DEFAULT_CROPS: PlannerCrop[] = [
  // Greens
  { id: 'palak', name: 'Palak / Spinach', category: 'greens', icon: '🥬', bgHex: '#cde5b3', borderHex: '#4d7c2b', textHex: '#14330e', plantingStyle: 'continuous' },
  { id: 'methi', name: 'Methi', category: 'greens', icon: '🌿', bgHex: '#d9f0c4', borderHex: '#3f7d20', textHex: '#193810', plantingStyle: 'continuous' },
  { id: 'coriander', name: 'Coriander', category: 'greens', icon: '🌱', bgHex: '#dcfce7', borderHex: '#16a34a', textHex: '#14532d', plantingStyle: 'continuous' },
  { id: 'amaranthus', name: 'Amaranthus', category: 'greens', icon: '🍃', bgHex: '#fce7f3', borderHex: '#db2777', textHex: '#831843', plantingStyle: 'continuous' },
  { id: 'gongura', name: 'Gongura', category: 'greens', icon: '☘️', bgHex: '#ecfccb', borderHex: '#65a30d', textHex: '#365314', plantingStyle: 'continuous' },

  // Ground Vegetables
  { id: 'tomato', name: 'Tomato', category: 'ground', icon: '🍅', bgHex: '#fee2e2', borderHex: '#dc2626', textHex: '#991b1b', plantingStyle: 'column' },
  { id: 'brinjal', name: 'Brinjal', category: 'ground', icon: '🍆', bgHex: '#f3e8ff', borderHex: '#9333ea', textHex: '#581c87', plantingStyle: 'column' },
  { id: 'okra', name: 'Okra', category: 'ground', icon: '🫑', bgHex: '#dcfce7', borderHex: '#15803d', textHex: '#14532d', plantingStyle: 'column' },
  { id: 'cluster_beans', name: 'Cluster beans', category: 'ground', icon: '🫛', bgHex: '#fef9c3', borderHex: '#ca8a04', textHex: '#713f12', plantingStyle: 'column' },
  { id: 'chilli', name: 'Chilli', category: 'ground', icon: '🌶️', bgHex: '#ffedd5', borderHex: '#ea580c', textHex: '#7c2d12', plantingStyle: 'column' },
  { id: 'cabbage', name: 'Cabbage', category: 'ground', icon: '🥬', bgHex: '#d1fae5', borderHex: '#059669', textHex: '#064e3b', plantingStyle: 'column' },

  // Creepers
  { id: 'snake_gourd', name: 'Snake gourd', category: 'creeper', icon: '🥒', bgHex: '#ecfccb', borderHex: '#4d7c0f', textHex: '#274006', plantingStyle: 'column' },
  { id: 'ash_gourd', name: 'Ash gourd', category: 'creeper', icon: '🍈', bgHex: '#e0f2fe', borderHex: '#0284c7', textHex: '#0c4a6e', plantingStyle: 'column' },
  { id: 'ridge_gourd', name: 'Ridge gourd', category: 'creeper', icon: '🥒', bgHex: '#d1fae5', borderHex: '#047857', textHex: '#064e3b', plantingStyle: 'column' },
  { id: 'bottle_gourd', name: 'Bottle gourd', category: 'creeper', icon: '🍐', bgHex: '#ecfccb', borderHex: '#65a30d', textHex: '#365314', plantingStyle: 'column' },
  { id: 'pumpkin', name: 'Pumpkin', category: 'creeper', icon: '🎃', bgHex: '#ffedd5', borderHex: '#d97706', textHex: '#78350f', plantingStyle: 'column' },

  // Root Vegetables
  { id: 'radish', name: 'Radish', category: 'root', icon: '🥕', bgHex: '#ffe4e6', borderHex: '#e11d48', textHex: '#881337', plantingStyle: 'border' },
  { id: 'carrot', name: 'Carrot', category: 'root', icon: '🥕', bgHex: '#ffedd5', borderHex: '#f97316', textHex: '#7c2d12', plantingStyle: 'border' },
  { id: 'beetroot', name: 'Beetroot', category: 'root', icon: '🫐', bgHex: '#fce7f3', borderHex: '#be185d', textHex: '#831843', plantingStyle: 'border' },
  { id: 'onion', name: 'Onion', category: 'root', icon: '🧅', bgHex: '#fef3c7', borderHex: '#b45309', textHex: '#78350f', plantingStyle: 'border' },
  { id: 'garlic', name: 'Garlic', category: 'root', icon: '🧄', bgHex: '#f5f5f4', borderHex: '#78716c', textHex: '#292524', plantingStyle: 'border' },

  // Friendly Crops
  { id: 'moringa', name: 'Moringa', category: 'friendly', icon: '🌳', bgHex: '#dcfce7', borderHex: '#15803d', textHex: '#14532d', plantingStyle: 'column' },
  { id: 'marigold', name: 'Marigold', category: 'friendly', icon: '🌼', bgHex: '#fef08a', borderHex: '#ca8a04', textHex: '#713f12', plantingStyle: 'column' },
  { id: 'mustard', name: 'Mustard', category: 'friendly', icon: '🌾', bgHex: '#fef9c3', borderHex: '#eab308', textHex: '#713f12', plantingStyle: 'column' },
  { id: 'pomegranate', name: 'Pomegranate', category: 'friendly', icon: '🍎', bgHex: '#fee2e2', borderHex: '#b91c1c', textHex: '#7f1d1d', plantingStyle: 'column' },
];

function rebuildZonesForColumnCount(
  currentZones: BedZone[],
  newColCount: number,
  bedWidthFt: number
): BedZone[] {
  const count = Math.max(1, Math.min(8, newColCount));
  const borders = currentZones.filter((z) => z.type === 'border');
  const leftBorder: BedZone = borders[0] || {
    id: 'z_border_l',
    label: 'Outer Border',
    type: 'border',
    widthFt: 0.25,
    borderCropId: 'radish',
    spacingInches: 12,
  };
  const rightBorder: BedZone = borders[1] || {
    id: 'z_border_r',
    label: 'Right Border',
    type: 'border',
    widthFt: 0.25,
    borderCropId: 'radish',
    spacingInches: 12,
  };

  const colWidth = +(bedWidthFt / count).toFixed(2);
  const middle: BedZone[] = [{ id: 'z_pipe_l', label: 'Water Pipe', type: 'pipe', widthFt: 0.1 }];

  for (let i = 1; i <= count; i++) {
    middle.push({
      id: `z_crop_${i}`,
      label: count === 2 ? (i === 1 ? 'Left Crop' : 'Right Crop') : `Col ${i}`,
      type: 'crop',
      widthFt: colWidth,
    });
    middle.push({
      id: `z_pipe_${i}`,
      label: i === count ? 'Pipe' : 'Pipe',
      type: 'pipe',
      widthFt: 0.1,
    });
  }

  return [leftBorder, ...middle, rightBorder];
}

function buildDefaultRowsForZones(zones: BedZone[], count = 8): BedCycleRow[] {
  const cropCols = zones.filter((z) => z.type === 'crop');
  const firstId = cropCols[0]?.id || 'z_crop_l';
  const lastId = cropCols[cropCols.length - 1]?.id || 'z_crop_r';
  const allSnake = Object.fromEntries(cropCols.map((c) => [c.id, 'snake_gourd']));

  const base: BedCycleRow[] = [
    { rowIndex: 1, mode: 'column', cells: { [firstId]: 'tomato', [lastId]: 'tomato' } },
    { rowIndex: 2, mode: 'continuous', continuousCropId: 'palak', cells: {} },
    { rowIndex: 3, mode: 'column', cells: allSnake },
    { rowIndex: 4, mode: 'continuous', continuousCropId: 'palak', cells: {} },
    { rowIndex: 5, mode: 'column', cells: { [firstId]: 'tomato', [lastId]: 'tomato' } },
    { rowIndex: 6, mode: 'continuous', continuousCropId: 'palak', cells: {} },
    { rowIndex: 7, mode: 'empty', cells: {} },
    { rowIndex: 8, mode: 'continuous', continuousCropId: 'palak', cells: {} },
  ];

  if (count <= base.length) return base.slice(0, count);
  const extra: BedCycleRow[] = [];
  for (let i = base.length + 1; i <= count; i++) {
    extra.push({ rowIndex: i, mode: 'column', cells: {} });
  }
  return [...base, ...extra];
}

function computeBedSummary(plan: SeasonalBedPlan) {
  const totalRowsPerBed = Math.max(1, Math.floor(plan.bedLengthFt / (plan.rowWidthFt || 1)));
  const repeatCycles = +(totalRowsPerBed / plan.cycleRowsCount).toFixed(1);
  const singleBedSqFt = +(plan.bedLengthFt * plan.bedWidthFt).toFixed(1);
  const totalBedSqFt = Math.round(singleBedSqFt * plan.totalBedsInPlot);
  const pathwayCount = plan.totalBedsInPlot + 1;
  const totalPathwaySqFt = Math.round(pathwayCount * plan.pathwayWidthFt * plan.bedLengthFt);
  const utilizedSqFt = totalBedSqFt + totalPathwaySqFt;
  const unutilizedSqFt = Math.max(0, plan.totalLandSqFt - utilizedSqFt);
  const hectares = +(plan.landAcres * 0.405).toFixed(3);

  const tailStartRow = Math.max(
    plan.cycleRowsCount + 1,
    totalRowsPerBed - plan.cycleRowsCount + 1
  );
  const tailRows = plan.cycleRows.map((r, i) => ({
    ...r,
    actualRowNumber: tailStartRow + i,
  }));

  return {
    totalRowsPerBed,
    repeatCycles,
    singleBedSqFt,
    totalBedSqFt,
    pathwayCount,
    totalPathwaySqFt,
    utilizedSqFt,
    unutilizedSqFt,
    hectares,
    tailRows,
    showTailRows: totalRowsPerBed > plan.cycleRowsCount,
  };
}

function createDefaultSeasons(): Record<string, SeasonalBedPlan> {
  const kharif: SeasonalBedPlan = {
    seasonKey: 'kharif',
    seasonLabel: 'Kharif (Monsoon)',
    plotTitle: 'Vegetable Bed Plan – Bed Layout & Land Details',
    landAcres: 1,
    totalLandSqFt: 43560,
    totalBedsInPlot: 80,
    pathwayWidthFt: 1.5,
    bedLengthFt: 100,
    bedWidthFt: 3,
    rowWidthFt: 1,
    cycleRowsCount: 8,
    zones: DEFAULT_SEVEN_ZONES,
    cycleRows: buildDefaultRowsForZones(DEFAULT_SEVEN_ZONES, 8),
  };

  return {
    kharif,
    rabi: {
      ...kharif,
      seasonKey: 'rabi',
      seasonLabel: 'Rabi (Winter)',
      plotTitle: 'Winter Vegetable Bed Plan – Bed Layout & Land Details',
      cycleRows: [
        { rowIndex: 1, mode: 'column', cells: { z_crop_l: 'tomato', z_crop_r: 'cluster_beans' } },
        { rowIndex: 2, mode: 'continuous', continuousCropId: 'methi', cells: {} },
        { rowIndex: 3, mode: 'column', cells: { z_crop_l: 'tomato', z_crop_r: 'marigold' } },
        { rowIndex: 4, mode: 'continuous', continuousCropId: 'coriander', cells: {} },
        { rowIndex: 5, mode: 'column', cells: { z_crop_l: 'tomato', z_crop_r: 'cluster_beans' } },
        { rowIndex: 6, mode: 'continuous', continuousCropId: 'palak', cells: {} },
        { rowIndex: 7, mode: 'column', cells: { z_crop_l: 'tomato', z_crop_r: 'onion' } },
        { rowIndex: 8, mode: 'continuous', continuousCropId: 'methi', cells: {} },
      ],
    },
    zaid: {
      ...kharif,
      seasonKey: 'zaid',
      seasonLabel: 'Zaid (Summer)',
      plotTitle: 'Summer Vegetable Bed Plan – Bed Layout & Land Details',
      cycleRows: [
        { rowIndex: 1, mode: 'column', cells: { z_crop_l: 'okra', z_crop_r: 'pumpkin' } },
        { rowIndex: 2, mode: 'continuous', continuousCropId: 'amaranthus', cells: {} },
        { rowIndex: 3, mode: 'column', cells: { z_crop_l: 'okra', z_crop_r: 'bottle_gourd' } },
        { rowIndex: 4, mode: 'continuous', continuousCropId: 'gongura', cells: {} },
        { rowIndex: 5, mode: 'column', cells: { z_crop_l: 'okra', z_crop_r: 'marigold' } },
        { rowIndex: 6, mode: 'continuous', continuousCropId: 'amaranthus', cells: {} },
        { rowIndex: 7, mode: 'empty', cells: {} },
        { rowIndex: 8, mode: 'continuous', continuousCropId: 'gongura', cells: {} },
      ],
    },
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface BedPlannerProps {
  [key: string]: any;
}

export function BedPlanner(props: BedPlannerProps) {
  const [seasons, setSeasons] = useState<Record<string, SeasonalBedPlan>>(() =>
    createDefaultSeasons()
  );
  const [activeSeasonKey, setActiveSeasonKey] = useState<string>('kharif');
  const [cropCatalog] = useState<PlannerCrop[]>(DEFAULT_CROPS);
  const [selectedBrushCropId, setSelectedBrushCropId] = useState<string>('tomato');
  const [leftSection, setLeftSection] = useState<'anatomy' | 'dimensions'>('anatomy');

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
  const pipeZones = useMemo(
    () => activePlan.zones.filter((z) => z.type === 'pipe'),
    [activePlan.zones]
  );

  const summary = useMemo(() => computeBedSummary(activePlan), [activePlan]);

  // Adjust cycle length
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

  // Click cell on the right-hand bed diagram to paint or clear
  const handleCellClick = (rowIndex: number, zoneId: string) => {
    const brushCrop = cropById[selectedBrushCropId];
    updatePlan((prev) => ({
      ...prev,
      cycleRows: prev.cycleRows.map((row) => {
        if (row.rowIndex !== rowIndex) return row;
        if (brushCrop?.plantingStyle === 'continuous') {
          return {
            ...row,
            mode: 'continuous',
            continuousCropId: brushCrop.id,
            cells: {},
          };
        }
        const current = row.cells[zoneId];
        const nextVal = current === selectedBrushCropId ? null : selectedBrushCropId;
        return {
          ...row,
          mode: 'column',
          continuousCropId: null,
          cells: { ...row.cells, [zoneId]: nextVal },
        };
      }),
    }));
  };

  // Click row number on the bed diagram to toggle Row Mode (Column <-> Continuous Spinach <-> Empty)
  const handleRowNumberClick = (rowIndex: number) => {
    updatePlan((prev) => ({
      ...prev,
      cycleRows: prev.cycleRows.map((row) => {
        if (row.rowIndex !== rowIndex) return row;
        if (row.mode === 'column') {
          return { ...row, mode: 'continuous', continuousCropId: 'palak', cells: {} };
        }
        if (row.mode === 'continuous') {
          return { ...row, mode: 'empty', continuousCropId: null, cells: {} };
        }
        return {
          ...row,
          mode: 'column',
          continuousCropId: null,
          cells: Object.fromEntries(cropZones.map((cz) => [cz.id, selectedBrushCropId])),
        };
      }),
    }));
  };

  const handleAddZone = (type: BedZoneType) => {
    const id = `z_${type}_${Date.now().toString().slice(-4)}`;
    const newZone: BedZone =
      type === 'pipe'
        ? { id, label: 'Pipe', type: 'pipe', widthFt: 0.1 }
        : type === 'border'
        ? { id, label: 'Border', type: 'border', widthFt: 0.25, borderCropId: 'radish', spacingInches: 12 }
        : { id, label: `Col ${cropZones.length + 1}`, type: 'crop', widthFt: 1 };

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
    <div className="w-full bg-[#f6f5ef] text-stone-800 p-4 md:p-6 rounded-2xl">
      {/* ====================================================================
          COMPACT TOP WORKSPACE BAR (Fits cleanly inside your app shell)
         ==================================================================== */}
      <div className="bg-white rounded-2xl border border-stone-200/90 px-5 py-3.5 mb-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#143d23] text-white flex items-center justify-center shadow-2xs">
            <Sprout className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[#143d23]">
                Seasonal Plot Bed Planner
              </h2>
              <span className="text-[11px] bg-emerald-50 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                All {activePlan.totalBedsInPlot} Beds Share This Seasonal Plan
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Select a season below • Adjust bed anatomy & dimensions on the left • Live poster preview on the right
            </p>
          </div>
        </div>

        {/* Season Pills */}
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl border border-stone-200">
          {Object.values(seasons).map((s) => {
            const active = s.seasonKey === activeSeasonKey;
            return (
              <button
                key={s.seasonKey}
                type="button"
                onClick={() => setActiveSeasonKey(s.seasonKey)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  active
                    ? 'bg-[#143d23] text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {s.seasonLabel}
              </button>
            );
          })}
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={() => {
            if (props.onSave) props.onSave(activePlan);
            toast.success(`Saved ${activePlan.seasonLabel} plan!`);
          }}
          className="flex items-center gap-1.5 bg-[#143d23] hover:bg-emerald-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xs transition cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          Save Season Plan
        </button>
      </div>

      {/* ====================================================================
          MAIN 2-COLUMN WORKSPACE:
          LEFT (4 COLS): CLEAN STUDIO CONTROLS
          RIGHT (8 COLS): AUTHENTIC REFERENCE POSTER SHEET
         ==================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* ==================================================================
            LEFT STUDIO SIDEBAR (4 COLS)
           ================================================================== */}
        <div className="xl:col-span-4 space-y-4">
          
          {/* Quick Crop Brush Picker (For clicking directly on the bed) */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#143d23]">
                Active Crop Brush (Click bed cells to sow)
              </span>
              <span className="text-[11px] text-stone-500">
                Click row # to toggle Spinach row
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {cropCatalog.map((crop) => {
                const active = selectedBrushCropId === crop.id;
                return (
                  <button
                    key={crop.id}
                    type="button"
                    onClick={() => setSelectedBrushCropId(crop.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left text-xs transition cursor-pointer ${
                      active
                        ? 'bg-emerald-50 border-2 border-[#143d23] font-bold text-stone-900'
                        : 'bg-stone-50/70 border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span className="text-base leading-none">{crop.icon}</span>
                    <span className="truncate">{crop.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggle between Cross-Section Anatomy & Dimensions */}
          <div className="grid grid-cols-2 gap-1.5 bg-stone-200/70 p-1 rounded-xl border border-stone-300/60">
            <button
              type="button"
              onClick={() => setLeftSection('anatomy')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                leftSection === 'anatomy'
                  ? 'bg-white text-[#143d23] shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              1. Bed Cross-Section
            </button>
            <button
              type="button"
              onClick={() => setLeftSection('dimensions')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                leftSection === 'dimensions'
                  ? 'bg-white text-[#143d23] shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              2. Rows, Cols & Land
            </button>
          </div>

          {leftSection === 'anatomy' ? (
            /* CARD A: ADJUSTABLE 7-ZONE CROSS SECTION */
            <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs space-y-3.5">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#143d23]">
                  Adjustable Bed Cross-Section
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Outer Border | Water Pipe | Left Crop | Pipe | Right Crop | Pipe | Right Border
                </p>
              </div>

              {/* 2 Layout Presets */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updatePlan((p) => ({
                      ...p,
                      zones: DEFAULT_SEVEN_ZONES.map((z) => ({ ...z })),
                      cycleRows: buildDefaultRowsForZones(DEFAULT_SEVEN_ZONES, p.cycleRowsCount),
                    }))
                  }
                  className="p-2.5 rounded-xl border border-emerald-600/40 bg-emerald-50/60 hover:bg-emerald-100/60 text-left text-xs transition cursor-pointer"
                >
                  <div className="font-bold text-emerald-950 flex items-center justify-between">
                    <span>7-Zone Farm Layout</span>
                    <RotateCcw className="w-3 h-3 text-emerald-700" />
                  </div>
                  <div className="text-[10px] text-emerald-800 mt-0.5">
                    Border | Pipe | Left | Pipe | Right | Pipe | Border
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updatePlan((p) => ({
                      ...p,
                      zones: POSTER_THREE_COL_ZONES.map((z) => ({ ...z })),
                      cycleRows: buildDefaultRowsForZones(POSTER_THREE_COL_ZONES, p.cycleRowsCount),
                    }))
                  }
                  className="p-2.5 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-left text-xs transition cursor-pointer"
                >
                  <div className="font-bold text-stone-800 flex items-center justify-between">
                    <span>3-Col Poster Layout</span>
                    <RotateCcw className="w-3 h-3 text-stone-500" />
                  </div>
                  <div className="text-[10px] text-stone-600 mt-0.5">
                    Border | Col 1 | Drip | Col 2 | Drip | Col 3 | Border
                  </div>
                </button>
              </div>

              {/* Zone Editor List */}
              <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                {activePlan.zones.map((zone, idx) => (
                  <div
                    key={zone.id}
                    className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-stone-200 bg-stone-50/70 text-xs"
                  >
                    <span className="font-mono text-[10px] font-bold text-stone-400 w-4">
                      {idx + 1}.
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                        zone.type === 'pipe'
                          ? 'bg-blue-100 text-blue-800'
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
                      className="bg-white border border-stone-300 rounded-md px-2 py-1 font-semibold w-24 text-xs"
                    />

                    {zone.type === 'crop' && (
                      <div className="flex items-center gap-1">
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
                          className="w-12 bg-white border border-stone-300 rounded-md px-1 py-1 text-center font-bold"
                        />
                        <span className="text-stone-500 text-[11px]">ft</span>
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
                          className="bg-white border border-stone-300 rounded-md px-1.5 py-1 font-semibold text-[11px]"
                        >
                          {cropCatalog.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icon} {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveZone(idx, -1)}
                        disabled={idx === 0}
                        className="px-1.5 py-0.5 rounded bg-white border border-stone-300 disabled:opacity-30 cursor-pointer"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveZone(idx, 1)}
                        disabled={idx === activePlan.zones.length - 1}
                        className="px-1.5 py-0.5 rounded bg-white border border-stone-300 disabled:opacity-30 cursor-pointer"
                      >
                        ↓
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

              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => handleAddZone('crop')}
                  className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-300 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Crop Col
                </button>
                <button
                  type="button"
                  onClick={() => handleAddZone('pipe')}
                  className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-300 cursor-pointer"
                >
                  <Droplets className="w-3.5 h-3.5" /> Water Pipe
                </button>
                <button
                  type="button"
                  onClick={() => handleAddZone('border')}
                  className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-900 border border-rose-300 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Border
                </button>
              </div>
            </div>
          ) : (
            /* CARD B: ROW WIDTH, NUM ROWS, COL WIDTH, NUM COLS & PLOT PARAMETERS */
            <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#143d23]">
                Row, Column & Plot Parameters
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
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
                  <label className="block font-semibold text-stone-600 mb-1">Number of Rows</label>
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
                      updatePlan((p) => {
                        const nextZones = rebuildZonesForColumnCount(p.zones, count, p.bedWidthFt);
                        return {
                          ...p,
                          zones: nextZones,
                          cycleRows: buildDefaultRowsForZones(nextZones, p.cycleRowsCount),
                        };
                      });
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

                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Total Beds in Plot</label>
                  <input
                    type="number"
                    min={1}
                    value={activePlan.totalBedsInPlot}
                    onChange={(e) =>
                      updatePlan((p) => ({ ...p, totalBedsInPlot: Math.max(1, +e.target.value) }))
                    }
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Pathway Width (ft)</label>
                  <input
                    type="number"
                    step="0.25"
                    min={0.5}
                    value={activePlan.pathwayWidthFt}
                    onChange={(e) =>
                      updatePlan((p) => ({ ...p, pathwayWidthFt: Math.max(0.5, +e.target.value) }))
                    }
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================
            RIGHT PANEL (8 COLS): AUTHENTIC 2-COLUMN PERMACULTURE POSTER SHEET
            Modeled directly on your reference image
           ================================================================== */}
        <div className="xl:col-span-8 overflow-x-auto">
          <div className="bg-white rounded-2xl border-2 border-stone-300 shadow-sm p-6 min-w-[760px] text-stone-900">
            
            {/* POSTER TOP BANNER */}
            <div className="flex items-center gap-4 border-b-2 border-[#143d23] pb-4 mb-5">
              <div className="w-14 h-14 rounded-full border-2 border-[#143d23] bg-emerald-50 flex items-center justify-center shrink-0">
                <Sprout className="w-8 h-8 text-[#143d23]" />
              </div>
              <div className="text-center flex-1">
                <h1 className="text-2xl font-extrabold text-[#143d23] tracking-tight">
                  {activePlan.plotTitle} ({activePlan.landAcres} Acre / {activePlan.totalBedsInPlot} Beds)
                </h1>
                <p className="text-sm font-semibold text-stone-700 mt-0.5">
                  Layout, crop cycle, crop categories, and land summary — <span className="text-[#143d23] font-bold">{activePlan.seasonLabel}</span>
                </p>
              </div>
            </div>

            {/* 2-COLUMN POSTER BODY */}
            <div className="grid grid-cols-12 gap-5 items-start">
              
              {/* ============================================================
                  POSTER LEFT COLUMN (6 COLS): RAISED BED + LAYOUT NOTES
                 ============================================================ */}
              <div className="col-span-6 space-y-4">
                <div className="border-2 border-stone-400 rounded-xl overflow-hidden bg-white">
                  <div className="bg-[#143d23] text-white text-center font-extrabold text-xs uppercase tracking-wider py-2 px-3">
                    BED LAYOUT – ONE RAISED BED ({activePlan.bedLengthFt} ft × {activePlan.bedWidthFt} ft)
                  </div>

                  <div className="p-4">
                    {/* Top Width & Column Width Arrows */}
                    <div className="pl-14 pr-6 mb-2">
                      <div className="flex items-center justify-center gap-2 text-xs font-extrabold text-stone-900">
                        <span className="flex-1 border-t-[1.5px] border-stone-800 relative">
                          <span className="absolute -left-1 -top-2 text-[10px]">◀</span>
                        </span>
                        <span>{activePlan.bedWidthFt} ft (width)</span>
                        <span className="flex-1 border-t-[1.5px] border-stone-800 relative">
                          <span className="absolute -right-1 -top-2 text-[10px]">▶</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1.5 text-xs font-extrabold text-stone-800">
                        {cropZones.map((cz) => (
                          <div key={cz.id} className="flex-1 flex items-center justify-center gap-1 px-1">
                            <span className="text-[9px]">◀</span>
                            <span className="border-b border-stone-800 px-1">{cz.widthFt} ft</span>
                            <span className="text-[9px]">▶</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cross-Section Zone Header Pills */}
                    <div className="pl-10 pr-2 mb-2.5 flex items-center justify-center gap-1 flex-wrap">
                      {activePlan.zones.map((z, i) => (
                        <React.Fragment key={z.id}>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              z.type === 'pipe'
                                ? 'bg-blue-50 text-blue-700 border border-blue-300'
                                : z.type === 'border'
                                ? 'bg-rose-50 text-rose-800 border border-rose-300'
                                : 'bg-stone-100 text-stone-800 border border-stone-300'
                            }`}
                          >
                            {z.label}
                          </span>
                          {i < activePlan.zones.length - 1 && (
                            <span className="text-stone-300 text-[10px]">|</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* BED DIAGRAM WITH LENGTH ARROW & OUTER BORDERS */}
                    <div className="flex items-stretch gap-1">
                      {/* Left 100 ft Length Callout */}
                      <div className="w-11 flex flex-col items-center justify-between py-1 text-xs font-extrabold text-stone-900 select-none">
                        <span>▲</span>
                        <div className="flex-1 w-[1.5px] bg-stone-800 my-1" />
                        <div className="text-center leading-tight py-1">
                          <div className="text-sm font-black">{activePlan.bedLengthFt} ft</div>
                          <div className="text-[10px] font-semibold text-stone-700">(length)</div>
                        </div>
                        <div className="flex-1 w-[1.5px] bg-stone-800 my-1" />
                        <span>▼</span>
                      </div>

                      {/* Left Outer Border Crop Icons */}
                      {borderZones.length > 0 && (
                        <div className="w-6 flex flex-col items-center justify-between py-1 select-none">
                          {Array.from({ length: 15 }).map((_, i) => (
                            <div key={i} className="flex flex-col items-center leading-none">
                              <span className="text-[9px] text-emerald-700">🌿</span>
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-rose-800 -mt-0.5" />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Brown Raised Bed Frame */}
                      <div className="flex-1 border-[3.5px] border-[#5c3a21] rounded-xs bg-[#f2efe9] overflow-hidden shadow-xs">
                        {/* Top Cycle Rows 1..8 */}
                        {activePlan.cycleRows.map((row) => {
                          const contCrop = row.continuousCropId
                            ? cropById[row.continuousCropId]
                            : cropById['palak'];

                          return (
                            <div
                              key={`top_${row.rowIndex}`}
                              className="flex items-stretch border-b border-stone-400 min-h-[38px]"
                            >
                              {/* Row Number (Click to toggle Continuous vs Column) */}
                              <button
                                type="button"
                                onClick={() => handleRowNumberClick(row.rowIndex)}
                                title="Click row number to switch between Full-Width Spinach, Column Crops, or Blank"
                                className="w-9 shrink-0 bg-[#f7f5f0] hover:bg-stone-200 border-r border-stone-400 flex items-center justify-center font-black text-xs text-stone-900 cursor-pointer"
                              >
                                {row.rowIndex}
                              </button>

                              {row.mode === 'continuous' ? (
                                <div
                                  onClick={() => handleRowNumberClick(row.rowIndex)}
                                  style={{ backgroundColor: contCrop?.bgHex || '#cde5b3' }}
                                  className="flex-1 flex items-center justify-center gap-2.5 px-3 font-extrabold text-sm text-stone-900 cursor-pointer relative"
                                >
                                  <span className="text-lg leading-none">{contCrop?.icon || '🥬'}</span>
                                  <span>{contCrop?.name || 'Palak / Spinach'}</span>
                                </div>
                              ) : (
                                <div className="flex-1 flex items-stretch bg-[#e9e6df]/60">
                                  {activePlan.zones
                                    .filter((z) => z.type !== 'border')
                                    .map((zone) => {
                                      if (zone.type === 'pipe') {
                                        return (
                                          <div
                                            key={zone.id}
                                            className="w-0 border-r-2 border-dashed border-blue-600 relative z-10"
                                            title={zone.label}
                                          />
                                        );
                                      }
                                      const cid = row.cells[zone.id];
                                      const cObj = cid ? cropById[cid] : null;
                                      return (
                                        <button
                                          key={zone.id}
                                          type="button"
                                          onClick={() => handleCellClick(row.rowIndex, zone.id)}
                                          title={`Click to sow ${cropById[selectedBrushCropId]?.name || 'crop'} in ${zone.label}`}
                                          className="flex-1 flex items-center justify-center p-1 hover:bg-white/60 transition cursor-pointer"
                                        >
                                          {cObj ? (
                                            <span className="text-xl leading-none drop-shadow-2xs">
                                              {cObj.icon}
                                            </span>
                                          ) : (
                                            <span className="text-stone-600 font-bold text-sm">—</span>
                                          )}
                                        </button>
                                      );
                                    })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Repeat Cycle Callout Box */}
                        {summary.showTailRows && (
                          <div className="bg-[#f7f5f0] py-3.5 px-4 border-b border-stone-400 text-center">
                            <div className="text-sm font-black text-stone-900 mb-1">↑</div>
                            <div className="border-t border-b border-dashed border-stone-500 py-2.5">
                              <div className="font-black text-sm text-stone-900 leading-snug">
                                Repeat this
                                <br />
                                {activePlan.cycleRowsCount}-row cycle
                                <br />
                                along the full
                                <br />
                                {activePlan.bedLengthFt}-ft bed.
                              </div>
                            </div>
                            <div className="text-sm font-black text-stone-900 mt-1">↓</div>
                          </div>
                        )}

                        {/* Bottom Tail Rows 93..100 */}
                        {summary.showTailRows &&
                          summary.tailRows.map((row) => {
                            const contCrop = row.continuousCropId
                              ? cropById[row.continuousCropId]
                              : cropById['palak'];

                            return (
                              <div
                                key={`tail_${row.actualRowNumber}`}
                                className="flex items-stretch border-b last:border-b-0 border-stone-400 min-h-[36px]"
                              >
                                <div className="w-9 shrink-0 bg-[#f7f5f0] border-r border-stone-400 flex items-center justify-center font-black text-xs text-stone-900">
                                  {row.actualRowNumber}
                                </div>

                                {row.mode === 'continuous' ? (
                                  <div
                                    style={{ backgroundColor: contCrop?.bgHex || '#cde5b3' }}
                                    className="flex-1 flex items-center justify-center gap-2.5 px-3 font-extrabold text-sm text-stone-900"
                                  >
                                    <span className="text-lg leading-none">{contCrop?.icon || '🥬'}</span>
                                    <span>{contCrop?.name || 'Palak / Spinach'}</span>
                                  </div>
                                ) : (
                                  <div className="flex-1 flex items-stretch bg-[#e9e6df]/60">
                                    {activePlan.zones
                                      .filter((z) => z.type !== 'border')
                                      .map((zone) => {
                                        if (zone.type === 'pipe') {
                                          return (
                                            <div
                                              key={zone.id}
                                              className="w-0 border-r-2 border-dashed border-blue-600"
                                            />
                                          );
                                        }
                                        const cid = row.cells[zone.id];
                                        const cObj = cid ? cropById[cid] : null;
                                        return (
                                          <div
                                            key={zone.id}
                                            className="flex-1 flex items-center justify-center p-1"
                                          >
                                            {cObj ? (
                                              <span className="text-xl leading-none">{cObj.icon}</span>
                                            ) : (
                                              <span className="text-stone-600 font-bold text-sm">—</span>
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

                      {/* Right Outer Border Crop Icons */}
                      {borderZones.length > 1 && (
                        <div className="w-6 flex flex-col items-center justify-between py-1 select-none">
                          {Array.from({ length: 15 }).map((_, i) => (
                            <div key={i} className="flex flex-col items-center leading-none">
                              <span className="text-[9px] text-emerald-700">🌿</span>
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-rose-800 -mt-0.5" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Outer Border Caption */}
                    {primaryBorderZone && (
                      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-stone-900 pl-8">
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-[10px]">🌿</span>
                          <span className="w-3 h-3 rounded-full bg-rose-600 border border-rose-800 -mt-0.5" />
                        </div>
                        <span>
                          {primaryBorderCrop?.name || 'Radish'} planted along the outer border at{' '}
                          {primaryBorderZone.spacingInches || 12}-inch spacing (plant to plant).
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* LAYOUT NOTES BOX */}
                <div className="border-2 border-stone-400 rounded-xl overflow-hidden bg-white">
                  <div className="bg-[#143d23] text-white text-center font-extrabold text-xs uppercase tracking-wider py-2 px-3">
                    LAYOUT NOTES
                  </div>
                  <ul className="p-3.5 space-y-1.5 text-xs text-stone-900 list-disc pl-6 font-semibold">
                    <li>
                      Bed divided into {cropZones.length} crop column(s) of{' '}
                      {cropZones.map((c) => `${c.widthFt} ft`).join(' / ')} each.
                    </li>
                    <li>
                      {summary.totalRowsPerBed} horizontal rows of {activePlan.rowWidthFt} ft each.
                    </li>
                    <li>{pipeZones.length} water pipe / drip line(s) running through the bed.</li>
                    {primaryBorderZone && (
                      <li>
                        {primaryBorderCrop?.name || 'Radish'} planted on the outer border at{' '}
                        {primaryBorderZone.spacingInches || 12}-inch spacing.
                      </li>
                    )}
                    <li>
                      Palak / Spinach is sown continuously across the full width and is{' '}
                      <span className="underline font-extrabold">not</span> counted by columns.
                    </li>
                  </ul>
                </div>
              </div>

              {/* ============================================================
                  POSTER RIGHT COLUMN (6 COLS):
                  LEGEND + CROP CATEGORIES + FRIENDLY CROPS + LAND SUMMARY
                 ============================================================ */}
              <div className="col-span-6 space-y-4">
                
                {/* 1. LEGEND TABLE */}
                <div className="border-2 border-stone-400 rounded-xl overflow-hidden bg-white">
                  <div className="bg-[#143d23] text-white text-center font-extrabold text-xs uppercase tracking-wider py-2 px-3">
                    LEGEND
                  </div>
                  <div className="divide-y divide-stone-300 text-xs">
                    <div className="grid grid-cols-12 items-center p-2.5">
                      <div className="col-span-2 flex justify-center text-xl">🍅</div>
                      <div className="col-span-4 font-extrabold text-red-700">Tomato</div>
                      <div className="col-span-6 font-medium text-stone-800">= column-based planting</div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2.5">
                      <div className="col-span-2 flex justify-center text-xl">🥒</div>
                      <div className="col-span-4 font-extrabold text-emerald-800">Snake gourd</div>
                      <div className="col-span-6 font-medium text-stone-800">= column-based planting</div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2.5">
                      <div className="col-span-2 flex justify-center">
                        <span className="px-2 py-0.5 bg-stone-100 border border-stone-300 rounded font-bold text-stone-700">
                          —
                        </span>
                      </div>
                      <div className="col-span-4 font-extrabold text-stone-900">No planting</div>
                      <div className="col-span-6 font-medium text-stone-800">= blank cell</div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2.5">
                      <div className="col-span-2 flex justify-center text-xl">🥬</div>
                      <div className="col-span-4 font-extrabold text-stone-900">Palak / Spinach</div>
                      <div className="col-span-6 font-medium text-stone-800 leading-snug">
                        = continuous full-width seed row, multiple seeds sown, not column-counted
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2.5">
                      <div className="col-span-2 flex justify-center">
                        <div className="h-5 border-r-2 border-dashed border-blue-600" />
                      </div>
                      <div className="col-span-4 font-extrabold text-blue-700">Drip line / Pipe</div>
                      <div className="col-span-6 font-medium text-stone-800">
                        = vertical blue dashed line
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2.5">
                      <div className="col-span-2 flex justify-center">
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-[10px]">🌿</span>
                          <span className="w-3 h-3 rounded-full bg-rose-600 border border-rose-800 -mt-0.5" />
                        </div>
                      </div>
                      <div className="col-span-4 font-extrabold text-rose-800">
                        {primaryBorderCrop?.name || 'Radish'} border
                      </div>
                      <div className="col-span-6 font-medium text-stone-800">
                        = outer border planting at {primaryBorderZone?.spacingInches || 12}-inch spacing
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CROP CATEGORIES (CROP OPTIONS) */}
                <div className="border-2 border-stone-400 rounded-xl overflow-hidden bg-white">
                  <div className="bg-[#143d23] text-white text-center font-extrabold text-xs uppercase tracking-wider py-2 px-3">
                    CROP CATEGORIES (CROP OPTIONS)
                  </div>
                  <div className="divide-y divide-stone-300 text-xs">
                    <div className="grid grid-cols-12 items-center p-2.5">
                      <div className="col-span-2 flex justify-center text-xl">🥬</div>
                      <div className="col-span-4 font-extrabold text-stone-900">Greens</div>
                      <div className="col-span-6 font-medium text-stone-800 leading-snug">
                        Palak, Methi, Coriander, Amaranthus, Gongura, Bathua
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2.5">
                      <div className="col-span-2 flex justify-center text-xl">🍅</div>
                      <div className="col-span-4 font-extrabold text-stone-900">
                        Ground vegetables
                      </div>
                      <div className="col-span-6 font-medium text-stone-800 leading-snug">
                        Tomato, Brinjal, Okra, Cluster beans, Cauliflower, Chilli, Cabbage
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2.5">
                      <div className="col-span-2 flex justify-center text-xl">🥒</div>
                      <div className="col-span-4 font-extrabold text-stone-900">
                        Creeper vegetables
                      </div>
                      <div className="col-span-6 font-medium text-stone-800 leading-snug">
                        Snake gourd, Ash gourd, Ridge gourd, Cucumber, Bottle gourd, Pumpkin
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2.5">
                      <div className="col-span-2 flex justify-center text-xl">🥕</div>
                      <div className="col-span-4 font-extrabold text-stone-900">
                        Root vegetables
                      </div>
                      <div className="col-span-6 font-medium text-stone-800 leading-snug">
                        Radish, Carrot, Beetroot, Onion, Garlic
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. FRIENDLY CROPS */}
                <div className="border-2 border-stone-400 rounded-xl overflow-hidden bg-white">
                  <div className="bg-[#143d23] text-white text-center font-extrabold text-xs uppercase tracking-wider py-2 px-3">
                    FRIENDLY CROPS
                  </div>
                  <div className="grid grid-cols-4 divide-x divide-stone-300 py-3">
                    {[
                      { name: 'Moringa', icon: '🌳' },
                      { name: 'Marigold', icon: '🌼' },
                      { name: 'Mustard', icon: '🌾' },
                      { name: 'Pomegranate', icon: '🍎' },
                    ].map((fc) => (
                      <div
                        key={fc.name}
                        className="flex flex-col items-center justify-center px-2 text-center"
                      >
                        <span className="text-2xl mb-1">{fc.icon}</span>
                        <span className="text-xs font-extrabold text-stone-900">{fc.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. AREA & LAND SUMMARY */}
                <div className="border-2 border-stone-400 rounded-xl overflow-hidden bg-white">
                  <div className="bg-[#143d23] text-white text-center font-extrabold text-xs uppercase tracking-wider py-2 px-3">
                    AREA & LAND SUMMARY
                  </div>
                  <div className="divide-y divide-stone-300 text-xs">
                    <div className="grid grid-cols-12 items-center p-2">
                      <div className="col-span-7 font-semibold text-stone-800 pl-2">
                        🏞️ Total land parcel
                      </div>
                      <div className="col-span-5 font-extrabold text-right pr-2">
                        {activePlan.totalLandSqFt.toLocaleString()} sq ft
                      </div>
                    </div>
                    <div className="p-2 text-center font-bold text-stone-800 bg-stone-50">
                      📍 {activePlan.landAcres} acre = {summary.hectares} ha ={' '}
                      {activePlan.totalLandSqFt.toLocaleString()} sq ft
                    </div>
                    <div className="grid grid-cols-12 items-center p-2">
                      <div className="col-span-6 font-semibold text-stone-800 pl-2">
                        🌱 Each bed size
                      </div>
                      <div className="col-span-6 font-extrabold text-right pr-2">
                        {activePlan.bedLengthFt} ft × {activePlan.bedWidthFt} ft ={' '}
                        {summary.singleBedSqFt} sq ft
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2">
                      <div className="col-span-7 font-semibold text-stone-800 pl-2">
                        🟫 Total beds
                      </div>
                      <div className="col-span-5 font-extrabold text-right pr-2">
                        {activePlan.totalBedsInPlot}
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2">
                      <div className="col-span-7 font-semibold text-stone-800 pl-2">
                        🟩 Total bed square feet
                      </div>
                      <div className="col-span-5 font-extrabold text-right pr-2">
                        {summary.totalBedSqFt.toLocaleString()} sq ft
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2">
                      <div className="col-span-7 font-semibold text-stone-800 pl-2">
                        🛤️ Pathway size
                      </div>
                      <div className="col-span-5 font-extrabold text-right pr-2">
                        {activePlan.pathwayWidthFt} ft × {activePlan.bedLengthFt} ft
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2">
                      <div className="col-span-7 font-semibold text-stone-800 pl-2">
                        🔢 Total number of pathways
                      </div>
                      <div className="col-span-5 font-extrabold text-right pr-2">
                        {summary.pathwayCount}
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2">
                      <div className="col-span-7 font-semibold text-stone-800 pl-2">
                        📐 Total pathway square feet
                      </div>
                      <div className="col-span-5 font-extrabold text-right pr-2">
                        {summary.totalPathwaySqFt.toLocaleString()} sq ft
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2 bg-emerald-50/80">
                      <div className="col-span-7 font-extrabold text-emerald-950 pl-2">
                        ✅ Total utilized area
                      </div>
                      <div className="col-span-5 font-black text-emerald-950 text-right pr-2">
                        {summary.utilizedSqFt.toLocaleString()} sq ft
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center p-2">
                      <div className="col-span-7 font-semibold text-stone-700 pl-2">
                        🍃 Unutilized space
                      </div>
                      <div className="col-span-5 font-extrabold text-stone-800 text-right pr-2">
                        {summary.unutilizedSqFt.toLocaleString()} sq ft
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default BedPlanner;