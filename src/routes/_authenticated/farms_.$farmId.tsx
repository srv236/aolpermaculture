import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getFarm, listPlots, listSowing, listHarvest,
  deletePlot, deleteSowing, deleteHarvest,
} from "@/lib/farm.functions";
import { listResources, deleteResource } from "@/lib/resources.functions";
import { AppShell, useMe } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ChevronLeft, MapPin } from "lucide-react";
import { FarmMap } from "@/components/farm-map";
import { PlotFormDialog } from "@/components/plot-form-dialog";
import { SowingFormDialog, HarvestFormDialog } from "@/components/record-dialogs";
import { ResourceFormDialog } from "@/components/resource-dialog";
import { DataTable } from "@/components/data-table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";

export const Route = createFileRoute("/_authenticated/farms_/$farmId")({
  component: FarmDetail,
});

function FarmDetail() {
  const { farmId } = Route.useParams();
  const me = useMe();
  const canEdit = me.data?.roles.some((r) => r === "admin" || r === "editor");

  const getFarmFn = useServerFn(getFarm);
  const listPlotsFn = useServerFn(listPlots);
  const listSowingFn = useServerFn(listSowing);
  const listHarvestFn = useServerFn(listHarvest);

  const farm = useQuery({ queryKey: ["farm", farmId], queryFn: () => getFarmFn({ data: { id: farmId } }) });
  const plots = useQuery({ queryKey: ["plots", farmId], queryFn: () => listPlotsFn({ data: { farmId } }) });
  const sowing = useQuery({ queryKey: ["sowing", farmId], queryFn: () => listSowingFn({ data: { farmId } }) });
  const harvest = useQuery({ queryKey: ["harvest", farmId], queryFn: () => listHarvestFn({ data: { farmId } }) });
  const listResourcesFn = useServerFn(listResources);
  const resources = useQuery({ queryKey: ["resources", farmId], queryFn: () => listResourcesFn({ data: { farmId } }) });

  return (
    <AppShell>
      <div className="p-8 max-w-7xl">
        <Link to="/farms" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
          <ChevronLeft className="size-3.5" /> All farms
        </Link>
        {farm.data ? (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="font-serif text-3xl">{farm.data.name}</h1>
                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {[farm.data.district, farm.data.state].filter(Boolean).join(", ") || "Location not set"}
                  </span>
                  {farm.data.farming_type && <Badge variant="secondary" className="capitalize">{farm.data.farming_type}</Badge>}
                  {farm.data.total_acreage && <span>{farm.data.total_acreage} acres</span>}
                </div>
              </div>
            </div>

            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="plots">Plots ({plots.data?.length ?? 0})</TabsTrigger>
                <TabsTrigger value="sowing">Sowing ({sowing.data?.length ?? 0})</TabsTrigger>
                <TabsTrigger value="harvest">Harvest ({harvest.data?.length ?? 0})</TabsTrigger>
                <TabsTrigger value="resources">Resources ({resources.data?.length ?? 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <Card className="p-5">
                  <FarmMap
                    value={farm.data.geopolygon}
                    readOnly
                    height={420}
                    overlays={(plots.data || []).filter((p: any) => p.geopolygon).map((p: any) => ({ wkt: p.geopolygon, color: "#4ade80", label: p.plot_number }))}
                  />
                  <div className="grid md:grid-cols-3 gap-4 mt-5 text-sm">
                    <Detail label="Owner" value={farm.data.owner_name} />
                    <Detail label="Contact" value={farm.data.contact_email} />
                    <Detail label="Phone" value={farm.data.contact_phone} />
                    <Detail label="Established" value={farm.data.established_year} />
                    <Detail label="Coords" value={farm.data.latitude && farm.data.longitude ? `${farm.data.latitude}, ${farm.data.longitude}` : null} />
                    <Detail label="Status" value={farm.data.is_active ? "Active" : "Inactive"} />
                    {farm.data.notes && <Detail label="Notes" value={farm.data.notes} className="md:col-span-3" />}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="plots" className="mt-4">
                <PlotsTab farmId={farmId} farmGeo={farm.data.geopolygon} plots={plots.data || []} canEdit={!!canEdit} />
              </TabsContent>
              <TabsContent value="sowing" className="mt-4">
                <SowingTab farmId={farmId} rows={sowing.data || []} canEdit={!!canEdit} />
              </TabsContent>
              <TabsContent value="harvest" className="mt-4">
                <HarvestTab farmId={farmId} rows={harvest.data || []} canEdit={!!canEdit} />
              </TabsContent>
              <TabsContent value="resources" className="mt-4">
                <ResourcesTab farmId={farmId} rows={resources.data || []} canEdit={!!canEdit} />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-muted-foreground">Loading...</div>
        )}
      </div>
    </AppShell>
  );
}

function Detail({ label, value, className }: { label: string; value: any; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

// ===== PLOTS =====
function PlotsTab({ farmId, farmGeo, plots, canEdit }: { farmId: string; farmGeo: string | null; plots: any[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const qc = useQueryClient();
  const del = useServerFn(deletePlot);
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plots", farmId] }); setConfirmDel(null); toast.success("Plot deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const siblings = plots.filter((p) => p.geopolygon).map((p) => ({ id: p.id, wkt: p.geopolygon, label: p.plot_number }));

  const columns: ColumnDef<any>[] = [
    { id: "plot_number", accessorKey: "plot_number", header: "Plot" },
    { id: "acreage", accessorKey: "acreage", header: "Acres" },
    { id: "soil_type", accessorKey: "soil_type", header: "Soil" },
    { id: "irrigation_type", accessorKey: "irrigation_type", header: "Irrigation" },
    { id: "aspect", accessorKey: "aspect", header: "Aspect" },
    { id: "notes", accessorKey: "notes", header: "Notes",
      cell: ({ row }) => <span className="line-clamp-1 max-w-xs">{row.original.notes}</span> },
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
    <>
      <DataTable
        data={plots} columns={columns} searchKeys={["plot_number", "soil_type", "irrigation_type"]}
        searchPlaceholder="Search plots..." csvFilename="plots"
        toolbar={canEdit && <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5 mr-1" /> Add plot</Button>}
        emptyMessage="No plots yet. Add the first one to get started."
      />
      {(adding || editing) && (
        <PlotFormDialog
          open
          onOpenChange={(v) => { if (!v) { setAdding(false); setEditing(null); } }}
          initial={editing || { farm_id: farmId, plot_number: "" }}
          farmGeo={farmGeo}
          siblings={siblings}
        />
      )}
      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plot "{confirmDel?.plot_number}"?</AlertDialogTitle>
            <AlertDialogDescription>All sowings and harvests on this plot will also be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => delMut.mutate(confirmDel.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ===== SOWING =====
function SowingTab({ farmId, rows, canEdit }: { farmId: string; rows: any[]; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const qc = useQueryClient();
  const del = useServerFn(deleteSowing);
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sowing", farmId] }); setConfirmDel(null); toast.success("Sowing deleted"); },
  });

  const data = rows.map((r) => ({
    ...r,
    plot_number: r.plots?.plot_number,
    crop_label: `${r.crops?.crop_name || ""} — ${r.crops?.variety_name || ""}`,
  }));

  const columns: ColumnDef<any>[] = [
    { id: "planting_date", accessorKey: "planting_date", header: "Planted",
      cell: ({ getValue }) => formatDate(getValue()) },
    { id: "plot_number", accessorKey: "plot_number", header: "Plot" },
    { id: "crop_label", accessorKey: "crop_label", header: "Crop" },
    { id: "quantity", header: "Qty", cell: ({ row }) => `${row.original.quantity_planted ?? "—"} ${row.original.quantity_unit || ""}` },
    { id: "status", accessorKey: "status", header: "Status",
      cell: ({ getValue }) => <Badge variant="secondary" className="capitalize">{String(getValue() ?? "")}</Badge> },
    { id: "expected_first_harvest", accessorKey: "expected_first_harvest", header: "First harvest",
      cell: ({ getValue }) => formatDate(getValue()) },
    { id: "is_continuous_harvest", header: "Continuous",
      cell: ({ row }) => row.original.is_continuous_harvest ? "Yes" : "—" },
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
    <>
      <DataTable
        data={data} columns={columns} searchKeys={["plot_number", "crop_label", "status"]}
        searchPlaceholder="Search sowings..." csvFilename="sowing"
        toolbar={canEdit && <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5 mr-1" /> Record sowing</Button>}
        emptyMessage="No sowings recorded yet."
      />
      {(adding || editing) && (
        <SowingFormDialog open onOpenChange={(v) => { if (!v) { setAdding(false); setEditing(null); } }}
                          initial={editing} farmId={farmId} />
      )}
      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this sowing record?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => delMut.mutate(confirmDel.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ===== HARVEST =====
function HarvestTab({ farmId, rows, canEdit }: { farmId: string; rows: any[]; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const qc = useQueryClient();
  const del = useServerFn(deleteHarvest);
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["harvest", farmId] }); setConfirmDel(null); toast.success("Harvest deleted"); },
  });

  const data = rows.map((r) => ({
    ...r,
    plot_number: r.plots?.plot_number,
    crop_label: `${r.crops?.crop_name || ""} — ${r.crops?.variety_name || ""}`,
  }));

  const columns: ColumnDef<any>[] = [
    { id: "harvest_date", accessorKey: "harvest_date", header: "Date",
      cell: ({ getValue }) => formatDate(getValue()) },
    { id: "plot_number", accessorKey: "plot_number", header: "Plot" },
    { id: "crop_label", accessorKey: "crop_label", header: "Crop" },
    { id: "quantity_harvested", accessorKey: "quantity_harvested", header: "Qty (kg)" },
    { id: "quality_grade", accessorKey: "quality_grade", header: "Grade" },
    { id: "harvest_sequence_number", accessorKey: "harvest_sequence_number", header: "Pick #" },
    { id: "estimated_remaining_yield", accessorKey: "estimated_remaining_yield", header: "Remaining (kg)" },
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
    <>
      <DataTable
        data={data} columns={columns} searchKeys={["plot_number", "crop_label"]}
        searchPlaceholder="Search harvests..." csvFilename="harvest"
        toolbar={canEdit && <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5 mr-1" /> Record harvest</Button>}
        emptyMessage="No harvests recorded yet."
      />
      {(adding || editing) && (
        <HarvestFormDialog open onOpenChange={(v) => { if (!v) { setAdding(false); setEditing(null); } }}
                           initial={editing} farmId={farmId} />
      )}
      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this harvest record?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => delMut.mutate(confirmDel.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ===== RESOURCES =====
function ResourcesTab({ farmId, rows, canEdit }: { farmId: string; rows: any[]; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const qc = useQueryClient();
  const del = useServerFn(deleteResource);
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["resources", farmId] }); setConfirmDel(null); toast.success("Resource deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = rows.map((r) => ({
    ...r,
    plot_number: r.plots?.plot_number ?? "—",
    start_local: r.start_time ? formatDateTime(r.start_time) : "",
    end_local: r.end_time ? formatDateTime(r.end_time) : "",
    qty_label: r.quantity != null ? `${r.quantity} ${r.unit || ""}`.trim() : "—",
  }));

  const columns: ColumnDef<any>[] = [
    { id: "start_local", accessorKey: "start_local", header: "Start" },
    { id: "end_local", accessorKey: "end_local", header: "End" },
    { id: "resource_name", accessorKey: "resource_name", header: "Resource" },
    { id: "resource_type", accessorKey: "resource_type", header: "Type",
      cell: ({ getValue }) => <Badge variant="secondary" className="capitalize">{String(getValue() ?? "")}</Badge> },
    { id: "qty_label", accessorKey: "qty_label", header: "Qty" },
    { id: "plot_number", accessorKey: "plot_number", header: "Plot" },
    { id: "used_for", accessorKey: "used_for", header: "Used for",
      cell: ({ row }) => <span className="line-clamp-1 max-w-xs">{row.original.used_for}</span> },
    { id: "notes", accessorKey: "notes", header: "Notes",
      cell: ({ row }) => <span className="line-clamp-1 max-w-xs">{row.original.notes}</span> },
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
    <>
      <DataTable
        data={data} columns={columns} searchKeys={["resource_name", "resource_type", "plot_number", "used_for"]}
        searchPlaceholder="Search resources..." csvFilename="resources"
        toolbar={canEdit && <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5 mr-1" /> Record resource</Button>}
        emptyMessage="No resources recorded yet."
      />
      {(adding || editing) && (
        <ResourceFormDialog open onOpenChange={(v) => { if (!v) { setAdding(false); setEditing(null); } }}
                            initial={editing} farmId={farmId} />
      )}
      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this resource record?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => delMut.mutate(confirmDel.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
