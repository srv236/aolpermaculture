// src/lib/seasonal-bed-engine.ts

export type CropCategory = 'greens' | 'ground' | 'creeper' | 'root' | 'friendly';

export interface PlannerCrop {
  id: string;
  name: string;
  category: CropCategory;
  icon: string;
  image_url?: string | null;
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

export interface RepeatCropRule {
  id: string;
  cropId: string;
  everyNRows: number; // e.g., Tomato every 2 rows, Beans every 3 rows
  startRow: number;   // 1-based offset inside the cycle
  rowMode: 'column' | 'continuous';
  targetZoneId: 'all' | string;
}

export interface BedCycleRow {
  rowIndex: number; // 1..cycleRowsCount
  mode: 'column' | 'continuous' | 'empty';
  continuousCropId?: string | null;
  cells: Record<string, string | null>; // cropZone.id -> cropId
}

export interface SeasonalBedPlan {
  seasonKey: string;
  seasonLabel: string;
  plotTitle: string;

  // Plot & Land Parameters
  landAcres: number;
  totalLandSqFt: number;
  totalBedsInPlot: number;
  pathwayWidthFt: number;

  // Bed, Row & Column Parameters
  bedLengthFt: number;
  bedWidthFt: number;
  rowWidthFt: number;     // Horizontal row width/height in ft (default 1 ft)
  cycleRowsCount: number; // Rows per repeating cycle (default 8)

  // Cross-Section & Crop Plan
  zones: BedZone[];
  cycleRows: BedCycleRow[];
  repeatRules: RepeatCropRule[];
  randomCropIds: string[];
  randomDensityPercent: number;
}

// Default 7-Zone Cross-Section:
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

// Reference Poster 3-Column Preset (3 cols × 1 ft + 2 drip lines + outer borders)
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
  // Greens (Continuous full-width sowing)
  { id: 'palak', name: 'Palak / Spinach', category: 'greens', icon: '🥬', bgHex: '#cfe8b4', borderHex: '#4d7c2b', textHex: '#1b3b13', plantingStyle: 'continuous' },
  { id: 'methi', name: 'Methi', category: 'greens', icon: '🌿', bgHex: '#d9f0c4', borderHex: '#3f7d20', textHex: '#193810', plantingStyle: 'continuous' },
  { id: 'coriander', name: 'Coriander', category: 'greens', icon: '🌱', bgHex: '#dcfce7', borderHex: '#16a34a', textHex: '#14532d', plantingStyle: 'continuous' },
  { id: 'amaranthus', name: 'Amaranthus', category: 'greens', icon: '🍃', bgHex: '#fce7f3', borderHex: '#db2777', textHex: '#831843', plantingStyle: 'continuous' },
  { id: 'gongura', name: 'Gongura', category: 'greens', icon: '☘️', bgHex: '#ecfccb', borderHex: '#65a30d', textHex: '#365314', plantingStyle: 'continuous' },

  // Ground Vegetables (Column-based)
  { id: 'tomato', name: 'Tomato', category: 'ground', icon: '🍅', bgHex: '#fee2e2', borderHex: '#dc2626', textHex: '#991b1b', plantingStyle: 'column' },
  { id: 'brinjal', name: 'Brinjal', category: 'ground', icon: '🍆', bgHex: '#f3e8ff', borderHex: '#9333ea', textHex: '#581c87', plantingStyle: 'column' },
  { id: 'okra', name: 'Okra', category: 'ground', icon: '🫑', bgHex: '#dcfce7', borderHex: '#15803d', textHex: '#14532d', plantingStyle: 'column' },
  { id: 'cluster_beans', name: 'Cluster beans', category: 'ground', icon: '🫛', bgHex: '#fef9c3', borderHex: '#ca8a04', textHex: '#713f12', plantingStyle: 'column' },
  { id: 'chilli', name: 'Chilli', category: 'ground', icon: '🌶️', bgHex: '#ffedd5', borderHex: '#ea580c', textHex: '#7c2d12', plantingStyle: 'column' },
  { id: 'cabbage', name: 'Cabbage', category: 'ground', icon: '🥬', bgHex: '#d1fae5', borderHex: '#059669', textHex: '#064e3b', plantingStyle: 'column' },

