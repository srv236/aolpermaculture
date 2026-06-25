import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listPlots } from "@/lib/farm.functions";
import { upsertResource } from "@/lib/resources.functions";
import { toast } from "sonner";

const RESOURCE_TYPES = ["equipment", "labor", "material", "water", "biological", "energy", "other"] as const;
const COMMON_UNITS = ["nos", "litres", "kilogram", "grams", "hours", "kWh", "metres", "bags"];

type Form = {
  id?: string;
  farm_id: string;
  plot_id?: string | null;
  resource_name: string;
  resource_type: typeof RESOURCE_TYPES[number];
  quantity?: number | null;
  unit?: string;
  used_for?: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
};

function toLocal(dt?: string | null) {
  if (!dt) return "";
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ResourceFormDialog({
  open, onOpenChange, initial, farmId,
}: { open: boolean; onOpenChange: (v: boolean) => void; initial?: Partial<Form> | null; farmId: string }) {
  const [f, setF] = useState<Form>(() => ({
    farm_id: farmId,
    resource_name: "",
    resource_type: "equipment",
    plot_id: null,
    ...initial,
    start_time: toLocal(initial?.start_time),
    end_time: toLocal(initial?.end_time),
  }));
  const qc = useQueryClient();
  const listPlotsFn = useServerFn(listPlots);
  const upsert = useServerFn(upsertResource);
  const plots = useQuery({ queryKey: ["plots", farmId], queryFn: () => listPlotsFn({ data: { farmId } }) });

  const mut = useMutation({
    mutationFn: (v: Form) => {
      const { id, ...rest } = v;
      const payload: any = { ...rest };
      payload.start_time = v.start_time ? new Date(v.start_time).toISOString() : null;
      payload.end_time = v.end_time ? new Date(v.end_time).toISOString() : null;
      if (!payload.plot_id) payload.plot_id = null;
      return upsert({ data: { id, values: payload } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources", farmId] });
      onOpenChange(false);
      toast.success(initial?.id ? "Resource updated" : "Resource recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set<K extends keyof Form>(k: K, v: Form[K]) { setF((p) => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{initial?.id ? "Edit resource" : "Record a resource"}</DialogTitle>
          <DialogDescription>What was used, where, and when.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Resource name *">
            <Input value={f.resource_name} onChange={(e) => set("resource_name", e.target.value)} placeholder="Tractor, Compost, Drip line..." />
          </Field>
          <Field label="Type *">
            <Select value={f.resource_type} onValueChange={(v) => set("resource_type", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Quantity">
            <Input type="number" step="0.01" value={f.quantity ?? ""} onChange={(e) => set("quantity", e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="Unit">
            <Input list="resource-units" value={f.unit || ""} onChange={(e) => set("unit", e.target.value)} placeholder="nos, litres, kilogram" />
            <datalist id="resource-units">
              {COMMON_UNITS.map((u) => <option key={u} value={u} />)}
            </datalist>
          </Field>
          <Field label="Plot">
            <Select value={f.plot_id || "__none"} onValueChange={(v) => set("plot_id", v === "__none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Whole farm" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Whole farm</SelectItem>
                {plots.data?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.plot_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Used for">
            <Input value={f.used_for || ""} onChange={(e) => set("used_for", e.target.value)} placeholder="Tilling north field, Irrigation cycle..." />
          </Field>
          <Field label="Start time">
            <Input type="datetime-local" value={f.start_time || ""} onChange={(e) => set("start_time", e.target.value)} />
          </Field>
          <Field label="End time">
            <Input type="datetime-local" value={f.end_time || ""} onChange={(e) => set("end_time", e.target.value)} />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <Textarea rows={2} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={mut.isPending || !f.resource_name.trim()} onClick={() => mut.mutate(f)}>
            {mut.isPending ? "Saving..." : "Save"}
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
