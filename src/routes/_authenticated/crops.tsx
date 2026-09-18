import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCrops, upsertCrop, deleteCrop } from "@/lib/farm.functions";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useMe } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Pencil,
  Trash2,
  Sprout,
  UploadCloud,
  Upload,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";

export const Route = createFileRoute("/_authenticated/crops")({
  component: CropsPage,
});

function CropThumbnail({ crop, onClick }: { crop: any; onClick?: () => void }) {
  const [loadError, setLoadError] = useState(false);
  const imageUrl = crop.image_url;

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
  crop: any | null;
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
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {crop.description}
            </p>
          )}
        </DialogHeader>
        <div className="w-full max-h-[70vh] flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden border p-1">
          <img
            src={crop.image_url}
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
  const [editing, setEditing] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [lightboxCrop, setLightboxCrop] = useState<any | null>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      setConfirmDel(null);
      toast.success("Crop removed");
    },
  });

  const columns: ColumnDef<any>[] = [
    {
      id: "image",
      header: "Image",
      enableSorting: false,
      meta: { excludeFromCsv: true },
      cell: ({ row }: any) => (
        <CropThumbnail
          crop={row.original}
          onClick={() => row.original.image_url && setLightboxCrop(row.original)}
        />
      ),
    },
    { id: "crop_name", accessorKey: "crop_name", header: "Crop" },
    { id: "variety_name", accessorKey: "variety_name", header: "Variety" },
    {
      id: "crop_category",
      accessorKey: "crop_category",
      header: "Category",
      cell: ({ getValue }) => (
        <Badge variant="secondary" className="capitalize">
          {String(getValue() || "")}
        </Badge>
      ),
    },
    { id: "cultivation_season", accessorKey: "cultivation_season", header: "Season" },
    { id: "sowing_window", accessorKey: "sowing_window", header: "Sowing" },
    { id: "harvesting_window", accessorKey: "harvesting_window", header: "Harvest" },
    { id: "growing_days", accessorKey: "growing_days", header: "Days" },
    { id: "typical_yield_per_acre", accessorKey: "typical_yield_per_acre", header: "Yield/acre" },
    { id: "optimal_temp", accessorKey: "optimal_temp", header: "Temp" },
    { id: "water_requirement", accessorKey: "water_requirement", header: "Water" },
    {
      id: "is_active",
      accessorKey: "is_active",
      header: "Active",
      cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
    },

    ...(canEdit
      ? [
          {
            id: "actions",
            header: "",
            meta: { excludeFromCsv: true },
            cell: ({ row }: any) => (
              <div className="flex gap-1 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(row.original)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDel(row.original)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <AppShell>
      <div className="p-8 max-w-6xl">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-serif text-3xl">Crop Library</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {crops.data?.length ?? 0} varieties
            </p>
          </div>
        </div>
        <DataTable
          data={crops.data || []}
          columns={columns}
          searchKeys={["crop_name", "variety_name", "crop_category"]}
          searchPlaceholder="Search crops..."
          csvFilename="crops"
          toolbar={
            canEdit && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-3.5 mr-1" /> Add crop
              </Button>
            )
          }
        />
        {(adding || editing) && (
          <CropDialog
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
                Delete "{confirmDel?.crop_name} — {confirmDel?.variety_name}"?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive"
                onClick={() => delMut.mutate(confirmDel.id)}
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

function ImageUploadSection({
  imageUrl,
  onChange,
}: {
  imageUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WEBP)");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image must be smaller than 15 MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `crops/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("knowledge-images")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (error) {
        // Fallback to Base64 Data URL if Supabase storage upload fails
        const reader = new FileReader();
        reader.onload = () => {
          onChange(reader.result as string);
          toast.success("Image attached");
        };
        reader.onerror = () => {
          toast.error(`Upload error: ${error.message}`);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: pub } = supabase.storage
        .from("knowledge-images")
        .getPublicUrl(path);

      onChange(pub.publicUrl);
      toast.success("Image uploaded successfully");
    } catch (err: any) {
      // Fallback to Base64
      try {
        const reader = new FileReader();
        reader.onload = () => {
          onChange(reader.result as string);
          toast.success("Image attached");
        };
        reader.readAsDataURL(file);
      } catch {
        toast.error(err?.message || "Failed to upload image");
      }
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function applyUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (
      !trimmed.startsWith("http://") &&
      !trimmed.startsWith("https://") &&
      !trimmed.startsWith("data:image/")
    ) {
      toast.error("Please enter a valid web image URL (e.g. https://...)");
      return;
    }
    onChange(trimmed);
    setUrlInput("");
    toast.success("Image URL applied");
  }

  if (imageUrl) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Crop photo</Label>
        <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/20">
          <div className="relative size-20 sm:size-24 rounded-md overflow-hidden border bg-muted shrink-0 shadow-2xs">
            <img
              src={imageUrl}
              alt="Crop preview"
              className="size-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
              }}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground truncate">
                {imageUrl.startsWith("data:") ? "Direct image attachment" : imageUrl}
              </p>
              <p className="text-[11px] text-muted-foreground">Photo preview ready to save</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5 mr-1.5" />
                    Change image
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onChange(null)}
                disabled={uploading}
              >
                <Trash2 className="size-3.5 mr-1.5" />
                Remove image
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Crop photo</Label>
        <div className="flex items-center text-xs text-muted-foreground gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={cn(
              "px-2 py-0.5 rounded transition-colors text-xs cursor-pointer",
              activeTab === "upload"
                ? "bg-muted text-foreground font-medium"
                : "hover:text-foreground"
            )}
          >
            File upload
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={cn(
              "px-2 py-0.5 rounded transition-colors text-xs cursor-pointer",
              activeTab === "url"
                ? "bg-muted text-foreground font-medium"
                : "hover:text-foreground"
            )}
          >
            Image URL
          </button>
        </div>
      </div>

      {activeTab === "upload" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border/80 hover:border-muted-foreground/50 hover:bg-muted/30",
            uploading && "opacity-70 pointer-events-none"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/jpg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Uploading image to storage...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <div className="size-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <UploadCloud className="size-5" />
              </div>
              <p className="text-xs font-medium text-foreground">
                Click to upload or drag and drop
              </p>
              <p className="text-[11px] text-muted-foreground">
                PNG, JPG, or WebP up to 15MB
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="pl-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyUrl();
                }
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={applyUrl}
            disabled={!urlInput.trim()}
          >
            Attach
          </Button>
        </div>
      )}
    </div>
  );
}

function CropDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: any;
}) {
  const [f, setF] = useState(() =>
    initial
      ? { ...initial, image_url: initial.image_url ?? null }
      : {
          crop_name: "",
          variety_name: "",
          crop_category: "vegetable",
          yield_unit: "kg",
          is_active: true,
          image_url: null,
        }
  );
  const upsert = useServerFn(upsertCrop);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => {
      const { id, ...values } = f;
      return upsert({ data: { id, values } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      onOpenChange(false);
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set(k: string, v: any) {
    setF((p: any) => ({ ...p, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {initial ? "Edit crop" : "Add a crop"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <ImageUploadSection
              imageUrl={f.image_url ?? null}
              onChange={(url) => set("image_url", url)}
            />
          </div>
          <div>
            <Label>Crop name *</Label>
            <Input
              value={f.crop_name}
              onChange={(e) => set("crop_name", e.target.value)}
            />
          </div>
          <div>
            <Label>Variety *</Label>
            <Input
              value={f.variety_name || ""}
              onChange={(e) => set("variety_name", e.target.value)}
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select
              value={f.crop_category || ""}
              onValueChange={(v) => set("crop_category", v)}
            >
              <SelectTrigger>
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
                  "other",
                ].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Yield unit</Label>
            <Input
              value={f.yield_unit || ""}
              onChange={(e) => set("yield_unit", e.target.value)}
            />
          </div>
          <div>
            <Label>Typical yield / acre</Label>
            <Input
              type="number"
              step="0.01"
              value={f.typical_yield_per_acre ?? ""}
              onChange={(e) =>
                set("typical_yield_per_acre", e.target.value ? +e.target.value : null)
              }
            />
          </div>
          <div>
            <Label>Growing days</Label>
            <Input
              type="number"
              value={f.growing_days ?? ""}
              onChange={(e) =>
                set("growing_days", e.target.value ? +e.target.value : null)
              }
            />
          </div>
          <div>
            <Label>Cultivation season</Label>
            <Input
              value={f.cultivation_season || ""}
              onChange={(e) => set("cultivation_season", e.target.value)}
              placeholder="e.g. Kharif / Rabi"
            />
          </div>
          <div>
            <Label>Sowing window</Label>
            <Input
              value={f.sowing_window || ""}
              onChange={(e) => set("sowing_window", e.target.value)}
              placeholder="e.g. Jun-Jul"
            />
          </div>
          <div>
            <Label>Harvesting window</Label>
            <Input
              value={f.harvesting_window || ""}
              onChange={(e) => set("harvesting_window", e.target.value)}
              placeholder="e.g. Oct-Dec"
            />
          </div>
          <div>
            <Label>Optimal temperature</Label>
            <Input
              value={f.optimal_temp || ""}
              onChange={(e) => set("optimal_temp", e.target.value)}
              placeholder="e.g. 20-30°C"
            />
          </div>
          <div>
            <Label>Water requirement</Label>
            <Select
              value={f.water_requirement || ""}
              onValueChange={(v) => set("water_requirement", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
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
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={f.description || ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-between">
            <Label>Active</Label>
            <Switch
              checked={!!f.is_active}
              onCheckedChange={(v) => set("is_active", v)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !f.crop_name}
          >
            {mut.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
