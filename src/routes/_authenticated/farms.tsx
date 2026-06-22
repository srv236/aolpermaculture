import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFarms, deleteFarm } from "@/lib/farm.functions";
import { AppShell, useMe } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Pencil, Trash2, ArrowRight } from "lucide-react";
import { FarmFormDialog } from "@/components/farm-form-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/farms")({
  component: FarmsPage,
});

function FarmsPage() {
  const me = useMe();
  const canEdit = me.data?.roles.some((r) => r === "admin" || r === "editor");
  const list = useServerFn(listFarms);
  const del = useServerFn(deleteFarm);
  const qc = useQueryClient();
  const farms = useQuery({ queryKey: ["farms"], queryFn: () => list() });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farms"] });
      setConfirmDelete(null);
      toast.success("Farm deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="p-8 max-w-6xl">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl">Farms</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {farms.data?.length ?? 0} farm(s) in your organisation
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4 mr-1.5" /> Add farm
            </Button>
          )}
        </div>

        {farms.isLoading && <div className="text-muted-foreground">Loading...</div>}

        <div className="grid gap-4 md:grid-cols-2">
          {farms.data?.map((f: any) => (
            <Card key={f.id} className="p-5 hover:shadow-md transition group">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/farms/$farmId"
                    params={{ farmId: f.id }}
                    className="font-serif text-xl hover:underline block truncate"
                  >
                    {f.name}
                  </Link>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    {[f.district, f.state].filter(Boolean).join(", ") || "Location not set"}
                  </div>
                </div>
                {f.farming_type && (
                  <Badge variant="secondary" className="capitalize shrink-0">{f.farming_type}</Badge>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <Stat label="Acreage" value={f.total_acreage ? `${f.total_acreage} ac` : "—"} />
                <Stat label="Established" value={f.established_year || "—"} />
                <Stat label="Status" value={f.is_active ? "Active" : "Inactive"} />
              </div>

              {f.notes && (
                <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{f.notes}</p>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <Link
                  to="/farms/$farmId"
                  params={{ farmId: f.id }}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Open <ArrowRight className="size-3.5" />
                </Link>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(f)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {(adding || editing) && (
          <FarmFormDialog
            open
            onOpenChange={(v) => { if (!v) { setAdding(false); setEditing(null); } }}
            initial={editing}
          />
        )}

        <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this farm?</AlertDialogTitle>
              <AlertDialogDescription>
                "{confirmDelete?.name}" and all its plots, sowings, and harvests will be removed. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => delMut.mutate(confirmDelete.id)} className="bg-destructive">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
