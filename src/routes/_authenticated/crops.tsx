import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCrops, upsertCrop, deleteCrop } from "@/lib/farm.functions";
import { AppShell, useMe } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DataTable } from "@/components/data-table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

const cropVisuals: Record<string, { unspashId?: string; fallbackBg?: string }> = {
  "Aloevera": { unspashId: "photo-1596547609652-9cf5d8d76921" },
  "Amaranthus": { unspashId: "photo-1551011311-bf3e6d625d30" },
  "Banana": { unspashId: "photo-1571771894821-ce9b6c11b08e" },
  "Basil": { unspashId: "photo-1603048588665-791ca8aea617" },
  "Italian Basil": { unspashId: "photo-1594488879684-25cb48ff3c2a" },
  "Bean": { unspashId: "photo-1567375639142-f8188151ff73" },
  "Bhindi": { unspashId: "photo-1627490199723-57bfb6cfb7db" },
  "Coriander": { unspashId: "photo-1608797178974-15b35a61d121" },
  "Cucumber": { unspashId: "photo-1604974244043-ab39375e80c9" },
  "Ginger": { unspashId: "photo-1599631668426-ba4a5697ed83" },
  "Green Gram": { unspashId: "photo-1585435557343-3b092031a831" },
  "Jackfruit": { unspashId: "photo-1590005354167-6da97870c913" },
  "Lettuce": { unspashId: "photo-1622205313162-be1d5712a43f" },
  "Musk Melon": { unspashId: "photo-1628102476597-25e197cb310a" },
  "Mustard": { unspashId: "photo-1587049633312-d628ae50a8ae" },
  "Onion": { unspashId: "photo-1618512496248-a07fe83766a5" },
  "Papaya": { unspashId: "photo-1601004890684-d8cbf643f5f2" },
  "Parsley": { unspashId: "photo-1606923829579-0ac99d6a5245" },
  "Pok Choy": { unspashId: "photo-1611143669185-af224c5e3252" },
  "Radish": { unspashId: "photo-1590779033100-9f60a05a013d" },
  "Rocket Leaves": { unspashId: "photo-1607532941433-304659e8198a" },
  "Sitaphal": { unspashId: "photo-1634838080334-28befa9effd0" },
  "Spinach": { unspashId: "photo-1576045057995-568f588f82fb" },
  "Star Fruit": { unspashId: "photo-1600854495079-efab8b6b1fcb" },
  "Sweet Potato": { unspashId: "photo-1590502593747-42a996133562" },
  "Tomato": { unspashId: "photo-1595855759920-86582396756a" },
  "Turmeric": { unspashId: "photo-1615485290177-d1cbbe567a1c" },
  "Zucchini": { unspashId: "photo-1557844352-761f2565b576" },

  "Cowpea": { fallbackBg: "bg-emerald-600 text-white" },
  "Curry Leaves": { fallbackBg: "bg-green-800 text-white" },
  "Fenugreek": { fallbackBg: "bg-green-700 text-white" },
  "Gongura": { fallbackBg: "bg-teal-700 text-white" },
  "Moringa": { fallbackBg: "bg-emerald-700 text-white" },
  "Moringa Leaves": { fallbackBg: "bg-emerald-800 text-white" },
  "Pumpkin Leaf": { fallbackBg: "bg-green-600 text-white" },
  "Punarnava": { fallbackBg: "bg-olive-600 text-white" },
  "Rayo Saag": { fallbackBg: "bg-lime-700 text-stone-900" },
  "Tapioca": { fallbackBg: "bg-amber-700 text-white" },
  "Taro": { fallbackBg: "bg-stone-600 text-white" },
  "Taro Leaves": { fallbackBg: "bg-green-900 text-white" },
  "White Pumpkin": { fallbackBg: "bg-slate-300 text-slate-800" },
};

function cropInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function CropVisual({ name }: { name: string }) {
  const visual = cropVisuals[name];
  if (visual?.unspashId) {
    return (
      <img
        src={`https://images.unsplash.com/${visual.unspashId}?w=80&h=80&auto=format&fit=crop&q=80`}
        alt={name}
        className="size-10 rounded-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`size-10 rounded-full flex items-center justify-center text-xs font-semibold ${visual?.fallbackBg || "bg-green-100 text-green-900"}`}
    >
      {cropInitials(name)}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/crops")({
  component: CropsPage,
});

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

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crops"] }); setConfirmDel(null); toast.success("Crop removed"); },
  });

  const columns: ColumnDef<any>[] = [
    { id: "visual", header: "", cell: ({ row }) => <CropVisual name={row.original.crop_name} /> },
    { id: "crop_name", accessorKey: "crop_name", header: "Crop" },
    { id: "variety_name", accessorKey: "variety_name", header: "Variety" },
    { id: "crop_category", accessorKey: "crop_category", header: "Category",
      cell: ({ getValue }) => <Badge variant="secondary" className="capitalize">{String(getValue() || "")}</Badge> },
    { id: "growing_days", accessorKey: "growing_days", header: "Days" },
    { id: "typical_yield_per_acre", accessorKey: "typical_yield_per_acre", header: "Yield/acre" },
    { id: "is_active", accessorKey: "is_active", header: "Active",
      cell: ({ getValue }) => getValue() ? "Yes" : "No" },
    ...(canEdit ? [{
      id: "actions", header: "", cell: ({ row }: any) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setEditing(row.original)}><Pencil className="size-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDel(row.original)}><Trash2 className="size-3.5" /></Button>
        </div>
      ),
    }] : []),
  ];

  return (
    <AppShell>
      <div className="p-8 max-w-6xl">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-serif text-3xl">Crop Library</h1>
            <p className="text-sm text-muted-foreground mt-1">{crops.data?.length ?? 0} varieties</p>
          </div>
        </div>
        <DataTable
          data={crops.data || []} columns={columns}
          searchKeys={["crop_name", "variety_name", "crop_category"]}
          searchPlaceholder="Search crops..." csvFilename="crops"
          toolbar={canEdit && <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5 mr-1" /> Add crop</Button>}
        />
        {(adding || editing) && (
          <CropDialog open onOpenChange={(v) => { if (!v) { setAdding(false); setEditing(null); } }} initial={editing} />
        )}
        <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{confirmDel?.crop_name} — {confirmDel?.variety_name}"?</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive" onClick={() => delMut.mutate(confirmDel.id)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}

function CropDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (v: boolean) => void; initial?: any }) {
  const [f, setF] = useState(() => initial || {
    crop_name: "", variety_name: "", crop_category: "vegetable",
    yield_unit: "kg", is_active: true,
  });
  const upsert = useServerFn(upsertCrop);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => {
      const { id, ...values } = f;
      return upsert({ data: { id, values } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crops"] }); onOpenChange(false); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function set(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{initial ? "Edit crop" : "Add a crop"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Crop name *</Label><Input value={f.crop_name} onChange={(e) => set("crop_name", e.target.value)} /></div>
          <div><Label>Variety *</Label><Input value={f.variety_name || ""} onChange={(e) => set("variety_name", e.target.value)} /></div>
          <div>
            <Label>Category</Label>
            <Select value={f.crop_category || ""} onValueChange={(v) => set("crop_category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["vegetable","greens","fruit","herb","legume","grain","perennial","other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Yield unit</Label><Input value={f.yield_unit || ""} onChange={(e) => set("yield_unit", e.target.value)} /></div>
          <div><Label>Typical yield / acre</Label><Input type="number" step="0.01" value={f.typical_yield_per_acre ?? ""} onChange={(e) => set("typical_yield_per_acre", e.target.value ? +e.target.value : null)} /></div>
          <div><Label>Growing days</Label><Input type="number" value={f.growing_days ?? ""} onChange={(e) => set("growing_days", e.target.value ? +e.target.value : null)} /></div>
          <div className="md:col-span-2"><Label>Description</Label><Textarea rows={3} value={f.description || ""} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="md:col-span-2 flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={!!f.is_active} onCheckedChange={(v) => set("is_active", v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !f.crop_name}>
            {mut.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
