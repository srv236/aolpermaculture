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
import { MonthCalendarPicker } from "@/components/month-calendar-picker";
import { toast } from "sonner";
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
// ADD / EDIT CROP FORM
// Updated with modern card elements, sowing presets, germination,
// and repeat harvest settings.
// -------------------------------------------------------------
type CropFormState = {
  id?: string;
  crop_name: string;
  variety_name: string;
  crop_category: string;
  yield_unit: string;
  typical_yield_per_acre: string;
  growing_days: string;
  cultivation_season: string;
  sowing_window: string;
  harvesting_window: string;
  optimal_temp: string;
  water_requirement: string;
  description: string;
  is_active: boolean;
  image_url: string | null;
  germination_days: string;
  is_repeat_harvest: boolean;
  repeat_harvest_interval: string;
};

function CropDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: CropRow | null;
}) {
  const [f, setF] = useState<CropFormState>(() =>
    initial
      ? {
          id: initial.id,
          crop_name: initial.crop_name || "",
          variety_name: initial.variety_name || "",
          crop_category: initial.crop_category || "vegetable",
          yield_unit: initial.yield_unit || "kg",
          typical_yield_per_acre:
            initial.typical_yield_per_acre !== null && initial.typical_yield_per_acre !== undefined
              ? String(initial.typical_yield_per_acre)
              : "",
          growing_days:
            initial.growing_days !== null && initial.growing_days !== undefined
              ? String(initial.growing_days)
              : "",
          cultivation_season: initial.cultivation_season || "",
          sowing_window: initial.sowing_window || "",
          harvesting_window: initial.harvesting_window || "",
          optimal_temp: initial.optimal_temp || "",
          water_requirement: initial.water_requirement || "Medium",
          description: initial.description || "",
          is_active: initial.is_active ?? true,
          image_url: initial.image_url ?? null,
          germination_days:
            initial.germination_days !== null && initial.germination_days !== undefined
              ? String(initial.germination_days)
              : "",
          is_repeat_harvest: !!initial.is_repeat_harvest,
          repeat_harvest_interval: initial.repeat_harvest_interval || "",
        }
      : {
          crop_name: "",
          variety_name: "",
          crop_category: "vegetable",
          yield_unit: "kg",
          typical_yield_per_acre: "",
          growing_days: "",
          cultivation_season: "",
          sowing_window: "",
          harvesting_window: "",
          optimal_temp: "",
          water_requirement: "Medium",
          description: "",
          is_active: true,
          image_url: null,
          germination_days: "",
          is_repeat_harvest: false,
          repeat_harvest_interval: "",
        },
  );

  const upsert = useServerFn(upsertCrop);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => {
      const { id, ...rawValues } = f;

      const values: Record<string, unknown> = {
        crop_name: rawValues.crop_name?.trim(),
        variety_name: rawValues.variety_name?.trim() || null,
        crop_category: rawValues.crop_category || null,
        yield_unit: rawValues.yield_unit?.trim() || "kg",
        typical_yield_per_acre:
          rawValues.typical_yield_per_acre !== "" && rawValues.typical_yield_per_acre !== null
            ? Number(rawValues.typical_yield_per_acre)
            : null,
        growing_days:
          rawValues.growing_days !== "" && rawValues.growing_days !== null
            ? parseInt(String(rawValues.growing_days), 10)
            : null,
        cultivation_season: rawValues.cultivation_season?.trim() || null,
        sowing_window: rawValues.sowing_window?.trim() || null,
        harvesting_window: rawValues.harvesting_window?.trim() || null,
        optimal_temp: rawValues.optimal_temp?.trim() || null,
        water_requirement: rawValues.water_requirement || null,
        description: rawValues.description?.trim() || null,
        is_active: rawValues.is_active ?? true,
        image_url: rawValues.image_url || null,
        // Germination and repeat harvest settings
        germination_days:
          rawValues.germination_days !== "" && rawValues.germination_days !== null
            ? parseInt(String(rawValues.germination_days), 10)
            : null,
        is_repeat_harvest: Boolean(rawValues.is_repeat_harvest),
        repeat_harvest_interval: rawValues.is_repeat_harvest
          ? rawValues.repeat_harvest_interval?.trim() || null
          : null,
      };

      return upsert({ data: { id, values } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      onOpenChange(false);
      toast.success(initial ? "Crop updated successfully" : "Crop added to library");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set<K extends keyof CropFormState>(k: K, v: CropFormState[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Wheat className="size-5 text-primary" />
            <DialogTitle className="font-serif text-2xl">
              {initial ? "Edit Crop" : "Add a Crop"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure crop variety details, sowing and germination window, harvest cycle, and
            growing conditions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Section 1: Thumbnail Photo */}
          <div>
            <ImageUploadSection
              imageUrl={f.image_url}
              onChange={(url) => set("image_url", url)}
              label="Crop photo"
            />
          </div>

          {/* Section 2: Crop Identity */}
          <div className="grid gap-3 sm:grid-cols-3 p-3.5 rounded-lg border bg-muted/20">
            <div className="sm:col-span-2">
              <Label className="text-xs font-medium">Crop Name *</Label>
              <Input
                value={f.crop_name}
                onChange={(e) => set("crop_name", e.target.value)}
                placeholder="e.g. Tomato, Spinach, Basil"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Variety / Cultivar</Label>
              <Input
                value={f.variety_name}
                onChange={(e) => set("variety_name", e.target.value)}
                placeholder="e.g. Roma, Desi, Genovese"
                className="mt-1 text-sm"
              />
            </div>
            <div className="sm:col-span-3">
              <Label className="text-xs font-medium">Category</Label>
              <Select
                value={f.crop_category || "vegetable"}
                onValueChange={(v) => set("crop_category", v)}
              >
                <SelectTrigger className="mt-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "vegetable",
                    "greens",
                    "fruit",
                    "herb",
                    "legume",
                    "grain",
                    "perennial",
                    "flower",
                    "other",
                  ].map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 3: Sowing & Germination (Sanitized: Month Calendar & Dropdowns) */}
          <div className="p-3.5 rounded-lg border bg-muted/20 space-y-3.5">
            {/* Month Calendar Picker for Sowing Window (strictly months/presets, no days or years) */}
            <MonthCalendarPicker
              value={f.sowing_window || ""}
              onChange={(v) => set("sowing_window", v)}
              label="Sowing Window"
            />

            <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t">
              <div>
                <Label className="text-xs font-medium">Cultivation Season</Label>
                <Select
                  value={f.cultivation_season || ""}
                  onValueChange={(v) => set("cultivation_season", v)}
                >
                  <SelectTrigger className="mt-1 text-sm bg-background">
                    <SelectValue placeholder="Select cultivation season..." />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Kharif (Monsoon)",
                      "Rabi (Winter)",
                      "Zaid (Summer)",
                      "Kharif & Rabi",
                      "All Year Round",
                      "Perennial",
                      "Spring / Summer",
                      "Autumn / Winter",
                    ].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                    {f.cultivation_season &&
                      ![
                        "Kharif (Monsoon)",
                        "Rabi (Winter)",
                        "Zaid (Summer)",
                        "Kharif & Rabi",
                        "All Year Round",
                        "Perennial",
                        "Spring / Summer",
                        "Autumn / Winter",
                      ].includes(f.cultivation_season) && (
                        <SelectItem value={f.cultivation_season}>{f.cultivation_season}</SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">Germination Period (Days)</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    min="1"
                    value={f.germination_days}
                    onChange={(e) => set("germination_days", e.target.value)}
                    placeholder="e.g. 7"
                    className="text-sm pr-12 bg-background"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    days
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Growing & Harvest Schedule (Sanitized: Dropdowns for harvesting & intervals) */}
          <div className="p-3.5 rounded-lg border bg-muted/20 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium">Growing Days (Numeric)</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    min="1"
                    value={f.growing_days}
                    onChange={(e) => set("growing_days", e.target.value)}
                    placeholder="e.g. 75"
                    className="text-sm pr-12 bg-background"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    days
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">
                  Harvesting Window (Range of Dates / Months)
                </Label>
                <Select
                  value={f.harvesting_window || ""}
                  onValueChange={(v) => {
                    set("harvesting_window", v);
                    const match = v.match(/^(\d+)\s*-\s*(\d+)\s*days/);
                    if (match && (!f.growing_days || f.growing_days === "")) {
                      const avg = Math.round((parseInt(match[1], 10) + parseInt(match[2], 10)) / 2);
                      set("growing_days", String(avg));
                    }
                  }}
                >
                  <SelectTrigger className="mt-1 text-sm bg-background">
                    <SelectValue placeholder="Select harvest window or duration..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="30 - 45 days (1 - 1.5 months)">
                      30 - 45 days (1 - 1.5 months)
                    </SelectItem>
                    <SelectItem value="45 - 60 days (1.5 - 2 months)">
                      45 - 60 days (1.5 - 2 months)
                    </SelectItem>
                    <SelectItem value="60 - 75 days (2 - 2.5 months)">
                      60 - 75 days (2 - 2.5 months)
                    </SelectItem>
                    <SelectItem value="75 - 90 days (2.5 - 3 months)">
                      75 - 90 days (2.5 - 3 months)
                    </SelectItem>
                    <SelectItem value="90 - 120 days (3 - 4 months)">
                      90 - 120 days (3 - 4 months)
                    </SelectItem>
                    <SelectItem value="120 - 150 days (4 - 5 months)">
                      120 - 150 days (4 - 5 months)
                    </SelectItem>
                    <SelectItem value="150 - 180 days (5 - 6 months)">
                      150 - 180 days (5 - 6 months)
                    </SelectItem>
                    <SelectItem value="6 - 9 months">6 - 9 months</SelectItem>
                    <SelectItem value="9 - 12 months">9 - 12 months</SelectItem>
                    <SelectItem value="Over 1 year (Perennial)">Over 1 year (Perennial)</SelectItem>
                    <SelectItem value="Jan - Feb">Jan - Feb</SelectItem>
                    <SelectItem value="Feb - Mar">Feb - Mar</SelectItem>
                    <SelectItem value="Mar - Apr">Mar - Apr</SelectItem>
                    <SelectItem value="Apr - May">Apr - May</SelectItem>
                    <SelectItem value="May - Jun">May - Jun</SelectItem>
                    <SelectItem value="Jun - Jul">Jun - Jul</SelectItem>
                    <SelectItem value="Jul - Aug">Jul - Aug</SelectItem>
                    <SelectItem value="Aug - Sep">Aug - Sep</SelectItem>
                    <SelectItem value="Sep - Oct">Sep - Oct</SelectItem>
                    <SelectItem value="Oct - Nov">Oct - Nov</SelectItem>
                    <SelectItem value="Nov - Dec">Nov - Dec</SelectItem>
                    <SelectItem value="Dec - Jan">Dec - Jan</SelectItem>
                    <SelectItem value="Sep - Nov (Kharif Harvest)">
                      Sep - Nov (Kharif Harvest)
                    </SelectItem>
                    <SelectItem value="Feb - Apr (Rabi Harvest)">
                      Feb - Apr (Rabi Harvest)
                    </SelectItem>
                    <SelectItem value="May - Jun (Zaid Harvest)">
                      May - Jun (Zaid Harvest)
                    </SelectItem>
                    <SelectItem value="All year round">All year round (Continuous)</SelectItem>
                    {f.harvesting_window &&
                      ![
                        "30 - 45 days (1 - 1.5 months)",
                        "45 - 60 days (1.5 - 2 months)",
                        "60 - 75 days (2 - 2.5 months)",
                        "75 - 90 days (2.5 - 3 months)",
                        "90 - 120 days (3 - 4 months)",
                        "120 - 150 days (4 - 5 months)",
                        "150 - 180 days (5 - 6 months)",
                        "6 - 9 months",
                        "9 - 12 months",
                        "Over 1 year (Perennial)",
                        "Jan - Feb",
                        "Feb - Mar",
                        "Mar - Apr",
                        "Apr - May",
                        "May - Jun",
                        "Jun - Jul",
                        "Jul - Aug",
                        "Aug - Sep",
                        "Sep - Oct",
                        "Oct - Nov",
                        "Nov - Dec",
                        "Dec - Jan",
                        "Sep - Nov (Kharif Harvest)",
                        "Feb - Apr (Rabi Harvest)",
                        "May - Jun (Zaid Harvest)",
                        "All year round",
                      ].includes(f.harvesting_window) && (
                        <SelectItem value={f.harvesting_window}>{f.harvesting_window}</SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Repeat Harvest Toggle */}
            <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium">Repeated Harvest?</Label>
                <p className="text-[11px] text-muted-foreground">
                  Can this crop produce multiple harvests (e.g. greens, herbs, chillies, tomatoes)?
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={!!f.is_repeat_harvest}
                  onCheckedChange={(v) => set("is_repeat_harvest", v)}
                />
                <span className="text-xs font-medium">{f.is_repeat_harvest ? "Yes" : "No"}</span>
              </div>
            </div>

            {f.is_repeat_harvest && (
              <div className="pt-2 border-t space-y-1.5 animate-in fade-in-50 duration-200">
                <Label className="text-xs font-medium">Repeat Harvest Interval</Label>
                <Select
                  value={f.repeat_harvest_interval || ""}
                  onValueChange={(v) => set("repeat_harvest_interval", v)}
                >
                  <SelectTrigger className="text-sm bg-background">
                    <SelectValue placeholder="Select repeat harvest interval..." />
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
                    {f.repeat_harvest_interval &&
                      ![
                        "Every 3-5 days",
                        "Every 5-7 days",
                        "Weekly (Every 7 days)",
                        "Every 10 days",
                        "Every 2 weeks (Bi-weekly)",
                        "Every 3 weeks",
                        "Monthly (Every 30 days)",
                        "Seasonal flush",
                      ].includes(f.repeat_harvest_interval) && (
                        <SelectItem value={f.repeat_harvest_interval}>
                          {f.repeat_harvest_interval}
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Section 5: Growth Conditions & Yield (Sanitized: Dropdowns for temp, water, yield unit) */}
          <div className="grid gap-3 sm:grid-cols-2 p-3.5 rounded-lg border bg-muted/20">
            <div>
              <Label className="text-xs font-medium">Optimal Temperature</Label>
              <Select value={f.optimal_temp || ""} onValueChange={(v) => set("optimal_temp", v)}>
                <SelectTrigger className="mt-1 text-sm bg-background">
                  <SelectValue placeholder="Select optimal temperature..." />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "10°C - 18°C (Cool season)",
                    "15°C - 22°C (Mild cool)",
                    "20°C - 25°C (Moderate)",
                    "20°C - 30°C (Warm moderate)",
                    "25°C - 35°C (Warm / Tropical)",
                    "30°C - 40°C (Hot / Heat tolerant)",
                  ].map((temp) => (
                    <SelectItem key={temp} value={temp}>
                      {temp}
                    </SelectItem>
                  ))}
                  {f.optimal_temp &&
                    ![
                      "10°C - 18°C (Cool season)",
                      "15°C - 22°C (Mild cool)",
                      "20°C - 25°C (Moderate)",
                      "20°C - 30°C (Warm moderate)",
                      "25°C - 35°C (Warm / Tropical)",
                      "30°C - 40°C (Hot / Heat tolerant)",
                    ].includes(f.optimal_temp) && (
                      <SelectItem value={f.optimal_temp}>{f.optimal_temp}</SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium">Water Requirement</Label>
              <Select
                value={f.water_requirement || "Medium"}
                onValueChange={(v) => set("water_requirement", v)}
              >
                <SelectTrigger className="mt-1 text-sm bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Low", "Medium", "High"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium">Yield Unit</Label>
              <Select value={f.yield_unit || "kg"} onValueChange={(v) => set("yield_unit", v)}>
                <SelectTrigger className="mt-1 text-sm bg-background">
                  <SelectValue placeholder="Select yield unit..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  <SelectItem value="g">Grams (g)</SelectItem>
                  <SelectItem value="quintal">Quintals (q / 100 kg)</SelectItem>
                  <SelectItem value="tons">Metric Tons (t)</SelectItem>
                  <SelectItem value="bunches">Bunches</SelectItem>
                  <SelectItem value="crates">Crates</SelectItem>
                  <SelectItem value="count">Count / Pieces</SelectItem>
                  <SelectItem value="boxes">Boxes</SelectItem>
                  <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                  {f.yield_unit &&
                    ![
                      "kg",
                      "g",
                      "quintal",
                      "tons",
                      "bunches",
                      "crates",
                      "count",
                      "boxes",
                      "lbs",
                    ].includes(f.yield_unit) && (
                      <SelectItem value={f.yield_unit}>{f.yield_unit}</SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium">Typical Yield / Acre</Label>
              <Input
                type="number"
                step="0.01"
                value={f.typical_yield_per_acre}
                onChange={(e) => set("typical_yield_per_acre", e.target.value)}
                placeholder="e.g. 500"
                className="mt-1 text-sm bg-background"
              />
            </div>
          </div>

          {/* Section 6: Description */}
          <div>
            <Label className="text-xs font-medium">Description & Notes</Label>
            <Textarea
              rows={3}
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Plant spacing, soil preferences, companion planting benefits..."
              className="mt-1 text-sm resize-y"
            />
          </div>

          {/* Section 7: Active Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="text-xs font-medium">Active in Catalogue</Label>
              <p className="text-[11px] text-muted-foreground">
                Active crops appear in planting, sowing, and bed planning drop-downs.
              </p>
            </div>
            <Switch checked={!!f.is_active} onCheckedChange={(v) => set("is_active", v)} />
          </div>
        </div>

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !f.crop_name?.trim()}>
            {mut.isPending ? "Saving..." : initial ? "Save changes" : "Add crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
