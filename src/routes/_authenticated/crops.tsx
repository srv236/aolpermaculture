import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCrops, upsertCrop, deleteCrop } from "@/lib/farm.functions";
import { AppShell, useMe } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/data-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

const cropImageMap: Record<string, string> = {
  "Aloevera": "photo-1596547609652-9cf5d8d76921",
  "Amaranthus": "photo-1622248512215-6de1825be691",
  "Banana": "photo-1571771894821-ce9b6c11b08e",
  "Basil": "photo-1594488879684-25cb48ff3c2a",
  "Bean": "photo-1606588591319-564b73e284a0",
  "Bhindi": "photo-1625938146369-adc83368bda7",
  "Coriander": "photo-1608797178974-15b35a61d121",
  "Cowpea": "photo-1601370693674-325db0056637",
  "Cucumber": "photo-1604974244043-ab39375e80c9",
  "Curry Leaves": "photo-1628549749971-55c3258548c2",
  "Fenugreek": "photo-1627447291176-a21237305d21",
  "Ginger": "photo-1615485290382-441e4d049cb5",
  "Gongura": "photo-1515150144380-bca9f1650ed9",
  "Green Gram": "photo-1585435557343-3b092031a831",
  "Italian Basil": "photo-1603048588665-791ca8aea617",
  "Jackfruit": "photo-1590005354167-6da97870c913",
  "Lettuce": "photo-1622205313162-be1d5712a43f",
  "Moringa": "photo-1608670868843-07d0f97a5a85",
  "Moringa Leaves": "photo-1616070200021-a5d5e2cf9561",
  "Musk Melon": "photo-1579887829701-d81226127b1f",
  "Mustard": "photo-1587049633312-d628ae50a8ae",
  "Onion": "photo-1618512496248-a07fe83766a5",
  "Papaya": "photo-1601004890684-d8cbf643f5f2",
  "Parsley": "photo-1606923829579-0ac99d6a5245",
  "Pok Choy": "photo-1629141029279-d5225c93549f",
  "Pumpkin Leaf": "photo-1606755962773-d324e0a13086",
  "Punarnava": "photo-1560806887-1e4cd0b6cbd6",
  "Radish": "photo-1590779033100-9f60a05a013d",
  "Rayo Saag": "photo-1587486913049-53fc88980cfc",
  "Rocket Leaves": "photo-1607532941433-304659e8198a",
  "Sitaphal": "photo-1634838080334-28befa9effd0",
  "Spinach": "photo-1576045057995-568f588f82fb",
  "Star Fruit": "photo-1600854495079-efab8b6b1fcb",
  "Sweet Potato": "photo-1590502593747-42a996133562",
  "Tapioca": "photo-1617112028682-1262d16ebfdf",
  "Taro": "photo-1568254183919-78a4f43a2877",
  "Taro Leaves": "photo-1618220179428-22790b461013",
  "Tomato": "photo-1595855759920-86582396756a",
  "Turmeric": "photo-1615485290177-d1cbbe567a1c",
  "White Pumpkin": "photo-1506806732259-39c2d0268443",
  "Zucchini": "photo-1557844352-761f2565b576"
};

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
    { id: "thumbnail", header: "", cell: ({ row }) => {
      const crop = row.original;
      const imageId = cropImageMap[crop.crop_name] || "photo-1592417817098-8f3d6eb18865";
      const src = `https://images.unsplash.com/${imageId}?w=100&h=100&auto=format&fit=crop&q=60`;
      return (
        <Avatar className="size-9">
          <AvatarImage src={src} alt={crop.crop_name} />
          <AvatarFallback className="text-xs">{crop.crop_name?.slice(0, 2).toUpperCase() || "?"}</AvatarFallback>
        </Avatar>
      );
    } },
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
