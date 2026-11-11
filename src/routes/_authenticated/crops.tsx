import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCrops, upsertCrop, deleteCrop } from "@/lib/farm.functions";
import { AppShell, useMe } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Pencil,
  Trash2,
  Sprout,
  Wheat,
  Package,
  Calendar,
  Clock,
  RefreshCw,
  Sparkles,
  Thermometer,
  Droplets,
  CalendarDays,
  Check,
  AlertCircle,
  Layers,
  Scale,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DataTable } from "@/components/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageUploadSection } from "@/components/image-upload-section";
import { SeedStorageView } from "@/components/seed-storage-tab";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { Database } from "@/integrations/supabase/types";

type CropRow = Database["public"]["Tables"]["crops"]["Row"];

export const Route = createFileRoute("/_authenticated/crops")({
  component: CropsPage,
});

function CropThumbnail({ crop, onClick }: { crop: CropRow; onClick?: () => void }) {
  const [loadError, setLoadError] = useState(false);
  const imageUrl = crop.image_url;

  useEffect(() => {
    setLoadError(false);
  }, [imageUrl]);

  if (!imageUrl || loadError) {
    return (
      <div
        className="size-10 rounded-md border border-border/60 bg-muted/40 flex items-center justify-center text-muted-foreground/60 shrink-0"
        title="No image"
      >
        <Sprout className="size-4" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="size-10 rounded-md overflow-hidden border border-border/70 bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:scale-105 transition-transform duration-150 cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
      title="Click to view full photo"
    >
      <img
        src={imageUrl}
        alt={`${crop.crop_name || "Crop"} ${crop.variety_name || ""}`}
        className="size-full object-cover"
        loading="lazy"
        onError={() => setLoadError(true)}
      />
    </button>
  );
}

function CropLightboxDialog({
  crop,
  open,
  onOpenChange,
}: {
  crop: CropRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!crop) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-5 overflow-hidden">
        <DialogHeader className="mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="font-serif text-2xl">
              {crop.crop_name}
              {crop.variety_name ? ` — ${crop.variety_name}` : ""}
            </DialogTitle>
            {crop.crop_category && (
              <Badge variant="secondary" className="capitalize">
                {crop.crop_category}
              </Badge>
            )}
          </div>
          {crop.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{crop.description}</p>
          )}
        </DialogHeader>
        <div className="w-full max-h-[70vh] flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden border p-1">
          <img
            src={crop.image_url || undefined}
            alt={`${crop.crop_name || "Crop"} ${crop.variety_name || ""}`}
            className="max-h-[65vh] w-auto max-w-full object-contain rounded-md"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CropsPage() {
  const me = useMe();
  const canEdit = me.data?.roles.some((r) => r === "admin" || r === "editor");
  const list = useServerFn(listCrops);
  const del = useServerFn(deleteCrop);
  const crops = useQuery({ queryKey: ["crops"], queryFn: () => list() });
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CropRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState<CropRow | null>(null);
  const [lightboxCrop, setLightboxCrop] = useState<CropRow | null>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      setConfirmDel(null);
      toast.success("Crop removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Shortened Crop Library table columns
  // Crop variety & category combined into one column for compact viewing
  const columns: ColumnDef<CropRow>[] = [
    {
      id: "image",
      header: "Photo",
      enableSorting: false,
      meta: { excludeFromCsv: true },
      cell: ({ row }) => (
        <CropThumbnail
          crop={row.original}
          onClick={() => row.original.image_url && setLightboxCrop(row.original)}
        />
      ),
    },
    {
      id: "crop_info",
      accessorFn: (row: CropRow) =>
        `${row.crop_name} ${row.variety_name || ""} ${row.crop_category || ""}`,
      header: "Crop & Variety",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="space-y-0.5 min-w-[140px]">
            <div className="font-medium text-foreground">{c.crop_name}</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {c.variety_name ? (
                <span className="text-xs text-muted-foreground">{c.variety_name}</span>
              ) : null}
              {c.crop_category ? (
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wider px-1 py-0 h-4 text-muted-foreground font-normal"
                >
                  {c.crop_category}
                </Badge>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: "sowing",
      accessorKey: "sowing_window",
      header: "Sowing",
      cell: ({ row }) => {
        const c = row.original;
        const sowing = c.sowing_window || c.cultivation_season;
        return sowing ? (
          <div className="flex items-center gap-1.5 text-xs text-foreground">
            <Calendar className="size-3 text-muted-foreground shrink-0" />
            <span>{sowing}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "germination_days",
      accessorKey: "germination_days",
      header: "Germination",
      cell: ({ row }) => {
        const days = row.original.germination_days;
        if (!days && days !== 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-1 text-xs">
            <Clock className="size-3 text-muted-foreground shrink-0" />
            <span className="font-medium">{days}</span>
            <span className="text-muted-foreground">days</span>
          </div>
        );
      },
    },
    {
      id: "growing_days",
      accessorKey: "growing_days",
      header: "Growing days",
      cell: ({ getValue }) => {
        const val = getValue<number | null>();
        return val ? (
          <span className="text-xs font-medium">{val} days</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "harvesting_window",
      accessorKey: "harvesting_window",
      header: "Harvest",
      cell: ({ getValue }) => (
        <span className="text-xs text-foreground">{String(getValue() || "—")}</span>
      ),
    },
    {
      id: "repeat_harvest",
      accessorKey: "is_repeat_harvest",
      header: "Repeat harvest",
      cell: ({ row }) => {
        const c = row.original;
        if (!c.is_repeat_harvest) {
          return <span className="text-xs text-muted-foreground">Single</span>;
        }
        return (
          <Badge
            variant="outline"
            className="text-[11px] font-normal border-teal-500/30 text-teal-700 bg-teal-50/60 dark:bg-teal-950/30 dark:text-teal-300"
          >
            <RefreshCw className="size-3 mr-1 shrink-0" />
            {c.repeat_harvest_interval || "Repeatable"}
          </Badge>
        );
      },
    },
    {
      id: "typical_yield_per_acre",
      accessorKey: "typical_yield_per_acre",
      header: "Yield/acre",
      cell: ({ row }) => {
        const c = row.original;
        return c.typical_yield_per_acre ? (
          <span className="text-xs font-mono">
            {c.typical_yield_per_acre} {c.yield_unit || "kg"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "water_requirement",
      accessorKey: "water_requirement",
      header: "Water / Temp",
      cell: ({ row }) => {
        const c = row.original;
        const parts = [];
        if (c.water_requirement) parts.push(c.water_requirement);
        if (c.optimal_temp) parts.push(c.optimal_temp);
        return parts.length > 0 ? (
          <span className="text-xs text-muted-foreground">{parts.join(" • ")}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "is_active",
      accessorKey: "is_active",
      header: "Active",
      cell: ({ getValue }) => (
        <Badge variant={getValue() ? "secondary" : "outline"} className="text-xs">
          {getValue() ? "Yes" : "No"}
        </Badge>
      ),
    },
    ...(canEdit
      ? [
          {
            id: "actions",
            header: "",
            meta: { excludeFromCsv: true },
            cell: ({ row }: { row: { original: CropRow } }) => (
              <div className="flex gap-1 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(row.original)}
                  title="Edit crop details"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDel(row.original)}
                  title="Delete crop"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const [activeTab, setActiveTab] = useState<string>("crop-library");

  return (
    <AppShell>
      <div className="p-8 max-w-6xl">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-serif text-3xl">Seeds and Crops</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {crops.data?.length ?? 0} varieties in catalogue and seed storage
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-sm grid-cols-2">
            <TabsTrigger value="crop-library" className="flex items-center gap-2">
              <Wheat className="size-4" />
              <span>Crop Library</span>
            </TabsTrigger>
            <TabsTrigger value="seed-storage" className="flex items-center gap-2">
              <Package className="size-4" />
              <span>Seed Storage</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crop-library" className="mt-0 space-y-4">
            <DataTable
              data={crops.data || []}
              columns={columns}
              searchKeys={[
                "crop_name",
                "variety_name",
                "crop_category",
                "sowing_window",
                "cultivation_season",
              ]}
              searchPlaceholder="Search crops by name, variety, season..."
              csvFilename="crop-library"
              toolbar={
                canEdit && (
                  <Button size="sm" onClick={() => setAdding(true)}>
                    <Plus className="size-3.5 mr-1" /> Add crop
                  </Button>
                )
              }
            />
          </TabsContent>

          <TabsContent value="seed-storage" className="mt-0">
            <SeedStorageView
              crops={crops.data || []}
              canEdit={!!canEdit}
              onOpenLightbox={(crop) => setLightboxCrop(crop)}
              onAddNewCrop={() => setAdding(true)}
            />
          </TabsContent>
        </Tabs>

        {(adding || editing) && (
          <CropDialog
            key={editing?.id || "new-crop"}
            open
            onOpenChange={(v) => {
              if (!v) {
                setAdding(false);
                setEditing(null);
              }
            }}
            initial={editing}
          />
        )}
        <CropLightboxDialog
          crop={lightboxCrop}
          open={!!lightboxCrop}
          onOpenChange={(v) => !v && setLightboxCrop(null)}
        />
        <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete "{confirmDel?.crop_name}
                {confirmDel?.variety_name ? ` — ${confirmDel.variety_name}` : ""}"?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will delete this variety from both the Crop Library and Seed Storage.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive"
                onClick={() => confirmDel && delMut.mutate(confirmDel.id)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}

// -------------------------------------------------------------
// CONSTANTS & HELPERS FOR ADD / EDIT CROP FORM
// -------------------------------------------------------------

// Cultivation season presets
const SEASONAL_CHIPS = ["Kharif", "Rabi", "Zaid"] as const;
const OVERRIDE_CHIPS = ["Year-round", "Perennial"] as const;

function parseCultivationSeason(val?: string | null): string[] {
  if (!val) return [];
  const trimmed = val.trim();
  if (/perennial/i.test(trimmed)) return ["Perennial"];
  if (/all\s*year|year[\s-]*round/i.test(trimmed)) return ["Year-round"];

  const found: string[] = [];
  if (/kharif/i.test(trimmed)) found.push("Kharif");
  if (/rabi/i.test(trimmed)) found.push("Rabi");
  if (/zaid/i.test(trimmed)) found.push("Zaid");

  if (found.length > 0) return found;
  return trimmed ? [trimmed] : [];
}

function serializeCultivationSeason(selected: string[]): string | null {
  if (selected.includes("Year-round")) return "Year-round";
  if (selected.includes("Perennial")) return "Perennial";
  const canonicalOrder = ["Kharif", "Rabi", "Zaid"];
  const ordered = canonicalOrder.filter((s) => selected.includes(s));
  // Preserve any legacy custom season if present
  selected.forEach((s) => {
    if (!canonicalOrder.includes(s) && !ordered.includes(s)) ordered.push(s);
  });
  return ordered.length > 0 ? ordered.join(" / ") : null;
}

// Sowing window presets
const SOWING_WINDOW_PRESETS = [
  "Early Season",
  "Mid Season",
  "Late Season",
  "All Season / Continuous",
  "Year-round",
] as const;

// Harvesting window presets & units
const HARVESTING_QUICK_PRESETS = [
  "15 days",
  "1-2 months",
  "Single Harvest",
  "Kharif",
  "Rabi",
  "Zaid",
  "Year-round",
] as const;

const HARVESTING_PRESET_UNITS = ["Single Harvest", "Kharif", "Rabi", "Zaid", "Year-round"] as const;

function parseHarvestingWindow(val?: string | null): { min: string; max: string; unit: string } {
  if (!val) return { min: "", max: "", unit: "days" };
  const trimmed = val.trim();
  if (trimmed === "Single Harvest" || /single/i.test(trimmed)) {
    return { min: "", max: "", unit: "Single Harvest" };
  }
  if (/year[\s-]*round/i.test(trimmed)) {
    return { min: "", max: "", unit: "Year-round" };
  }
  if (/kharif/i.test(trimmed)) {
    return { min: "", max: "", unit: "Kharif" };
  }
  if (/rabi/i.test(trimmed)) {
    return { min: "", max: "", unit: "Rabi" };
  }
  if (/zaid/i.test(trimmed)) {
    return { min: "", max: "", unit: "Zaid" };
  }
  // Try matching range: e.g. "1-2 months", "30-45 days", "30 - 45 days"
  const rangeMatch = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(days?|weeks?|months?)/i,
  );
  if (rangeMatch) {
    const rawUnit = rangeMatch[3].toLowerCase();
    const unit = rawUnit.startsWith("month")
      ? "months"
      : rawUnit.startsWith("week")
        ? "weeks"
        : "days";
    return { min: rangeMatch[1], max: rangeMatch[2], unit };
  }
  // Try matching single number: e.g. "15 days"
  const singleMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(days?|weeks?|months?)/i);
  if (singleMatch) {
    const rawUnit = singleMatch[2].toLowerCase();
    const unit = rawUnit.startsWith("month")
      ? "months"
      : rawUnit.startsWith("week")
        ? "weeks"
        : "days";
    return { min: singleMatch[1], max: "", unit };
  }
  // Fallback
  return { min: "", max: "", unit: trimmed };
}

function serializeHarvestingWindow(min: string, max: string, unit: string): string | null {
  if (!unit) return null;
  if ((HARVESTING_PRESET_UNITS as readonly string[]).includes(unit)) {
    return unit;
  }
  const cleanMin = min.trim();
  const cleanMax = max.trim();
  if (!cleanMin && !cleanMax) return null;
  if (cleanMin && cleanMax) {
    return `${cleanMin}-${cleanMax} ${unit}`;
  }
  if (cleanMin) {
    return `${cleanMin} ${unit}`;
  }
  return `up to ${cleanMax} ${unit}`;
}

// Temperature presets & parser
const TEMP_PRESETS = [
  { label: "10-25°C (Cool)", min: "10", max: "25" },
  { label: "15-25°C (Mild)", min: "15", max: "25" },
  { label: "20-32°C (Warm)", min: "20", max: "32" },
  { label: "25-35°C (Hot)", min: "25", max: "35" },
] as const;

function parseOptimalTemp(val?: string | null): { min: string; max: string; unit: string } {
  if (!val) return { min: "", max: "", unit: "°C" };
  const trimmed = val.trim();
  const unit = trimmed.includes("°F") || /f$/i.test(trimmed) ? "°F" : "°C";
  const rangeMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:°?[CF])?\s*[-–]\s*(\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    return { min: rangeMatch[1], max: rangeMatch[2], unit };
  }
  const singleMatch = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    return { min: singleMatch[1], max: "", unit };
  }
  return { min: "", max: "", unit: "°C" };
}

function serializeOptimalTemp(min: string, max: string, unit: string): string | null {
  const cleanMin = min.trim();
  const cleanMax = max.trim();
  if (!cleanMin && !cleanMax) return null;
  if (cleanMin && cleanMax) {
    return `${cleanMin}-${cleanMax}${unit}`;
  }
  if (cleanMin) {
    return `${cleanMin}${unit}`;
  }
  return `up to ${cleanMax}${unit}`;
}

// Yield units and conversion
const YIELD_UNITS = ["tons/acre", "kg/acre", "quintals/acre", "bunches/acre"] as const;

function normalizeInitialYieldUnit(unit?: string | null): string {
  if (!unit) return "kg/acre";
  const u = unit.toLowerCase().trim();
  if (u === "kg" || u === "kg/acre") return "kg/acre";
  if (u === "tons" || u === "ton" || u === "tons/acre") return "tons/acre";
  if (u === "quintal" || u === "quintals" || u === "quintals/acre") return "quintals/acre";
  if (u === "bunches" || u === "bunches/acre") return "bunches/acre";
  return unit;
}

function convertYieldValue(val: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return val;
  // Convert fromUnit to kg base if weight-based
  let inKg: number | null = null;
  if (fromUnit === "kg/acre" || fromUnit === "kg") inKg = val;
  else if (fromUnit === "tons/acre" || fromUnit === "tons") inKg = val * 1000;
  else if (fromUnit === "quintals/acre" || fromUnit === "quintal") inKg = val * 100;

  if (inKg === null) {
    return val;
  }

  let converted = inKg;
  if (toUnit === "kg/acre" || toUnit === "kg") converted = inKg;
  else if (toUnit === "tons/acre" || toUnit === "tons") converted = inKg / 1000;
  else if (toUnit === "quintals/acre" || toUnit === "quintal") converted = inKg / 100;
  else return val;

  return Math.round(converted * 100) / 100;
}

// Standard Crop Categories
const CROP_CATEGORIES = [
  "vegetable",
  "greens",
  "fruit",
  "herb",
  "legume",
  "perennial",
  "other",
  "grain",
  "flower",
] as const;

function CropDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: CropRow | null;
}) {
  // Section 1: Crop Identity
  const [cropName, setCropName] = useState<string>(initial?.crop_name || "");
  const [varietyName, setVarietyName] = useState<string>(initial?.variety_name || "");
  const [cropCategory, setCropCategory] = useState<string>(initial?.crop_category || "vegetable");
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null);
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);

  // Section 2: Season & Harvest Windows
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>(() =>
    parseCultivationSeason(initial?.cultivation_season),
  );
  const [sowingWindow, setSowingWindow] = useState<string>(initial?.sowing_window || "");

  const parsedHarvest = parseHarvestingWindow(initial?.harvesting_window);
  const [harvestMin, setHarvestMin] = useState<string>(parsedHarvest.min);
  const [harvestMax, setHarvestMax] = useState<string>(parsedHarvest.max);
  const [harvestUnit, setHarvestUnit] = useState<string>(parsedHarvest.unit || "days");

  const [germinationDays, setGerminationDays] = useState<string>(
    initial?.germination_days !== null && initial?.germination_days !== undefined
      ? String(initial.germination_days)
      : "",
  );
  const [isRepeatHarvest, setIsRepeatHarvest] = useState<boolean>(!!initial?.is_repeat_harvest);
  const [repeatHarvestInterval, setRepeatHarvestInterval] = useState<string>(
    initial?.repeat_harvest_interval || "",
  );

  // Section 3: Agronomy & Yield
  const [growingVal, setGrowingVal] = useState<string>(
    initial?.growing_days !== null && initial?.growing_days !== undefined
      ? String(initial.growing_days)
      : "",
  );
  const [growingUnit, setGrowingUnit] = useState<"days" | "months">("days");

  const parsedTemp = parseOptimalTemp(initial?.optimal_temp);
  const [tempMin, setTempMin] = useState<string>(parsedTemp.min);
  const [tempMax, setTempMax] = useState<string>(parsedTemp.max);
  const [tempUnit, setTempUnit] = useState<string>(parsedTemp.unit || "°C");

  const [waterRequirement, setWaterRequirement] = useState<string>(
    initial?.water_requirement || "Medium",
  );

  const [yieldVal, setYieldVal] = useState<string>(
    initial?.typical_yield_per_acre !== null && initial?.typical_yield_per_acre !== undefined
      ? String(initial.typical_yield_per_acre)
      : "",
  );
  const [yieldUnit, setYieldUnit] = useState<string>(() =>
    normalizeInitialYieldUnit(initial?.yield_unit),
  );

  const [description, setDescription] = useState<string>(initial?.description || "");

  // Server function & Query Client
  const upsert = useServerFn(upsertCrop);
  const qc = useQueryClient();

  // Cultivation season toggle logic
  function toggleSeason(season: string) {
    setSelectedSeasons((prev) => {
      // Clear mutually exclusive overrides if set
      const withoutOverrides = prev.filter(
        (s) => !OVERRIDE_CHIPS.includes(s as (typeof OVERRIDE_CHIPS)[number]),
      );
      if (withoutOverrides.includes(season)) {
        return withoutOverrides.filter((s) => s !== season);
      }
      return [...withoutOverrides, season];
    });
  }

  function toggleOverride(override: string) {
    setSelectedSeasons((prev) => {
      if (prev.includes(override)) {
        return [];
      }
      return [override];
    });
  }

  // Sowing window helper
  function deriveSowingFromSeason() {
    if (selectedSeasons.includes("Year-round") || selectedSeasons.includes("Perennial")) {
      setSowingWindow("Year-round");
    } else if (selectedSeasons.length > 0) {
      setSowingWindow("Early Season");
    } else {
      setSowingWindow("All Season / Continuous");
    }
  }

  // Harvesting window preset click handler
  function applyHarvestPreset(preset: string) {
    if (preset === "15 days") {
      setHarvestMin("15");
      setHarvestMax("");
      setHarvestUnit("days");
      if (!growingVal) setGrowingVal("15");
    } else if (preset === "1-2 months") {
      setHarvestMin("1");
      setHarvestMax("2");
      setHarvestUnit("months");
      if (!growingVal) {
        setGrowingVal("45");
        setGrowingUnit("days");
      }
    } else {
      setHarvestMin("");
      setHarvestMax("");
      setHarvestUnit(preset);
    }
  }

  const isNumericHarvest = ["days", "weeks", "months"].includes(harvestUnit);
  const harvestMinNum = harvestMin.trim() !== "" ? parseFloat(harvestMin) : null;
  const harvestMaxNum = harvestMax.trim() !== "" ? parseFloat(harvestMax) : null;
  const harvestError =
    isNumericHarvest &&
    harvestMinNum !== null &&
    harvestMaxNum !== null &&
    harvestMinNum > harvestMaxNum
      ? "Min harvest duration cannot be greater than Max duration"
      : null;

  // Temperature preset click handler
  function applyTempPreset(min: string, max: string) {
    setTempMin(min);
    setTempMax(max);
    setTempUnit("°C");
  }

  const tempMinNum = tempMin.trim() !== "" ? parseFloat(tempMin) : null;
  const tempMaxNum = tempMax.trim() !== "" ? parseFloat(tempMax) : null;
  const tempError =
    tempMinNum !== null && tempMaxNum !== null && tempMinNum > tempMaxNum
      ? "Min temperature cannot be greater than Max temperature"
      : null;

  // Growing duration unit conversion
  function handleGrowingUnitChange(newUnit: "days" | "months") {
    if (newUnit === growingUnit) return;
    if (growingVal.trim() !== "") {
      const num = parseFloat(growingVal.trim());
      if (!isNaN(num) && num > 0) {
        if (newUnit === "months") {
          const m = Math.round((num / 30) * 10) / 10;
          setGrowingVal(String(m));
        } else {
          const d = Math.round(num * 30);
          setGrowingVal(String(d));
        }
      }
    }
    setGrowingUnit(newUnit);
  }

  // Yield unit conversion
  function handleYieldUnitChange(newUnit: string) {
    if (newUnit === yieldUnit) return;
    if (yieldVal.trim() !== "") {
      const num = parseFloat(yieldVal.trim());
      if (!isNaN(num)) {
        const converted = convertYieldValue(num, yieldUnit, newUnit);
        setYieldVal(String(converted));
      }
    }
    setYieldUnit(newUnit);
  }

  // Sanitized computed values
  const sanitizedSeason = serializeCultivationSeason(selectedSeasons);
  const sanitizedHarvest = serializeHarvestingWindow(harvestMin, harvestMax, harvestUnit);
  const sanitizedTemp = serializeOptimalTemp(tempMin, tempMax, tempUnit);

  const sanitizedGrowingDays = (() => {
    if (!growingVal.trim()) return null;
    const num = parseFloat(growingVal.trim());
    if (isNaN(num) || num <= 0) return null;
    return growingUnit === "months" ? Math.round(num * 30) : Math.round(num);
  })();

  const sanitizedYieldValue = (() => {
    if (!yieldVal.trim()) return null;
    const num = parseFloat(yieldVal.trim());
    if (isNaN(num) || num < 0) return null;
    return Math.round(num * 100) / 100;
  })();

  const sanitizedGerminationDays = (() => {
    if (!germinationDays.trim()) return null;
    const num = parseInt(germinationDays.trim(), 10);
    return isNaN(num) || num <= 0 ? null : num;
  })();

  // Validation
  const isSaveDisabled = !cropName.trim() || !!tempError || !!harvestError;

  // Mutation
  const mut = useMutation({
    mutationFn: () => {
      const values: Record<string, unknown> = {
        crop_name: cropName.trim(),
        variety_name: varietyName.trim() || null,
        crop_category: cropCategory || null,
        yield_unit: sanitizedYieldValue !== null ? yieldUnit : null,
        typical_yield_per_acre: sanitizedYieldValue,
        growing_days: sanitizedGrowingDays,
        cultivation_season: sanitizedSeason,
        sowing_window: sowingWindow?.trim() || null,
        harvesting_window: sanitizedHarvest,
        optimal_temp: sanitizedTemp,
        water_requirement: waterRequirement || null,
        description: description.trim() || null,
        is_active: isActive,
        image_url: imageUrl || null,
        germination_days: sanitizedGerminationDays,
        is_repeat_harvest: Boolean(isRepeatHarvest),
        repeat_harvest_interval: isRepeatHarvest ? repeatHarvestInterval.trim() || null : null,
      };

      return upsert({ data: { id: initial?.id, values } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      onOpenChange(false);
      toast.success(initial ? "Crop updated successfully" : "Crop added to library");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b shrink-0 bg-background">
          <div className="flex items-center gap-2">
            <Wheat className="size-5 text-primary" />
            <DialogTitle className="font-serif text-2xl">
              {initial ? "Edit Crop" : "Add a Crop"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure crop variety details, seasonal calendar presets, sanitized harvest windows,
            and agronomic growing conditions.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ========================================================= */}
          {/* SECTION 1: CROP IDENTITY */}
          {/* ========================================================= */}
          <div className="rounded-lg border bg-card p-4 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Sprout className="size-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  1. Crop Identity
                </h3>
                <p className="text-xs text-muted-foreground">
                  Basic name, cultivar variety, classification, and thumbnail photo.
                </p>
              </div>
            </div>

            {/* Thumbnail upload */}
            <div>
              <ImageUploadSection
                imageUrl={imageUrl}
                onChange={(url) => setImageUrl(url)}
                label="Crop Thumbnail Photo"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium h-5 flex items-center gap-1">
                  Crop Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  placeholder="e.g. Tomato, Spinach, Basil"
                  className="mt-1 text-sm bg-background"
                />
              </div>

              <div>
                <Label className="text-xs font-medium h-5 flex items-center">
                  Variety / Cultivar
                </Label>
                <Input
                  value={varietyName}
                  onChange={(e) => setVarietyName(e.target.value)}
                  placeholder="e.g. Local Green, Arka Rakshak"
                  className="mt-1 text-sm bg-background"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs font-medium h-5 flex items-center">Crop Category</Label>
                <Select value={cropCategory} onValueChange={(v) => setCropCategory(v)}>
                  <SelectTrigger className="mt-1 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CROP_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="capitalize">
                        {cat}
                      </SelectItem>
                    ))}
                    {cropCategory &&
                      !(CROP_CATEGORIES as readonly string[]).includes(cropCategory) && (
                        <SelectItem value={cropCategory} className="capitalize">
                          {cropCategory}
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Toggle Switch */}
            <div className="flex items-center justify-between p-3 rounded-md border bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium">Active in Catalogue</Label>
                <p className="text-[11px] text-muted-foreground">
                  Active crops appear in planting, sowing, and bed planning drop-downs.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 2: SEASON & HARVEST WINDOWS */}
          {/* ========================================================= */}
          <div className="rounded-lg border bg-card p-4 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 pb-2 border-b">
              <CalendarDays className="size-4 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  2. Season & Harvest Windows
                </h3>
                <p className="text-xs text-muted-foreground">
                  Cultivation season presets, sowing presets, harvest timeframe, and germination.
                </p>
              </div>
            </div>

            {/* Cultivation Season Toggle Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <Label className="text-xs font-medium">Cultivation Season Presets</Label>
                {sanitizedSeason && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Format: <strong className="text-foreground">{sanitizedSeason}</strong>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Select one or multiple seasonal presets (sorted canonically as Kharif &rarr; Rabi
                &rarr; Zaid), or pick a mutually exclusive override.
              </p>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {/* Seasonal Chips */}
                {SEASONAL_CHIPS.map((season) => {
                  const active = selectedSeasons.includes(season);
                  return (
                    <button
                      key={season}
                      type="button"
                      onClick={() => toggleSeason(season)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground/80 border-border hover:border-primary/50 hover:bg-muted/50",
                      )}
                    >
                      {active && <Check className="size-3" />}
                      {season}
                    </button>
                  );
                })}

                <span className="text-[10px] uppercase font-semibold text-muted-foreground/60 px-1">
                  or
                </span>

                {/* Mutually Exclusive Overrides */}
                {OVERRIDE_CHIPS.map((override) => {
                  const active = selectedSeasons.includes(override);
                  return (
                    <button
                      key={override}
                      type="button"
                      onClick={() => toggleOverride(override)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs",
                        active
                          ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-700"
                          : "bg-background text-foreground/80 border-border hover:border-emerald-600/50 hover:bg-muted/50",
                      )}
                    >
                      {active && <Check className="size-3" />}
                      {override}
                    </button>
                  );
                })}

                {selectedSeasons.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSeasons([])}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-2"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Sowing Window (Optional Preset Dropdown) */}
            <div className="space-y-1.5 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Sowing Window (Optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={deriveSowingFromSeason}
                  className="h-6 text-[11px] text-primary px-2"
                  title="Auto-fill sowing preset based on selected cultivation season"
                >
                  <Sparkles className="size-3 mr-1" />
                  Derive from season
                </Button>
              </div>
              <Select
                value={sowingWindow || "__none__"}
                onValueChange={(v) => setSowingWindow(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="text-sm bg-background">
                  <SelectValue placeholder="Select sowing preset or leave empty..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None / Not specified</SelectItem>
                  {SOWING_WINDOW_PRESETS.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {preset}
                    </SelectItem>
                  ))}
                  {sowingWindow &&
                    !(SOWING_WINDOW_PRESETS as readonly string[]).includes(sowingWindow) && (
                      <SelectItem value={sowingWindow}>{sowingWindow}</SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>

            {/* Harvesting Window (Quick Presets + Range + Unit Dropdown) */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <Label className="text-xs font-medium">Harvesting Window</Label>
                {sanitizedHarvest && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Format: <strong className="text-foreground">{sanitizedHarvest}</strong>
                  </span>
                )}
              </div>

              {/* Quick Preset Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground mr-1">Quick presets:</span>
                {HARVESTING_QUICK_PRESETS.map((preset) => {
                  const isActiveChip =
                    preset === "15 days"
                      ? harvestMin === "15" && !harvestMax && harvestUnit === "days"
                      : preset === "1-2 months"
                        ? harvestMin === "1" && harvestMax === "2" && harvestUnit === "months"
                        : harvestUnit === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyHarvestPreset(preset)}
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer",
                        isActiveChip
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 text-muted-foreground border-border/80 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>

              {/* Number Range + Unit Inputs */}
              <div className="grid gap-2 sm:grid-cols-3 pt-1">
                {isNumericHarvest ? (
                  <>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Min duration</Label>
                      <Input
                        type="number"
                        min="1"
                        value={harvestMin}
                        onChange={(e) => setHarvestMin(e.target.value)}
                        placeholder="e.g. 15 or 1"
                        className="mt-1 text-sm bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Max duration (optional)
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={harvestMax}
                        onChange={(e) => setHarvestMax(e.target.value)}
                        placeholder="e.g. 30 or 2"
                        className="mt-1 text-sm bg-background"
                      />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2 flex items-center px-3 rounded-md border bg-muted/30 text-xs text-muted-foreground">
                    <span>
                      Preset selected: <strong className="text-foreground">{harvestUnit}</strong>{" "}
                      (no numeric duration required)
                    </span>
                  </div>
                )}

                <div>
                  <Label className="text-[11px] text-muted-foreground">Unit / Preset</Label>
                  <Select value={harvestUnit} onValueChange={(v) => setHarvestUnit(v)}>
                    <SelectTrigger className="mt-1 text-sm bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">days</SelectItem>
                      <SelectItem value="weeks">weeks</SelectItem>
                      <SelectItem value="months">months</SelectItem>
                      <SelectItem value="Single Harvest">Single Harvest</SelectItem>
                      <SelectItem value="Kharif">Kharif (Season)</SelectItem>
                      <SelectItem value="Rabi">Rabi (Season)</SelectItem>
                      <SelectItem value="Zaid">Zaid (Season)</SelectItem>
                      <SelectItem value="Year-round">Year-round</SelectItem>
                      {harvestUnit &&
                        ![
                          "days",
                          "weeks",
                          "months",
                          "Single Harvest",
                          "Kharif",
                          "Rabi",
                          "Zaid",
                          "Year-round",
                        ].includes(harvestUnit) && (
                          <SelectItem value={harvestUnit}>{harvestUnit}</SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {harvestError && (
                <div className="flex items-center gap-1.5 text-xs text-destructive pt-0.5">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{harvestError}</span>
                </div>
              )}
            </div>

            {/* Germination Period (Optional but visible with separate numeric and days unit) */}
            <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
              <div>
                <Label className="text-xs font-medium h-5 flex items-center">
                  Germination Period
                </Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    min="1"
                    value={germinationDays}
                    onChange={(e) => setGerminationDays(e.target.value)}
                    placeholder="e.g. 7"
                    className="text-sm pr-14 bg-background"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
                    days
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Expected time from sowing until seedling emergence (optional).
                </p>
              </div>

              {/* Repeated Harvest */}
              <div className="relative flex flex-col justify-start">
                <div
                  className={cn(
                    "transition-all duration-300 ease-in-out",
                    isRepeatHarvest ? "translate-y-0" : "sm:translate-y-6 translate-y-0",
                  )}
                >
                  <div className="flex items-center justify-between p-2 rounded-md border bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div
                      className="space-y-0.5 select-none cursor-pointer"
                      onClick={() => setIsRepeatHarvest(!isRepeatHarvest)}
                    >
                      <Label className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                        <RefreshCw
                          className={cn(
                            "size-3.5 transition-transform duration-300",
                            isRepeatHarvest ? "text-primary rotate-180" : "text-muted-foreground",
                          )}
                        />
                        Repeated Harvest?
                      </Label>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        Produces continuous flushes (greens, chillies).
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={isRepeatHarvest} onCheckedChange={setIsRepeatHarvest} />
                      <span className="text-xs font-semibold w-7 text-right text-foreground">
                        {isRepeatHarvest ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dropdown with smooth expand/collapse transition */}
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isRepeatHarvest
                      ? "max-h-24 opacity-100 mt-2 translate-y-0"
                      : "max-h-0 opacity-0 mt-0 pointer-events-none -translate-y-2",
                  )}
                >
                  <Label className="text-[11px] text-muted-foreground font-medium mb-1 block">
                    Repeat Harvest Interval
                  </Label>
                  <Select
                    value={repeatHarvestInterval}
                    onValueChange={(v) => setRepeatHarvestInterval(v)}
                  >
                    <SelectTrigger className="text-sm bg-background">
                      <SelectValue placeholder="Select repeat interval..." />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "Every 3-5 days",
                        "Every 5-7 days",
                        "Weekly (Every 7 days)",
                        "Every 10 days",
                        "Every 2 weeks (Bi-weekly)",
                        "Every 3 weeks",
                        "Monthly (Every 30 days)",
                        "Seasonal flush",
                      ].map((interval) => (
                        <SelectItem key={interval} value={interval}>
                          {interval}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 3: AGRONOMY & YIELD */}
          {/* ========================================================= */}
          <div className="rounded-lg border bg-card p-4 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Thermometer className="size-4 text-amber-600 dark:text-amber-400" />
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  3. Agronomy & Yield
                </h3>
                <p className="text-xs text-muted-foreground">
                  Growing duration, temperature tolerance, water requirement, and normalized yield.
                </p>
              </div>
            </div>

            {/* Growing Duration (Days / Months conversion) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Growing Duration</Label>
                {sanitizedGrowingDays !== null && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Stored in DB as:{" "}
                    <strong className="text-foreground">{sanitizedGrowingDays} days</strong>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="1"
                    step={growingUnit === "months" ? "0.1" : "1"}
                    value={growingVal}
                    onChange={(e) => setGrowingVal(e.target.value)}
                    placeholder={growingUnit === "months" ? "e.g. 2.5" : "e.g. 75"}
                    className="text-sm bg-background"
                  />
                </div>
                <div>
                  <Select
                    value={growingUnit}
                    onValueChange={(v: "days" | "months") => handleGrowingUnitChange(v)}
                  >
                    <SelectTrigger className="text-sm bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">days</SelectItem>
                      <SelectItem value="months">months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Values in months automatically convert to days (×30) upon save.
              </p>
            </div>

            {/* Optimum Temperature Range + Quick Presets */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <Label className="text-xs font-medium">Optimum Temperature Range</Label>
                {sanitizedTemp && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Format: <strong className="text-foreground">{sanitizedTemp}</strong>
                  </span>
                )}
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground mr-1">Quick presets:</span>
                {TEMP_PRESETS.map((p) => {
                  const isActivePreset =
                    tempMin === p.min && tempMax === p.max && tempUnit === "°C";
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyTempPreset(p.min, p.max)}
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer",
                        isActivePreset
                          ? "bg-amber-600 text-white border-amber-600 dark:bg-amber-700"
                          : "bg-muted/40 text-muted-foreground border-border/80 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Number Range + Unit */}
              <div className="grid grid-cols-5 gap-2 pt-1">
                <div className="col-span-2">
                  <Label className="text-[11px] text-muted-foreground">Min Temp</Label>
                  <Input
                    type="number"
                    value={tempMin}
                    onChange={(e) => setTempMin(e.target.value)}
                    placeholder="e.g. 20"
                    className="mt-1 text-sm bg-background"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-[11px] text-muted-foreground">Max Temp</Label>
                  <Input
                    type="number"
                    value={tempMax}
                    onChange={(e) => setTempMax(e.target.value)}
                    placeholder="e.g. 32"
                    className="mt-1 text-sm bg-background"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Unit</Label>
                  <Select value={tempUnit} onValueChange={(v) => setTempUnit(v)}>
                    <SelectTrigger className="mt-1 text-sm bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="°C">°C</SelectItem>
                      <SelectItem value="°F">°F</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {tempError && (
                <div className="flex items-center gap-1.5 text-xs text-destructive pt-0.5">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{tempError}</span>
                </div>
              )}
            </div>

            {/* Water Requirement (Segmented Selector) */}
            <div className="space-y-1.5 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Water Requirement</Label>
                <span className="text-[11px] text-muted-foreground">
                  Current: <strong className="text-foreground">{waterRequirement}</strong>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/40 rounded-lg border">
                {(["Low", "Medium", "High"] as const).map((level) => {
                  const active = waterRequirement === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setWaterRequirement(level)}
                      className={cn(
                        "py-1.5 px-3 rounded-md text-xs font-medium transition-all text-center cursor-pointer flex items-center justify-center gap-1.5",
                        active
                          ? "bg-background text-foreground shadow-2xs border border-border/80 font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                      )}
                    >
                      <Droplets className={cn("size-3", active ? "text-blue-500" : "opacity-50")} />
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Typical Yield per Acre (Normalized Number + Unit Dropdown) */}
            <div className="space-y-1.5 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Typical Yield / Acre</Label>
                {sanitizedYieldValue !== null && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Stored in DB:{" "}
                    <strong className="text-foreground">
                      {sanitizedYieldValue} {yieldUnit}
                    </strong>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={yieldVal}
                    onChange={(e) => setYieldVal(e.target.value)}
                    placeholder="e.g. 5.5"
                    className="text-sm bg-background"
                  />
                </div>
                <div>
                  <Select value={yieldUnit} onValueChange={handleYieldUnitChange}>
                    <SelectTrigger className="text-sm bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YIELD_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                      {yieldUnit && !(YIELD_UNITS as readonly string[]).includes(yieldUnit) && (
                        <SelectItem value={yieldUnit}>{yieldUnit}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Switching units automatically normalizes values (e.g. 5.5 tons/acre &harr; 5,500
                kg/acre &harr; 55 quintals/acre).
              </p>
            </div>

            {/* Description & Agronomy Notes */}
            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs font-medium">Description & Agronomy Notes</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Plant spacing, companion planting benefits, soil preferences, root depth..."
                className="text-sm resize-y bg-background"
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* COMPACT SUMMARY PREVIEW BAR */}
          {/* ========================================================= */}
          <div className="rounded-lg border border-border/80 bg-muted/40 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between font-medium">
              <span className="flex items-center gap-1.5 text-primary font-semibold">
                <Sparkles className="size-3.5" />
                Sanitized Database Values Preview
              </span>
              <Badge
                variant={isActive ? "secondary" : "outline"}
                className={cn(
                  "text-[10px] h-4.5 px-2 font-medium",
                  isActive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : "",
                )}
              >
                {isActive ? "Active in Catalogue" : "Inactive"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-muted-foreground pt-1.5 border-t border-border/60">
              <div>
                <span className="text-[10px] uppercase font-semibold text-foreground/70 block">
                  Crop & Variety
                </span>
                <span className="text-foreground truncate block font-medium">
                  {cropName.trim() || <span className="text-muted-foreground/60 italic">—</span>}
                  {varietyName.trim() ? ` (${varietyName.trim()})` : ""}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-foreground/70 block">
                  Category
                </span>
                <span className="capitalize text-foreground font-medium">{cropCategory}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-foreground/70 block">
                  Cultivation Season
                </span>
                <span className="text-foreground font-medium truncate block">
                  {sanitizedSeason || <span className="text-muted-foreground/60 italic">—</span>}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-foreground/70 block">
                  Sowing Window
                </span>
                <span className="text-foreground font-medium truncate block">
                  {sowingWindow || <span className="text-muted-foreground/60 italic">—</span>}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-foreground/70 block">
                  Harvest Window
                </span>
                <span className="text-foreground font-medium truncate block">
                  {sanitizedHarvest || <span className="text-muted-foreground/60 italic">—</span>}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-foreground/70 block">
                  Germination
                </span>
                <span className="text-foreground font-medium">
                  {sanitizedGerminationDays !== null ? (
                    `${sanitizedGerminationDays} days`
                  ) : (
                    <span className="text-muted-foreground/60 italic">—</span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-foreground/70 block">
                  Growing Days
                </span>
                <span className="text-foreground font-medium">
                  {sanitizedGrowingDays !== null ? (
                    `${sanitizedGrowingDays} days`
                  ) : (
                    <span className="text-muted-foreground/60 italic">—</span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-foreground/70 block">
                  Optimum Temp
                </span>
                <span className="text-foreground font-medium">
                  {sanitizedTemp || <span className="text-muted-foreground/60 italic">—</span>}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-foreground/70 block">
                  Water Requirement
                </span>
                <span className="text-foreground font-medium">{waterRequirement}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-foreground/70 block">
                  Typical Yield / Acre
                </span>
                <span className="text-foreground font-medium font-mono">
                  {sanitizedYieldValue !== null ? (
                    `${sanitizedYieldValue} ${yieldUnit}`
                  ) : (
                    <span className="text-muted-foreground/60 italic">—</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20 shrink-0 flex items-center justify-between sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={isSaveDisabled || mut.isPending}
            className="font-medium"
          >
            {mut.isPending ? "Saving..." : initial ? "Save changes" : "Add crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
