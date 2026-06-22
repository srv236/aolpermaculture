import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmMap } from "@/components/farm-map";
import { upsertPlot } from "@/lib/farm.functions";
import { toast } from "sonner";

export type PlotForm = {
  id?: string;
  farm_id: string;
  plot_number: string;
  acreage?: number | null;
  geopolygon?: string | null;
  soil_type?: string;
  irrigation_type?: string;
  elevation?: number | null;
  slope_percent?: number | null;
  aspect?: string;
  notes?: string;
};

export function PlotFormDialog({
  open, onOpenChange, initial, farmGeo, siblings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: PlotForm | null;
  farmGeo?: string | null;
  siblings?: Array<{ id: string; wkt: string; label: string }>;
}) {
  const [f, setF] = useState<PlotForm>(() => initial || { farm_id: "", plot_number: "" });
  const qc = useQueryClient();
  const upsert = useServerFn(upsertPlot);
  const mut = useMutation({
    mutationFn: (v: PlotForm) => upsert({ data: { id: v.id, values: stripId(v) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plots"] });
      onOpenChange(false);
      toast.success(initial?.id ? "Plot updated" : "Plot added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set<K extends keyof PlotForm>(k: K, v: PlotForm[K]) { setF((p) => ({ ...p, [k]: v })); }

  const overlays = [
    ...(farmGeo ? [{ wkt: farmGeo, color: "#f4d35e" }] : []),
    ...(siblings || []).filter((s) => s.id !== f.id).map((s) => ({ wkt: s.wkt, color: "#a3a3a3" })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{initial?.id ? "Edit plot" : "Add a plot"}</DialogTitle>
          <DialogDescription>Draw the plot's boundary inside the farm.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Plot number/name *">
            <Input value={f.plot_number} onChange={(e) => set("plot_number", e.target.value)} required />
          </Field>
          <Field label="Acreage">
            <Input type="number" step="0.001" value={f.acreage ?? ""} onChange={(e) => set("acreage", e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="Soil type">
            <Input value={f.soil_type || ""} onChange={(e) => set("soil_type", e.target.value)} />
          </Field>
          <Field label="Irrigation">
            <Select value={f.irrigation_type || ""} onValueChange={(v) => set("irrigation_type", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {["drip","sprinkler","flood","rain-fed","manual","other"].map((x) => (
                  <SelectItem key={x} value={x}>{x}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Elevation (m)">
            <Input type="number" step="0.1" value={f.elevation ?? ""} onChange={(e) => set("elevation", e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="Slope %">
            <Input type="number" step="0.1" value={f.slope_percent ?? ""} onChange={(e) => set("slope_percent", e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="Aspect">
            <Input value={f.aspect || ""} onChange={(e) => set("aspect", e.target.value)} placeholder="e.g. South-East" />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <Textarea rows={2} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Label className="mb-2 block">Plot boundary</Label>
            <FarmMap value={f.geopolygon} onChange={(w) => set("geopolygon", w)} overlays={overlays} height={340} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={mut.isPending || !f.plot_number} onClick={() => mut.mutate(f)}>
            {mut.isPending ? "Saving..." : "Save plot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function stripId<T extends { id?: string }>(v: T) {
  const { id, ...rest } = v;
  return rest;
}
