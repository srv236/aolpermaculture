import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { upsertCrop } from "@/lib/farm.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DataTable } from "@/components/data-table";
import { ImageUploadSection } from "@/components/image-upload-section";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { Database } from "@/integrations/supabase/types";

type CropRow = Database["public"]["Tables"]["crops"]["Row"];

import {
  Plus,
  Pencil,
  Trash2,
  Sprout,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  SlidersHorizontal,
  Sparkles,
  Info,
} from "lucide-react";

function getExpiryStatus(expiryStr?: string | null): {
  status: "none" | "expired" | "expiring_soon" | "valid" | "text";
  label: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  daysLeft?: number;
} {
  if (!expiryStr || !expiryStr.trim()) {
    return { status: "none", label: "Not set", badgeVariant: "outline" };
  }

  const trimmed = expiryStr.trim();
  const dateMatch = trimmed.match(/^(\d{4})[-/](\d{2})(?:[-/](\d{2}))?$/);
  if (dateMatch) {
    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const day = dateMatch[3] ? parseInt(dateMatch[3], 10) : 28;
    const expDate = new Date(year, month, day);

    if (!isNaN(expDate.getTime())) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diffMs = expDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return {
          status: "expired",
          label: `Expired (${Math.abs(diffDays)}d ago)`,
          badgeVariant: "destructive",
          daysLeft: diffDays,
        };
      }
      if (diffDays === 0) {
        return {
          status: "expiring_soon",
          label: "Expires today",
          badgeVariant: "secondary",
          daysLeft: 0,
        };
      }
      if (diffDays <= 60) {
        return {
          status: "expiring_soon",
          label: `Expires in ${diffDays}d`,
          badgeVariant: "secondary",
          daysLeft: diffDays,
        };
      }
      const formatted = expDate.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: dateMatch[3] ? "numeric" : undefined,
      });
      return {
        status: "valid",
        label: formatted,
        badgeVariant: "outline",
        daysLeft: diffDays,
      };
    }
  }

  return { status: "text", label: trimmed, badgeVariant: "outline" };
}

interface SeedStorageViewProps {
  crops: CropRow[];
  canEdit: boolean;
  onOpenLightbox: (crop: CropRow) => void;
  onAddNewCrop?: () => void;
}

