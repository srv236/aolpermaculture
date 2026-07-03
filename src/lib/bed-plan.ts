// Shared types & helpers for bed planning.

export type CellCrop = { cropId: string | null };

export type BedRow =
  | { kind: "cells"; cells: CellCrop[] }
  | { kind: "full"; cropId: string | null }
  | { kind: "empty" };

export type BedConfig = {
  bedLengthFt: number;
  bedWidthFt: number;
  columns: { widthFt: number }[];
  cycle: {
    rows: BedRow[];
    repeats: number;
  };
  border: {
    enabled: boolean;
    cropId: string | null;
    spacingIn: number;
  };
  dripLines: number[]; // list of column gap indices (0..columns.length) where a drip line sits
};

export function defaultBedConfig(): BedConfig {
  return {
    bedLengthFt: 100,
    bedWidthFt: 3,
    columns: [{ widthFt: 1 }, { widthFt: 1 }, { widthFt: 1 }],
    cycle: {
      repeats: 12,
      rows: [
        { kind: "cells", cells: [{ cropId: null }, { cropId: null }, { cropId: null }] },
        { kind: "full", cropId: null },
        { kind: "cells", cells: [{ cropId: null }, { cropId: null }, { cropId: null }] },
        { kind: "full", cropId: null },
        { kind: "cells", cells: [{ cropId: null }, { cropId: null }, { cropId: null }] },
        { kind: "full", cropId: null },
        { kind: "empty" },
        { kind: "full", cropId: null },
      ],
    },
    border: { enabled: true, cropId: null, spacingIn: 12 },
    dripLines: [1, 2],
  };
}

// Category → default emoji icon
export function iconForCrop(crop?: {
  crop_name?: string | null;
  crop_category?: string | null;
} | null): string {
  if (!crop) return "•";
  const name = (crop.crop_name || "").toLowerCase();
  if (/tomato/.test(name)) return "🍅";
  if (/radish/.test(name)) return "🟥";
  if (/carrot/.test(name)) return "🥕";
  if (/onion|garlic/.test(name)) return "🧅";
  if (/moringa/.test(name)) return "🌳";
  if (/marigold/.test(name)) return "🌼";
  if (/mustard/.test(name)) return "🌾";
  if (/pomegranate/.test(name)) return "🍎";
  if (/pumpkin/.test(name)) return "🎃";
  if (/chilli|chili|pepper/.test(name)) return "🌶️";
  if (/corn|maize/.test(name)) return "🌽";
  if (/gourd|cucumber|beans?|creeper/.test(name)) return "🥒";
  if (/brinjal|eggplant/.test(name)) return "🍆";
  if (/cabbage|cauliflower|broccoli/.test(name)) return "🥦";
  const cat = (crop.crop_category || "").toLowerCase();
  if (cat === "greens") return "🥬";
  if (cat === "root") return "🥕";
  if (cat === "creeper") return "🥒";
  if (cat === "ground") return "🍅";
  if (cat === "fruit") return "🍎";
  return "🌱";
}

// Deterministic marker (letter + color) to differentiate crops that share the
// same category icon in the legend / preview.
const MARKER_PALETTE = [
  "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#d946ef", "#0ea5e9",
];
export function variantMarker(
  crop?: { id?: string; crop_name?: string | null; variety_name?: string | null } | null,
): { label: string; color: string } {
  if (!crop) return { label: "", color: "#999" };
  const src = (crop.variety_name || crop.crop_name || crop.id || "").trim();
  const label = src ? src[0].toUpperCase() : "•";
  const key = crop.id || src;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return { label, color: MARKER_PALETTE[h % MARKER_PALETTE.length] };
}

export function colorForCrop(crop?: { crop_category?: string | null } | null): string {
  const cat = (crop?.crop_category || "").toLowerCase();
  if (cat === "greens") return "#dcfce7";
  if (cat === "root") return "#fee2e2";
  if (cat === "creeper") return "#ecfccb";
  if (cat === "ground") return "#fef3c7";
  if (cat === "fruit") return "#ffe4e6";
  return "#f5f5f4";
}
