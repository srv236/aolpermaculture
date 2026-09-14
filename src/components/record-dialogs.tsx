import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { listCrops, listPlots, upsertSowing, upsertHarvest } from "@/lib/farm.functions";
import { toast } from "sonner";

type SowingForm = {
  id?: string;
  plot_id: string;
  variety_id: string;
  planting_date: string;
  quantity_planted?: number | null;
  quantity_unit?: string;
  seed_source?: string;
  expected_first_harvest?: string;
  expected_final_harvest?: string;
  status: "planned" | "active" | "completed" | "failed" | "abandoned";
  is_continuous_harvest?: boolean;
  estimated_harvest_interval_days?: number | null;
  is_replanting?: boolean;
  original_sowing_id?: string | null;
  area_utilized_percent?: number | null;
  notes?: string;
};

function sanitizeSowingValues(v: SowingForm): Record<string, any> {
  return {
    plot_id: v.plot_id,
    variety_id: v.variety_id,
    planting_date: v.planting_date,
    status: v.status || "planned",
    quantity_planted: v.quantity_planted != null && (v.quantity_planted as any) !== "" ? Number(v.quantity_planted) : null,
    quantity_unit: v.quantity_unit?.trim() || null,
    seed_source: v.seed_source?.trim() || null,
    expected_first_harvest: v.expected_first_harvest || null,
    expected_final_harvest: v.expected_final_harvest || null,
    is_continuous_harvest: Boolean(v.is_continuous_harvest),
    estimated_harvest_interval_days: v.estimated_harvest_interval_days != null && (v.estimated_harvest_interval_days as any) !== "" ? Number(v.estimated_harvest_interval_days) : null,
    is_replanting: Boolean(v.is_replanting),
    original_sowing_id: v.original_sowing_id || null,
    area_utilized_percent: v.area_utilized_percent != null && (v.area_utilized_percent as any) !== "" ? Number(v.area_utilized_percent) : null,
    notes: v.notes?.trim() || null,
  };
}

