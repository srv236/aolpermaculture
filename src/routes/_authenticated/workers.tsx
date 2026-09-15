import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listWorkers, upsertWorker, deleteWorker,
  listWorkerTypes, upsertWorkerType, deleteWorkerType,
} from "@/lib/workers.functions";
import { AppShell, useMe } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { formatDate } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";

export const Route = createFileRoute("/_authenticated/workers")({
  component: WorkersPage,
});

function WorkersPage() {
  const me = useMe();
  const canEdit = me.data?.roles.some((r) => r === "admin" || r === "editor");
  const isAdmin = me.data?.roles.includes("admin");
  const list = useServerFn(listWorkers);
  const listTypes = useServerFn(listWorkerTypes);
  const del = useServerFn(deleteWorker);
  const workers = useQuery({ queryKey: ["workers"], queryFn: () => list() });
  const types = useQuery({ queryKey: ["worker_types"], queryFn: () => listTypes() });
  const typeLabel = (v: string) => types.data?.find((t) => t.value === v)?.label ?? v;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [managingTypes, setManagingTypes] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workers"] }); setConfirmDel(null); toast.success("Worker removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: ColumnDef<any>[] = [
    { id: "worker_code", accessorKey: "worker_code", header: "ID" },
    { id: "full_name", accessorKey: "full_name", header: "Name" },
    { id: "worker_type", accessorKey: "worker_type", header: "Type",
      cell: ({ getValue }) => <Badge variant="secondary">{typeLabel(String(getValue() || ""))}</Badge> },
    { id: "role", accessorKey: "role", header: "Role" },
    { id: "phone", accessorKey: "phone", header: "Phone" },
    { id: "email", accessorKey: "email", header: "Email" },
    { id: "start_date", accessorKey: "start_date", header: "Start",
      cell: ({ getValue }) => formatDate(getValue()) },
    { id: "end_date", accessorKey: "end_date", header: "End",
      cell: ({ getValue }) => formatDate(getValue()) },
    { id: "is_active", accessorKey: "is_active", header: "Active",
      cell: ({ getValue }) => getValue() ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge> },
    ...(canEdit ? [{
      id: "actions", header: "", cell: ({ row }: any) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setEditing(row.original)}><Pencil className="size-3.5" /></Button>
          {isAdmin && <Button size="sm" variant="ghost" onClick={() => setConfirmDel(row.original)}><Trash2 className="size-3.5" /></Button>}
        </div>
      ),
    }] : []),
  ];

  return (
    <AppShell>
      <div className="p-8 max-w-6xl">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-serif text-3xl">Sevaks</h1>
            <p className="text-sm text-muted-foreground mt-1">Sevaks, labourers, and permanent staff on the farms</p>
          </div>
        </div>
        <DataTable
          data={workers.data || []} columns={columns}
          searchKeys={["full_name", "worker_code", "role", "phone", "email"]}
          searchPlaceholder="Search sevaks..." csvFilename="sevaks"
          toolbar={canEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setManagingTypes(true)}>
                <Settings2 className="size-3.5 mr-1" /> Manage types
              </Button>
              <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5 mr-1" /> Add Sevak</Button>
            </div>
          )}
        />
        {(adding || editing) && (
          <WorkerDialog
            open
            onOpenChange={(v) => { if (!v) { setAdding(false); setEditing(null); } }}
            initial={editing}
            types={types.data || []}
            onManageTypes={() => setManagingTypes(true)}
          />
        )}
        {managingTypes && (
          <ManageTypesDialog open onOpenChange={(v) => !v && setManagingTypes(false)} isAdmin={!!isAdmin} />
        )}
        <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {confirmDel?.full_name}?</AlertDialogTitle>
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