  // Creepers (Column-based)
  { id: 'snake_gourd', name: 'Snake gourd', category: 'creeper', icon: '🥒', bgHex: '#ecfccb', borderHex: '#4d7c0f', textHex: '#274006', plantingStyle: 'column' },
  { id: 'ash_gourd', name: 'Ash gourd', category: 'creeper', icon: '🍈', bgHex: '#e0f2fe', borderHex: '#0284c7', textHex: '#0c4a6e', plantingStyle: 'column' },
  { id: 'ridge_gourd', name: 'Ridge gourd', category: 'creeper', icon: '🥒', bgHex: '#d1fae5', borderHex: '#047857', textHex: '#064e3b', plantingStyle: 'column' },
  { id: 'bottle_gourd', name: 'Bottle gourd', category: 'creeper', icon: '🍐', bgHex: '#ecfccb', borderHex: '#65a30d', textHex: '#365314', plantingStyle: 'column' },
  { id: 'pumpkin', name: 'Pumpkin', category: 'creeper', icon: '🎃', bgHex: '#ffedd5', borderHex: '#d97706', textHex: '#78350f', plantingStyle: 'column' },

  // Root Vegetables (Outer Border or Column)
  { id: 'radish', name: 'Radish', category: 'root', icon: '🌱', bgHex: '#ffe4e6', borderHex: '#e11d48', textHex: '#881337', plantingStyle: 'border' },
  { id: 'carrot', name: 'Carrot', category: 'root', icon: '🥕', bgHex: '#ffedd5', borderHex: '#f97316', textHex: '#7c2d12', plantingStyle: 'border' },
  { id: 'beetroot', name: 'Beetroot', category: 'root', icon: '🫐', bgHex: '#fce7f3', borderHex: '#be185d', textHex: '#831843', plantingStyle: 'border' },
  { id: 'onion', name: 'Onion', category: 'root', icon: '🧅', bgHex: '#fef3c7', borderHex: '#b45309', textHex: '#78350f', plantingStyle: 'border' },
  { id: 'garlic', name: 'Garlic', category: 'root', icon: '🧄', bgHex: '#f5f5f4', borderHex: '#78716c', textHex: '#292524', plantingStyle: 'border' },

  // Friendly / Companion Crops
  { id: 'moringa', name: 'Moringa', category: 'friendly', icon: '🌳', bgHex: '#dcfce7', borderHex: '#15803d', textHex: '#14532d', plantingStyle: 'column' },
  { id: 'marigold', name: 'Marigold', category: 'friendly', icon: '🌼', bgHex: '#fef08a', borderHex: '#ca8a04', textHex: '#713f12', plantingStyle: 'column' },
  { id: 'mustard', name: 'Mustard', category: 'friendly', icon: '🌾', bgHex: '#fef9c3', borderHex: '#eab308', textHex: '#713f12', plantingStyle: 'column' },
  { id: 'pomegranate', name: 'Pomegranate', category: 'friendly', icon: '🍎', bgHex: '#fee2e2', borderHex: '#b91c1c', textHex: '#7f1d1d', plantingStyle: 'column' },
];