export function SowingFormDialog({
  open, onOpenChange, initial, farmId,
}: { open: boolean; onOpenChange: (v: boolean) => void; initial?: Partial<SowingForm> | null; farmId?: string }) {
  const [f, setF] = useState<SowingForm>(() => ({
    plot_id: "", variety_id: "", planting_date: new Date().toISOString().slice(0, 10),
    status: "planned", is_continuous_harvest: false, is_replanting: false, ...initial,
  }));
  const qc = useQueryClient();
  const listPlotsFn = useServerFn(listPlots);
  const listCropsFn = useServerFn(listCrops);
  const upsert = useServerFn(upsertSowing);
  const plots = useQuery({ queryKey: ["plots", farmId], queryFn: () => listPlotsFn({ data: { farmId } }) });
  const crops = useQuery({ queryKey: ["crops"], queryFn: () => listCropsFn() });

  const mut = useMutation({
    mutationFn: (v: SowingForm) => upsert({ data: { id: v.id, values: sanitizeSowingValues(v) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sowing"] });
      onOpenChange(false);
      toast.success(initial?.id ? "Sowing updated" : "Sowing recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set<K extends keyof SowingForm>(k: K, v: SowingForm[K]) { setF((p) => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{initial?.id ? "Edit sowing" : "Record a sowing"}</DialogTitle>
          <DialogDescription>What was planted, where, and when.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Plot *">
            <Select value={f.plot_id} onValueChange={(v) => set("plot_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select plot" /></SelectTrigger>
              <SelectContent>
                {plots.data?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.plot_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Crop variety *">
            <Select value={f.variety_id} onValueChange={(v) => set("variety_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select crop" /></SelectTrigger>
              <SelectContent>
                {crops.data?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.crop_name} — {c.variety_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Planting date *">
            <Input type="date" value={f.planting_date} onChange={(e) => set("planting_date", e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={f.status} onValueChange={(v) => set("status", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["planned","active","completed","failed","abandoned"].map((s) =>
                  <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Quantity planted">
            <Input type="number" step="0.01" value={f.quantity_planted ?? ""} onChange={(e) => set("quantity_planted", e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="Unit">
            <Input value={f.quantity_unit || ""} onChange={(e) => set("quantity_unit", e.target.value)} placeholder="g, kg, seeds" />
          </Field>
          <Field label="Seed source">
            <Input value={f.seed_source || ""} onChange={(e) => set("seed_source", e.target.value)} />
          </Field>
          <Field label="Area utilized %">
            <Input type="number" step="1" value={f.area_utilized_percent ?? ""} onChange={(e) => set("area_utilized_percent", e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="Expected first harvest">
            <Input type="date" value={f.expected_first_harvest || ""} onChange={(e) => set("expected_first_harvest", e.target.value)} />
          </Field>
          <Field label="Expected final harvest">
            <Input type="date" value={f.expected_final_harvest || ""} onChange={(e) => set("expected_final_harvest", e.target.value)} />
          </Field>
          <Field label="Continuous harvest" className="flex items-center justify-between">
            <Switch checked={f.is_continuous_harvest || false} onCheckedChange={(v) => set("is_continuous_harvest", v)} />
          </Field>
          {f.is_continuous_harvest && (
            <Field label="Harvest interval (days)">
              <Input type="number" value={f.estimated_harvest_interval_days ?? ""} onChange={(e) => set("estimated_harvest_interval_days", e.target.value ? +e.target.value : null)} />
            </Field>
          )}
          <Field label="Replanting" className="flex items-center justify-between">
            <Switch checked={f.is_replanting || false} onCheckedChange={(v) => set("is_replanting", v)} />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <Textarea rows={2} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={mut.isPending || !f.plot_id || !f.variety_id} onClick={() => mut.mutate(f)}>
            {mut.isPending ? "Saving..." : "Save sowing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- HARVEST ----------
type HarvestForm = {
  id?: string;
  plot_id: string;
  variety_id: string;
  sowing_id?: string | null;
  harvest_date: string;
  harvest_time_start?: string;
  harvest_time_end?: string;
  quantity_harvested: number;
  quality_grade?: string;
  harvest_sequence_number?: number | null;
  estimated_remaining_yield?: number | null;
  notes?: string;
};

function sanitizeHarvestValues(v: HarvestForm): Record<string, any> {
  return {
    plot_id: v.plot_id,
    variety_id: v.variety_id,
    sowing_id: v.sowing_id || null,
    harvest_date: v.harvest_date,
    harvest_time_start: v.harvest_time_start || null,
    harvest_time_end: v.harvest_time_end || null,
    quantity_harvested: Number(v.quantity_harvested) || 0,
    quality_grade: v.quality_grade || null,
    harvest_sequence_number: v.harvest_sequence_number != null && (v.harvest_sequence_number as any) !== "" ? Number(v.harvest_sequence_number) : null,
    estimated_remaining_yield: v.estimated_remaining_yield != null && (v.estimated_remaining_yield as any) !== "" ? Number(v.estimated_remaining_yield) : null,
    notes: v.notes?.trim() || null,
  };
}

export function HarvestFormDialog({
  open, onOpenChange, initial, farmId,
}: { open: boolean; onOpenChange: (v: boolean) => void; initial?: Partial<HarvestForm> | null; farmId?: string }) {
  const [f, setF] = useState<HarvestForm>(() => ({
    plot_id: "", variety_id: "", harvest_date: new Date().toISOString().slice(0, 10),
    quantity_harvested: 0, ...initial,
  }));
  const qc = useQueryClient();
  const listPlotsFn = useServerFn(listPlots);
  const listCropsFn = useServerFn(listCrops);
  const upsert = useServerFn(upsertHarvest);
  const plots = useQuery({ queryKey: ["plots", farmId], queryFn: () => listPlotsFn({ data: { farmId } }) });
  const crops = useQuery({ queryKey: ["crops"], queryFn: () => listCropsFn() });

  const mut = useMutation({
    mutationFn: (v: HarvestForm) => upsert({ data: { id: v.id, values: sanitizeHarvestValues(v) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["harvest"] });
      onOpenChange(false);
      toast.success(initial?.id ? "Harvest updated" : "Harvest recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set<K extends keyof HarvestForm>(k: K, v: HarvestForm[K]) { setF((p) => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{initial?.id ? "Edit harvest" : "Record a harvest"}</DialogTitle>
          <DialogDescription>What was harvested.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Plot *">
            <Select value={f.plot_id} onValueChange={(v) => set("plot_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select plot" /></SelectTrigger>
              <SelectContent>
                {plots.data?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.plot_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Crop variety *">
            <CropCombobox
              options={crops.data ?? []}
              value={f.variety_id}
              onChange={(v) => set("variety_id", v)}
              placeholder="Select crop"
            />
          </Field>
          <Field label="Harvest date *">
            <Input type="date" value={f.harvest_date} onChange={(e) => set("harvest_date", e.target.value)} />
          </Field>
          <Field label="Quality grade">
            <Select value={f.quality_grade || ""} onValueChange={(v) => set("quality_grade", v)}>
              <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
              <SelectContent>
                {["A","B","C","mixed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Start time">
            <Input type="time" value={f.harvest_time_start || ""} onChange={(e) => set("harvest_time_start", e.target.value)} />
          </Field>
          <Field label="End time">
            <Input type="time" value={f.harvest_time_end || ""} onChange={(e) => set("harvest_time_end", e.target.value)} />
          </Field>
          <Field label="Quantity (kg) *">
            <Input type="number" step="0.01" value={f.quantity_harvested ?? 0} onChange={(e) => set("quantity_harvested", e.target.value ? +e.target.value : 0)} />
          </Field>
          <Field label="Picking number">
            <Input type="number" value={f.harvest_sequence_number ?? ""} onChange={(e) => set("harvest_sequence_number", e.target.value ? +e.target.value : null)} placeholder="for continuous harvest" />
          </Field>
          <Field label="Estimated remaining yield (kg)">
            <Input type="number" step="0.01" value={f.estimated_remaining_yield ?? ""} onChange={(e) => set("estimated_remaining_yield", e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <Textarea rows={2} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={mut.isPending || !f.plot_id || !f.variety_id} onClick={() => mut.mutate(f)}>
            {mut.isPending ? "Saving..." : "Save harvest"}
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

function CropCombobox({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: any[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selected ? `${selected.crop_name} — ${selected.variety_name}` : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search crop..." />
          <CommandList>
            <CommandEmpty>No crop found.</CommandEmpty>
            <CommandGroup>
              {options.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.crop_name} ${c.variety_name} ${c.id}`}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === c.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {c.crop_name} — {c.variety_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function stripId<T extends { id?: string }>(v: T) { const { id, ...rest } = v; return rest; }