function WorkerDialog({
  open, onOpenChange, initial, types, onManageTypes,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; initial?: any;
  types: { value: string; label: string }[]; onManageTypes: () => void;
}) {
  const defaultType = types[0]?.value || "";
  const [f, setF] = useState(() => initial || {
    worker_code: "", full_name: "", worker_type: defaultType,
    role: "", phone: "", email: "", start_date: "", end_date: "", notes: "", work_summary: "", is_active: true,
  });
  const upsert = useServerFn(upsertWorker);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => {
      const { id, created_at, updated_at, ...rest } = f;
      const values = { ...rest };
      for (const k of ["worker_code","role","phone","email","start_date","end_date","notes","work_summary"]) {
        if (values[k] === "") values[k] = null;
      }
      return upsert({ data: { id, values } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workers"] }); onOpenChange(false); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function set(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b shrink-0 pr-12">
          <DialogTitle className="font-serif text-2xl">{initial ? "Edit Sevak" : "Add a Sevak"}</DialogTitle>
          <DialogDescription>Sevaks are farm personnel — separate from the website user accounts under Users.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Sevak ID</Label><Input value={f.worker_code || ""} onChange={(e) => set("worker_code", e.target.value)} placeholder="e.g. W-001" /></div>
            <div><Label>Full name *</Label><Input value={f.full_name} onChange={(e) => set("full_name", e.target.value)} /></div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Type *</Label>
                <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={onManageTypes}>
                  Manage types
                </button>
              </div>
              <Select value={f.worker_type} onValueChange={(v) => set("worker_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Role</Label><Input value={f.role || ""} onChange={(e) => set("role", e.target.value)} placeholder="e.g. Field supervisor" /></div>
            <div><Label>Phone</Label><Input value={f.phone || ""} onChange={(e) => set("phone", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Email</Label><Input type="email" value={f.email || ""} onChange={(e) => set("email", e.target.value)} /></div>
            <div><Label>Start date</Label><Input type="date" value={f.start_date || ""} onChange={(e) => set("start_date", e.target.value)} /></div>
            <div><Label>End date</Label><Input type="date" value={f.end_date || ""} onChange={(e) => set("end_date", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Notes</Label><Textarea rows={3} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} /></div>
            <div className="md:col-span-2">
              <Label>Work done (final report)</Label>
              <Textarea
                rows={5}
                value={f.work_summary || ""}
                onChange={(e) => set("work_summary", e.target.value)}
                placeholder="Summary of the work this sevak did during their time at the farm — projects, contributions, skills shown, etc."
              />
              <p className="text-xs text-muted-foreground mt-1">Filled by us at the end of the sevak's stay as a record of their contribution.</p>
            </div>
            <div className="md:col-span-2 flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={!!f.is_active} onCheckedChange={(v) => set("is_active", v)} />
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 px-6 border-t bg-background shrink-0 flex flex-row items-center justify-end gap-2 m-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !f.full_name || !f.worker_type}>
            {mut.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageTypesDialog({
  open, onOpenChange, isAdmin,
}: { open: boolean; onOpenChange: (v: boolean) => void; isAdmin: boolean }) {
  const listTypes = useServerFn(listWorkerTypes);
  const upsert = useServerFn(upsertWorkerType);
  const remove = useServerFn(deleteWorkerType);
  const qc = useQueryClient();
  const types = useQuery({ queryKey: ["worker_types"], queryFn: () => listTypes() });
  const [editing, setEditing] = useState<{ original_value?: string; value: string; label: string; sort_order: number } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["worker_types"] });
    qc.invalidateQueries({ queryKey: ["workers"] });
  };

  const saveMut = useMutation({
    mutationFn: () => upsert({ data: editing as any }),
    onSuccess: () => { invalidate(); setEditing(null); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (value: string) => remove({ data: { value } }),
    onSuccess: () => { invalidate(); setConfirmDel(null); toast.success("Type removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Sevak types</DialogTitle>
          <DialogDescription>Add, rename, reorder, or remove the types shown in the dropdown.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {types.data?.map((t) => (
            <div key={t.value} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.value} · order {t.sort_order}</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ original_value: t.value, value: t.value, label: t.label, sort_order: t.sort_order })}>
                  <Pencil className="size-3.5" />
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDel(t.value)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {(!types.data || types.data.length === 0) && (
            <p className="text-sm text-muted-foreground">No types yet.</p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => setEditing({ value: "", label: "", sort_order: (types.data?.length ?? 0) * 10 + 10 })}>
            <Plus className="size-3.5 mr-1" /> New type
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>

        {editing && (
          <Dialog open onOpenChange={(v) => !v && setEditing(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{editing.original_value ? "Edit type" : "New type"}</DialogTitle>
                <DialogDescription>Label is what people see. Value is the internal code (auto-generated from the label if blank).</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>Label *</Label><Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="e.g. Intern" /></div>
                <div><Label>Value</Label><Input value={editing.value} disabled={!!editing.original_value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} placeholder="auto from label" /></div>
                <div><Label>Sort order</Label><Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !editing.label.trim()}>
                  {saveMut.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this type?</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive" onClick={() => confirmDel && delMut.mutate(confirmDel)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