export function SeedStorageView({
  crops,
  canEdit,
  onOpenLightbox,
  onAddNewCrop,
}: SeedStorageViewProps) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CropRow | null>(null);
  const [adjusting, setAdjusting] = useState<CropRow | null>(null);
  const [confirmClear, setConfirmClear] = useState<CropRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "in_stock" | "out_of_stock" | "expiring"
  >("all");

  const qc = useQueryClient();
  const upsert = useServerFn(upsertCrop);

  // Clear seed storage stock for a crop (keeps the crop in library, resets seed stock)
  const clearMut = useMutation({
    mutationFn: (crop: CropRow) =>
      upsert({
        data: {
          id: crop.id,
          values: {
            seed_stock_quantity: 0,
            seed_expiry_date: null,
            seed_notes: null,
          },
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      setConfirmClear(null);
      toast.success("Seed stock cleared");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Calculate high-level stats
  const stats = useMemo(() => {
    let inStock = 0;
    let outOfStock = 0;
    let expiringOrExpired = 0;

    for (const c of crops) {
      const qty =
        c.seed_stock_quantity !== null && c.seed_stock_quantity !== undefined
          ? Number(c.seed_stock_quantity)
          : null;

      if (qty !== null && qty > 0) {
        inStock++;
      } else {
        outOfStock++;
      }

      const exp = getExpiryStatus(c.seed_expiry_date);
      if (exp.status === "expired" || exp.status === "expiring_soon") {
        expiringOrExpired++;
      }
    }

    return {
      total: crops.length,
      inStock,
      outOfStock,
      expiringOrExpired,
    };
  }, [crops]);

  // Filtered dataset based on quick pills
  const filteredCrops = useMemo(() => {
    if (statusFilter === "all") return crops;
    if (statusFilter === "in_stock") {
      return crops.filter(
        (c) =>
          c.seed_stock_quantity !== null &&
          c.seed_stock_quantity !== undefined &&
          Number(c.seed_stock_quantity) > 0,
      );
    }
    if (statusFilter === "out_of_stock") {
      return crops.filter(
        (c) =>
          c.seed_stock_quantity === null ||
          c.seed_stock_quantity === undefined ||
          Number(c.seed_stock_quantity) <= 0,
      );
    }
    if (statusFilter === "expiring") {
      return crops.filter((c) => {
        const exp = getExpiryStatus(c.seed_expiry_date);
        return exp.status === "expired" || exp.status === "expiring_soon";
      });
    }
    return crops;
  }, [crops, statusFilter]);

  const columns: ColumnDef<CropRow>[] = [
    {
      id: "thumbnail",
      header: "Photo",
      enableSorting: false,
      meta: { excludeFromCsv: true },
      cell: ({ row }) => {
        const crop = row.original;
        const imageUrl = crop.image_url;
        if (!imageUrl) {
          return (
            <div
              className="size-10 rounded-md border border-border/60 bg-muted/40 flex items-center justify-center text-muted-foreground/60 shrink-0"
              title="No seed photo"
            >
              <Sprout className="size-4" />
            </div>
          );
        }
        return (
          <button
            type="button"
            onClick={() => onOpenLightbox(crop)}
            className="size-10 rounded-md overflow-hidden border border-border/70 bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:scale-105 transition-transform duration-150 cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
            title="Click to view full seed photo"
          >
            <img
              src={imageUrl}
              alt={crop.crop_name || "Seed"}
              className="size-full object-cover"
              loading="lazy"
            />
          </button>
        );
      },
    },
    {
      id: "seed_name",
      accessorKey: "crop_name",
      header: "Seed & Variety",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="space-y-0.5 min-w-[140px]">
            <div className="font-medium text-foreground flex items-center gap-1.5">
              <span>{c.crop_name}</span>
            </div>
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
      id: "current_stock",
      accessorKey: "seed_stock_quantity",
      header: "Seeds in Stock",
      cell: ({ row }) => {
        const c = row.original;
        const qty =
          c.seed_stock_quantity !== null && c.seed_stock_quantity !== undefined
            ? Number(c.seed_stock_quantity)
            : null;
        const unit = c.seed_stock_unit || "count";

        if (qty === null || qty === undefined || isNaN(qty)) {
          return (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-muted-foreground border-dashed">
                0 {unit}
              </Badge>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setAdjusting(c)}
                  title="Update stock quantity"
                >
                  <SlidersHorizontal className="size-3 mr-1" /> Set
                </Button>
              )}
            </div>
          );
        }

        const isZero = qty <= 0;

        return (
          <div className="flex items-center gap-1.5">
            <Badge
              variant={isZero ? "destructive" : "secondary"}
              className={cn(
                "font-mono font-medium text-xs px-2 py-0.5",
                !isZero &&
                  "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40",
              )}
            >
              {qty.toLocaleString()} {unit}
            </Badge>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setAdjusting(c)}
                title="Adjust stock quantity"
              >
                <SlidersHorizontal className="size-3" />
              </Button>
            )}
          </div>
        );
      },
    },
    {
      id: "seed_expiry_date",
      accessorKey: "seed_expiry_date",
      header: "Expiry Period",
      cell: ({ row }) => {
        const c = row.original;
        const exp = getExpiryStatus(c.seed_expiry_date);
        if (exp.status === "none") {
          return <span className="text-xs text-muted-foreground">—</span>;
        }

        if (exp.status === "expired") {
          return (
            <Badge variant="destructive" className="text-xs font-normal">
              <AlertTriangle className="size-3 mr-1" />
              {exp.label}
            </Badge>
          );
        }

        if (exp.status === "expiring_soon") {
          return (
            <Badge
              variant="secondary"
              className="text-xs font-normal border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            >
              <AlertTriangle className="size-3 mr-1" />
              {exp.label}
            </Badge>
          );
        }

        return (
          <Badge variant="outline" className="text-xs font-normal border-border text-foreground">
            {exp.label}
          </Badge>
        );
      },
    },
    {
      id: "seed_notes",
      accessorKey: "seed_notes",
      header: "Storage Notes",
      cell: ({ row }) => {
        const notes = row.original.seed_notes;
        if (!notes) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }

        return (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-xs text-left text-muted-foreground hover:text-foreground line-clamp-1 max-w-[160px] cursor-pointer flex items-center gap-1 group"
                title="Click to read full seed notes"
              >
                <FileText className="size-3 text-muted-foreground shrink-0 group-hover:text-foreground" />
                <span className="truncate">{notes}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3 text-xs">
              <div className="font-semibold text-foreground mb-1">
                {row.original.crop_name} Seed Notes
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{notes}</p>
            </PopoverContent>
          </Popover>
        );
      },
    },
    ...(canEdit
      ? [
          {
            id: "actions",
            header: "",
            meta: { excludeFromCsv: true },
            cell: ({ row }: { row: { original: CropRow } }) => {
              const crop = row.original;
              return (
                <div className="flex gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(crop)}
                    title="Edit seed storage"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmClear(crop)}
                    title="Clear seed stock"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Top metrics summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border bg-card/60 backdrop-blur-xs">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Seed Varieties
            </CardTitle>
            <Package className="size-4 text-primary opacity-80" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold font-serif">{stats.total}</div>
            <p className="text-[11px] text-muted-foreground">in crop library</p>
          </CardContent>
        </Card>

        <Card className="border bg-card/60 backdrop-blur-xs">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">In Stock</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-600 opacity-80" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold font-serif text-emerald-700 dark:text-emerald-400">
              {stats.inStock}
            </div>
            <p className="text-[11px] text-muted-foreground">ready for sowing</p>
          </CardContent>
        </Card>

        <Card className="border bg-card/60 backdrop-blur-xs">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Zero / Low Stock
            </CardTitle>
            <AlertTriangle className="size-4 text-amber-600 opacity-80" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold font-serif text-amber-700 dark:text-amber-400">
              {stats.outOfStock}
            </div>
            <p className="text-[11px] text-muted-foreground">needs replenishment</p>
          </CardContent>
        </Card>

        <Card className="border bg-card/60 backdrop-blur-xs">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Expiring / Expired
            </CardTitle>
            <Clock className="size-4 text-destructive opacity-80" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold font-serif text-destructive">
              {stats.expiringOrExpired}
            </div>
            <p className="text-[11px] text-muted-foreground">check germination viability</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick filter buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">Filter:</span>
        <Button
          size="sm"
          variant={statusFilter === "all" ? "default" : "outline"}
          className="h-7 text-xs px-2.5"
          onClick={() => setStatusFilter("all")}
        >
          All Seeds ({crops.length})
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "in_stock" ? "default" : "outline"}
          className="h-7 text-xs px-2.5"
          onClick={() => setStatusFilter("in_stock")}
        >
          In Stock ({stats.inStock})
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "out_of_stock" ? "default" : "outline"}
          className="h-7 text-xs px-2.5"
          onClick={() => setStatusFilter("out_of_stock")}
        >
          Zero Stock ({stats.outOfStock})
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "expiring" ? "default" : "outline"}
          className="h-7 text-xs px-2.5"
          onClick={() => setStatusFilter("expiring")}
        >
          Expiring / Expired ({stats.expiringOrExpired})
        </Button>
      </div>

      {/* Table display */}
      <DataTable
        data={filteredCrops}
        columns={columns}
        searchKeys={["crop_name", "variety_name", "crop_category", "seed_notes"]}
        searchPlaceholder="Search seeds in storage..."
        csvFilename="seed-storage-inventory"
        toolbar={
          canEdit && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-3.5 mr-1" /> Add seed storage
            </Button>
          )
        }
      />

      {/* Add / Edit Seed Storage Form */}
      {(adding || editing) && (
        <SeedStorageDialog
          open
          onOpenChange={(v) => {
            if (!v) {
              setAdding(false);
              setEditing(null);
            }
          }}
          initial={editing}
          allCrops={crops}
          onAddNewCrop={onAddNewCrop}
        />
      )}

      {/* Quick Stock Adjust Dialog */}
      {adjusting && (
        <StockAdjustDialog open onOpenChange={(v) => !v && setAdjusting(null)} crop={adjusting} />
      )}

      {/* Clear Seed Stock Alert */}
      <AlertDialog open={!!confirmClear} onOpenChange={(v) => !v && setConfirmClear(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Clear seed stock for "{confirmClear?.crop_name}
              {confirmClear?.variety_name ? ` — ${confirmClear.variety_name}` : ""}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will set current seed stock to 0 and clear its expiry date in Seed Storage. The
              crop will remain safe and intact in the Crop Library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onClick={() => confirmClear && clearMut.mutate(confirmClear)}
            >
              Clear Stock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// -------------------------------------------------------------
// ADD / EDIT SEED STORAGE FORM
// Always pulls the available seed from the crop library
// -------------------------------------------------------------
interface SeedStorageDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: CropRow | null;
  allCrops: CropRow[];
  onAddNewCrop?: () => void;
}

type SeedStorageFormState = {
  seed_stock_quantity: string;
  seed_stock_unit: string;
  seed_expiry_date: string;
  image_url: string | null;
  seed_notes: string;
};

export function SeedStorageDialog({
  open,
  onOpenChange,
  initial,
  allCrops = [],
  onAddNewCrop,
}: SeedStorageDialogProps) {
  // If editing an existing seed storage row, lock to that crop; otherwise let the user choose
  const [selectedCropId, setSelectedCropId] = useState<string>(() => initial?.id || "");

  // Form state holding seed storage properties
  const [f, setF] = useState<SeedStorageFormState>(() => {
    if (initial) {
      return {
        seed_stock_quantity:
          initial.seed_stock_quantity !== null && initial.seed_stock_quantity !== undefined
            ? String(initial.seed_stock_quantity)
            : "",
        seed_stock_unit: initial.seed_stock_unit || "count",
        seed_expiry_date: initial.seed_expiry_date || "",
        image_url: initial.image_url ?? null,
        seed_notes: initial.seed_notes || "",
      };
    }
    return {
      seed_stock_quantity: "",
      seed_stock_unit: "count",
      seed_expiry_date: "",
      image_url: null,
      seed_notes: "",
    };
  });

  const selectedCrop = useMemo(() => {
    return allCrops.find((c) => c.id === selectedCropId) || null;
  }, [allCrops, selectedCropId]);

  const upsert = useServerFn(upsertCrop);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => {
      if (!selectedCropId) throw new Error("Please select a seed from the crop library");

      const parsedQty =
        f.seed_stock_quantity !== "" && f.seed_stock_quantity !== null
          ? Number(f.seed_stock_quantity)
          : null;

      if (parsedQty !== null && isNaN(parsedQty)) {
        throw new Error("Seed quantity must be a valid number");
      }

      const values: Record<string, unknown> = {
        seed_stock_quantity: parsedQty,
        seed_stock_unit: f.seed_stock_unit?.trim() || "count",
        seed_expiry_date: f.seed_expiry_date?.trim() || null,
        image_url: f.image_url || null,
        seed_notes: f.seed_notes?.trim() || null,
      };

      return upsert({ data: { id: selectedCropId, values } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      onOpenChange(false);
      toast.success(initial ? "Seed storage updated" : "Seed storage recorded successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSelectCrop(cropId: string) {
    setSelectedCropId(cropId);
    const found = allCrops.find((c) => c.id === cropId);
    if (found) {
      setF({
        seed_stock_quantity:
          found.seed_stock_quantity !== null && found.seed_stock_quantity !== undefined
            ? String(found.seed_stock_quantity)
            : "",
        seed_stock_unit: found.seed_stock_unit || "count",
        seed_expiry_date: found.seed_expiry_date || "",
        image_url: found.image_url ?? null,
        seed_notes: found.seed_notes || "",
      });
    }
  }

  function set<K extends keyof SeedStorageFormState>(k: K, v: SeedStorageFormState[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function addMonthsToDate(months: number) {
    const now = new Date();
    const targetMonth = now.getMonth() + months;
    const d = new Date(now.getFullYear(), targetMonth, 1);
    const maxDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(now.getDate(), maxDays));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    set("seed_expiry_date", `${yyyy}-${mm}-${dd}`);
  }

  function addYearsToDate(years: number) {
    addMonthsToDate(years * 12);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Package className="size-5 text-primary" />
            <DialogTitle className="font-serif text-2xl">
              {initial ? "Edit Seed Storage" : "Add Seed Storage"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Track seed inventory stock, count, and expiry period. Seeds are always linked to crops
            in your Crop Library.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Section 1: Choose Crop from Crop Library */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground flex items-center justify-between">
              <span>Select Seed from Crop Library *</span>
              {selectedCrop && (
                <span className="text-[11px] text-muted-foreground">
                  ID: {selectedCrop.id.slice(0, 8)}...
                </span>
              )}
            </Label>

            {initial ? (
              // Locked to current crop when editing
              <div className="p-3 rounded-lg border bg-muted/40 flex items-center justify-between">
                <div>
                  <div className="font-medium text-foreground text-sm">{initial.crop_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {initial.variety_name || "Standard variety"} •{" "}
                    {initial.crop_category || "General"}
                  </div>
                </div>
                {initial.crop_category && (
                  <Badge variant="secondary" className="capitalize text-xs">
                    {initial.crop_category}
                  </Badge>
                )}
              </div>
            ) : allCrops.length === 0 ? (
              <div className="p-3.5 rounded-lg border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <Info className="size-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-2">
                  <div>
                    <p className="font-medium">No crops found in your Crop Library.</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Please add your varieties under the <strong>Crop Library</strong> tab first.
                    </p>
                  </div>
                  {onAddNewCrop && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => {
                        onOpenChange(false);
                        onAddNewCrop();
                      }}
                    >
                      <Plus className="size-3 mr-1" /> Add Crop to Library
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Select value={selectedCropId} onValueChange={handleSelectCrop}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Choose an available crop from the library..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {allCrops.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-medium">{c.crop_name}</span>
                        {c.variety_name ? ` (${c.variety_name})` : ""}
                        {c.crop_category ? ` • ${c.crop_category}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {onAddNewCrop && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-[11px] text-primary hover:underline cursor-pointer"
                      onClick={() => {
                        onOpenChange(false);
                        onAddNewCrop();
                      }}
                    >
                      + Need a variety not listed? Add to Crop Library
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Selected Crop Preview */}
            {!initial && selectedCrop && (
              <div className="p-2.5 rounded-md border bg-muted/30 flex items-center gap-3 text-xs">
                <Sparkles className="size-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">{selectedCrop.crop_name}</span>
                  {selectedCrop.variety_name && ` (${selectedCrop.variety_name})`}
                  {selectedCrop.cultivation_season && (
                    <span className="text-muted-foreground ml-2">
                      • Season: {selectedCrop.cultivation_season}
                    </span>
                  )}
                </div>
                {selectedCrop.crop_category && (
                  <Badge variant="outline" className="capitalize text-[10px]">
                    {selectedCrop.crop_category}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Count of Seeds in Stock */}
          <div className="p-3.5 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Count of Seeds in Stock *</Label>
              <span className="text-[11px] text-muted-foreground">e.g. 500 seeds or 250 g</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Quantity / Count</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={f.seed_stock_quantity}
                  onChange={(e) => set("seed_stock_quantity", e.target.value)}
                  placeholder="e.g. 500"
                  className="text-sm font-mono"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Unit</Label>
                <Select
                  value={f.seed_stock_unit || "count"}
                  onValueChange={(v) => set("seed_stock_unit", v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Count (seeds)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="packets">Packets</SelectItem>
                    <SelectItem value="oz">Ounces (oz)</SelectItem>
                    <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 3: Expiry Period (Sanitized: Date picker & duration dropdown, NO free text) */}
          <div className="p-3.5 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Seed Expiry Date</Label>
              {f.seed_expiry_date ? (
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-xs font-mono">
                    {f.seed_expiry_date}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => set("seed_expiry_date", "")}
                  >
                    Clear
                  </Button>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground">Select date or shelf-life</span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-[10px] text-muted-foreground block mb-1">
                  Calendar Date
                </Label>
                <Input
                  type="date"
                  value={
                    f.seed_expiry_date
                      ? f.seed_expiry_date.match(/^\d{4}-\d{2}-\d{2}$/)
                        ? f.seed_expiry_date
                        : f.seed_expiry_date.match(/^\d{4}-\d{2}$/)
                          ? `${f.seed_expiry_date}-01`
                          : ""
                      : ""
                  }
                  onChange={(e) => set("seed_expiry_date", e.target.value)}
                  className="text-sm bg-background"
                />
              </div>

              <div>
                <Label className="text-[10px] text-muted-foreground block mb-1">
                  Or Auto-set from Shelf-life Dropdown
                </Label>
                <Select
                  value=""
                  onValueChange={(val) => {
                    const months = parseInt(val, 10);
                    if (!isNaN(months)) addMonthsToDate(months);
                  }}
                >
                  <SelectTrigger className="text-xs bg-background">
                    <SelectValue placeholder="Choose shelf-life duration..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 Months from today</SelectItem>
                    <SelectItem value="12">1 Year from today</SelectItem>
                    <SelectItem value="18">1.5 Years from today</SelectItem>
                    <SelectItem value="24">2 Years from today</SelectItem>
                    <SelectItem value="36">3 Years from today</SelectItem>
                    <SelectItem value="48">4 Years from today</SelectItem>
                    <SelectItem value="60">5 Years from today</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t">
              <span className="text-[10px] text-muted-foreground mr-1">Quick buttons:</span>
              {[
                { label: "+6 Mos", m: 6 },
                { label: "+1 Year", m: 12 },
                { label: "+2 Years", m: 24 },
                { label: "+3 Years", m: 36 },
                { label: "+5 Years", m: 60 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => addMonthsToDate(btn.m)}
                  className="text-[10px] px-2 py-0.5 rounded border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Seed Thumbnail Photo */}
          <div>
            <ImageUploadSection
              imageUrl={f.image_url}
              onChange={(url) => set("image_url", url)}
              label="Seed thumbnail photo"
            />
          </div>

          {/* Section 5: Storage Notes */}
          <div>
            <Label className="text-xs font-medium">Storage Notes</Label>
            <Textarea
              rows={3}
              value={f.seed_notes}
              onChange={(e) => set("seed_notes", e.target.value)}
              placeholder="e.g. Storage jar #4, packet lot 2026, saved from Plot 2, stored with silica gel..."
              className="mt-1 text-sm resize-y"
            />
          </div>
        </div>

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !selectedCropId}>
            {mut.isPending ? "Saving..." : initial ? "Save changes" : "Save Seed Storage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------
// STOCK ADJUST DIALOG
// -------------------------------------------------------------
interface StockAdjustDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  crop: CropRow;
}

export function StockAdjustDialog({ open, onOpenChange, crop }: StockAdjustDialogProps) {
  const currentQty =
    crop.seed_stock_quantity !== null && crop.seed_stock_quantity !== undefined
      ? Number(crop.seed_stock_quantity)
      : 0;
  const unit = crop.seed_stock_unit || "count";

  const [mode, setMode] = useState<"set" | "add" | "deduct">("set");
  const [val, setVal] = useState<string>(String(currentQty));

  const upsert = useServerFn(upsertCrop);
  const qc = useQueryClient();

  const numVal = parseFloat(val) || 0;
  const newQty =
    mode === "set"
      ? numVal
      : mode === "add"
        ? currentQty + numVal
        : Math.max(0, currentQty - numVal);

  const mut = useMutation({
    mutationFn: () => {
      return upsert({
        data: {
          id: crop.id,
          values: {
            seed_stock_quantity: newQty,
          },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      onOpenChange(false);
      toast.success(`Updated ${crop.crop_name} stock to ${newQty} ${unit}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            Adjust Stock: {crop.crop_name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Current stock:{" "}
            <strong className="text-foreground">
              {currentQty} {unit}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg text-xs">
            <button
              type="button"
              onClick={() => {
                setMode("set");
                setVal(String(currentQty));
              }}
              className={cn(
                "py-1.5 px-2 rounded-md font-medium text-center transition cursor-pointer",
                mode === "set"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground",
              )}
            >
              Set Exact (=)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("add");
                setVal("");
              }}
              className={cn(
                "py-1.5 px-2 rounded-md font-medium text-center transition cursor-pointer",
                mode === "add"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground",
              )}
            >
              Add (+)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("deduct");
                setVal("");
              }}
              className={cn(
                "py-1.5 px-2 rounded-md font-medium text-center transition cursor-pointer",
                mode === "deduct"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground",
              )}
            >
              Deduct (-)
            </button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">
              {mode === "set"
                ? `New Stock Amount (${unit})`
                : mode === "add"
                  ? `Amount to Add (${unit})`
                  : `Amount to Deduct (${unit})`}
            </Label>
            <div className="relative">
              <Input
                type="number"
                step="any"
                min="0"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder="0"
                className="text-base font-mono pr-12"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {unit}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-muted/40 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">Resulting Total:</span>
            <span className="font-mono font-bold text-foreground text-sm">
              {newQty} {unit}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || val.trim() === ""}
          >
            {mut.isPending ? "Saving..." : "Save Stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
