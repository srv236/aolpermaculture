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
                {["vegetable","fruit","herb","legume","grain","perennial","other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
