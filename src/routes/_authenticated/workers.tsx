import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listWorkers, upsertWorker, deleteWorker } from "@/lib/workers.functions";
import { AppShell, useMe } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
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

const WORKER_TYPES = [
  { value: "short_term_sevak", label: "Short-term Sevak (≤ 1 month)" },
  { value: "long_term_sevak", label: "Long-term Sevak (~3 months)" },
  { value: "labourer", label: "Labourer" },
  { value: "permanent_staff", label: "Permanent staff" },
];
const typeLabel = (v: string) => WORKER_TYPES.find((t) => t.value === v)?.label ?? v;

function WorkersPage() {
  const me = useMe();
  const canEdit = me.data?.roles.some((r) => r === "admin" || r === "editor");
  const isAdmin = me.data?.roles.includes("admin");
  const list = useServerFn(listWorkers);
  const del = useServerFn(deleteWorker);
  const workers = useQuery({ queryKey: ["workers"], queryFn: () => list() });
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [adding, setAdding] = useState(false);
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
          toolbar={canEdit && <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5 mr-1" /> Add Sevak</Button>}
        />
        {(adding || editing) && (
          <WorkerDialog open onOpenChange={(v) => { if (!v) { setAdding(false); setEditing(null); } }} initial={editing} />
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

function WorkerDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (v: boolean) => void; initial?: any }) {
  const [f, setF] = useState(() => initial || {
    worker_code: "", full_name: "", worker_type: "short_term_sevak",
    role: "", phone: "", email: "", start_date: "", end_date: "", notes: "", work_summary: "", is_active: true,
  });
  const upsert = useServerFn(upsertWorker);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => {
      const { id, created_at, updated_at, ...rest } = f;
      const values = { ...rest };
      // empty strings → null for optional fields
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{initial ? "Edit Sevak" : "Add a Sevak"}</DialogTitle>
          <DialogDescription>Sevaks are farm personnel — separate from the website user accounts under Users.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Sevak ID</Label><Input value={f.worker_code || ""} onChange={(e) => set("worker_code", e.target.value)} placeholder="e.g. W-001" /></div>
          <div><Label>Full name *</Label><Input value={f.full_name} onChange={(e) => set("full_name", e.target.value)} /></div>
          <div className="md:col-span-2">
            <Label>Type *</Label>
            <Select value={f.worker_type} onValueChange={(v) => set("worker_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WORKER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !f.full_name || !f.worker_type}>
            {mut.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
