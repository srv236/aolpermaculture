import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, useMe } from "@/components/app-shell";
import { listFarms, listPlots, listCrops } from "@/lib/farm.functions";
import { listBedPlans, upsertBedPlan, deleteBedPlan } from "@/lib/planning.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BedPlanner } from "@/components/bed-planner";
import { defaultBedConfig, type BedConfig } from "@/lib/bed-plan";

export const Route = createFileRoute("/_authenticated/planning")({
  component: PlanningPage,
});

function PlanningPage() {
  const me = useMe();
  const canEdit = me.data?.roles.some((r) => r === "admin" || r === "editor");

  const farmsFn = useServerFn(listFarms);
  const plotsFn = useServerFn(listPlots);
  const cropsFn = useServerFn(listCrops);
  const bedsFn = useServerFn(listBedPlans);
  const saveFn = useServerFn(upsertBedPlan);
  const delFn = useServerFn(deleteBedPlan);
  const qc = useQueryClient();

  const farms = useQuery({ queryKey: ["farms"], queryFn: () => farmsFn() });
  const crops = useQuery({ queryKey: ["crops"], queryFn: () => cropsFn() });

  const [farmId, setFarmId] = useState<string>("");
  useEffect(() => {
    if (!farmId && farms.data?.[0]) setFarmId(farms.data[0].id);
  }, [farms.data, farmId]);

  const plots = useQuery({
    queryKey: ["plots", farmId],
    queryFn: () => plotsFn({ data: { farmId } }),
    enabled: !!farmId,
  });

  const [plotId, setPlotId] = useState<string>("");
  useEffect(() => {
    if (plots.data && plots.data.length && !plots.data.find((p) => p.id === plotId)) {
      setPlotId(plots.data[0].id);
    }
    if (plots.data && plots.data.length === 0) setPlotId("");
  }, [plots.data, plotId]);

  const beds = useQuery({
    queryKey: ["bed_plans", plotId],
    queryFn: () => bedsFn({ data: { plotId } }),
    enabled: !!plotId,
  });

  const [activeBedId, setActiveBedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id?: string; name: string; config: BedConfig } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!beds.data) return;
    if (beds.data.length === 0) {
      setActiveBedId(null);
      setDraft(null);
      return;
    }
    const target = beds.data.find((b) => b.id === activeBedId) ?? beds.data[0];
    setActiveBedId(target.id);
    setDraft({
      id: target.id,
      name: target.name,
      config: (target.config as any) && Object.keys(target.config as any).length
        ? (target.config as BedConfig)
        : defaultBedConfig(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beds.data, activeBedId]);

  const save = useMutation({
    mutationFn: (input: { id?: string; values: Record<string, any> }) => saveFn({ data: input }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["bed_plans", plotId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      setConfirmDelete(null);
      setActiveBedId(null);
      qc.invalidateQueries({ queryKey: ["bed_plans", plotId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function addBed() {
    if (!plotId) return;
    const idx = (beds.data?.length ?? 0) + 1;
    save.mutate({
      values: { plot_id: plotId, name: `Bed ${idx}`, config: defaultBedConfig() },
    });
  }

  const activePlot = plots.data?.find((p) => p.id === plotId);
  const activeFarm = farms.data?.find((f) => f.id === farmId);

  return (
    <AppShell>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <header>
          <h1 className="font-serif text-2xl">Farm Planning</h1>
          <p className="text-sm text-muted-foreground">
            Design bed layouts per plot — template, cycle, and export a printable plan.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Farm</Label>
            <Select value={farmId} onValueChange={(v) => { setFarmId(v); setActiveBedId(null); }}>
              <SelectTrigger><SelectValue placeholder="Select farm" /></SelectTrigger>
              <SelectContent>
                {(farms.data ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Plot</Label>
            <Select value={plotId} onValueChange={(v) => { setPlotId(v); setActiveBedId(null); }}>
              <SelectTrigger><SelectValue placeholder="Select plot" /></SelectTrigger>
              <SelectContent>
                {(plots.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    Plot {p.plot_number}{p.name ? ` — ${p.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            {canEdit && (
              <Button onClick={addBed} disabled={!plotId || save.isPending} className="w-full">
                <Plus className="size-4 mr-1" /> Add bed
              </Button>
            )}
          </div>
        </div>

        {!plotId && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select a farm and plot to start planning beds.
          </CardContent></Card>
        )}

        {plotId && (beds.data?.length ?? 0) === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            No beds yet for this plot. {canEdit && <>Click <b>Add bed</b> to create one.</>}
          </CardContent></Card>
        )}

        {plotId && (beds.data?.length ?? 0) > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-6">
            <aside className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Beds</div>
              {(beds.data ?? []).map((b) => (
                <button
                  key={b.id}
                  onClick={() => setActiveBedId(b.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm border transition ${
                    activeBedId === b.id ? "bg-primary/10 border-primary" : "bg-card hover:bg-muted"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </aside>

            <div className="min-w-0">
              {draft && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {canEdit ? (
                        <Input
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          className="h-9 font-semibold max-w-xs"
                        />
                      ) : (
                        <CardTitle>{draft.name}</CardTitle>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() =>
                            save.mutate({
                              id: draft.id,
                              values: { name: draft.name, config: draft.config as any },
                            })
                          }
                          disabled={save.isPending}
                        >
                          <Save className="size-4 mr-1" /> Save
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => draft.id && setConfirmDelete(draft.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <BedPlanner
                      value={draft.config}
                      onChange={(config) => setDraft({ ...draft, config })}
                      crops={(crops.data ?? []) as any}
                      bedName={draft.name}
                      plotLabel={
                        activeFarm && activePlot
                          ? `${activeFarm.name} — Plot ${activePlot.plot_number}${activePlot.name ? ` (${activePlot.name})` : ""}`
                          : undefined
                      }
                      readOnly={!canEdit}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete this bed plan?</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmDelete && remove.mutate(confirmDelete)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