export function generateCycleFromRules(plan: SeasonalBedPlan): BedCycleRow[] {
  const cropZones = plan.zones.filter((z) => z.type === 'crop');
  const rows: BedCycleRow[] = [];

  for (let r = 1; r <= plan.cycleRowsCount; r++) {
    const contRule = plan.repeatRules.find(
      (rule) =>
        rule.rowMode === 'continuous' &&
        rule.everyNRows > 0 &&
        r >= rule.startRow &&
        (r - rule.startRow) % rule.everyNRows === 0
    );

    if (contRule) {
      rows.push({
        rowIndex: r,
        mode: 'continuous',
        continuousCropId: contRule.cropId,
        cells: {},
      });
      continue;
    }

    const colRules = plan.repeatRules.filter(
      (rule) =>
        rule.rowMode === 'column' &&
        rule.everyNRows > 0 &&
        r >= rule.startRow &&
        (r - rule.startRow) % rule.everyNRows === 0
    );

    const cells: Record<string, string | null> = {};
    cropZones.forEach((cz, idx) => {
      const rule =
        colRules.find((cr) => cr.targetZoneId === cz.id) ||
        colRules.find((cr) => cr.targetZoneId === 'all');

      const rollRandom =
        plan.randomCropIds.length > 0 && Math.random() * 100 < plan.randomDensityPercent;

      if (rule) {
        if (cropZones.length === 3 && idx === 1 && rule.cropId === 'tomato') {
          cells[cz.id] = rollRandom
            ? plan.randomCropIds[Math.floor(Math.random() * plan.randomCropIds.length)]
            : null;
        } else {
          cells[cz.id] = rule.cropId;
        }
      } else if (rollRandom) {
        cells[cz.id] = plan.randomCropIds[Math.floor(Math.random() * plan.randomCropIds.length)];
      } else {
        cells[cz.id] = null;
      }
    });

    const hasAny = Object.values(cells).some(Boolean);
    rows.push({
      rowIndex: r,
      mode: hasAny ? 'column' : 'empty',
      continuousCropId: null,
      cells,
    });
  }

  return rows;
}

export function rebuildZonesForColumnCount(
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
      label: i === count ? 'Water Pipe' : 'Pipe',
      type: 'pipe',
      widthFt: 0.1,
    });
  }

  return [leftBorder, ...middle, rightBorder];
}

export function computeBedSummary(plan: SeasonalBedPlan) {
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

export function createDefaultSeasons(): Record<string, SeasonalBedPlan> {
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
    cycleRows: [
      { rowIndex: 1, mode: 'column', cells: { z_crop_l: 'tomato', z_crop_r: 'tomato' } },
      { rowIndex: 2, mode: 'continuous', continuousCropId: 'palak', cells: {} },
      { rowIndex: 3, mode: 'column', cells: { z_crop_l: 'snake_gourd', z_crop_r: 'snake_gourd' } },
      { rowIndex: 4, mode: 'continuous', continuousCropId: 'palak', cells: {} },
      { rowIndex: 5, mode: 'column', cells: { z_crop_l: 'tomato', z_crop_r: 'tomato' } },
      { rowIndex: 6, mode: 'continuous', continuousCropId: 'palak', cells: {} },
      { rowIndex: 7, mode: 'empty', cells: {} },
      { rowIndex: 8, mode: 'continuous', continuousCropId: 'palak', cells: {} },
    ],
    repeatRules: [
      { id: 'r1', cropId: 'palak', everyNRows: 2, startRow: 2, rowMode: 'continuous', targetZoneId: 'all' },
      { id: 'r2', cropId: 'tomato', everyNRows: 4, startRow: 1, rowMode: 'column', targetZoneId: 'all' },
      { id: 'r3', cropId: 'snake_gourd', everyNRows: 4, startRow: 3, rowMode: 'column', targetZoneId: 'all' },
    ],
    randomCropIds: ['marigold', 'radish', 'mustard'],
    randomDensityPercent: 25,
  };

  return {
    kharif,
    rabi: {
      ...kharif,
      seasonKey: 'rabi',
      seasonLabel: 'Rabi (Winter)',
      plotTitle: 'Winter Vegetable Bed Plan – Bed Layout & Land Details',
      repeatRules: [
        { id: 'w1', cropId: 'methi', everyNRows: 2, startRow: 2, rowMode: 'continuous', targetZoneId: 'all' },
        { id: 'w2', cropId: 'tomato', everyNRows: 2, startRow: 1, rowMode: 'column', targetZoneId: 'z_crop_l' },
        { id: 'w3', cropId: 'cluster_beans', everyNRows: 3, startRow: 1, rowMode: 'column', targetZoneId: 'z_crop_r' },
      ],
    },
    zaid: {
      ...kharif,
      seasonKey: 'zaid',
      seasonLabel: 'Zaid (Summer)',
      plotTitle: 'Summer Vegetable Bed Plan – Bed Layout & Land Details',
    },
  };
}