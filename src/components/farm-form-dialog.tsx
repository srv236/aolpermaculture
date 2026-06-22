import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmMap } from "@/components/farm-map";
import { upsertFarm } from "@/lib/farm.functions";
import { centroid, parseWkt } from "@/lib/google-maps";
import { toast } from "sonner";

export type FarmForm = {
  id?: string;
  name: string;
  farming_type?: string;
  total_acreage?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  geopolygon?: string | null;
  state?: string;
  district?: string;
  owner_name?: string;
  contact_email?: string;
  contact_phone?: string;
  established_year?: number | null;
  notes?: string;
  is_active?: boolean;
};

export function FarmFormDialog({
  open, onOpenChange, initial,
}: { open: boolean; onOpenChange: (v: boolean) => void; initial?: FarmForm | null }) {
  const [f, setF] = useState<FarmForm>(() => initial || { name: "" });
  const qc = useQueryClient();
  const upsert = useServerFn(upsertFarm);
  const mut = useMutation({
    mutationFn: (vals: FarmForm) => upsert({ data: { id: vals.id, values: stripId(vals) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farms"] });
      onOpenChange(false);
      toast.success(initial ? "Farm updated" : "Farm created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set<K extends keyof FarmForm>(k: K, v: FarmForm[K]) { setF((p) => ({ ...p, [k]: v })); }

  function onPolygonChange(wkt: string | null) {
    set("geopolygon", wkt);
    if (wkt) {
      const path = parseWkt(wkt);
      const c = path && centroid(path);
      if (c) { set("latitude", +c.lat.toFixed(6)); set("longitude", +c.lng.toFixed(6)); }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{initial ? "Edit farm" : "Add a farm"}</DialogTitle>
          <DialogDescription>Draw the farm boundary on the map and fill in the details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Farm name *" className="md:col-span-2">
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Farming type">
            <Select value={f.farming_type || ""} onValueChange={(v) => set("farming_type", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {["permaculture","organic","conventional","biodynamic","mixed","other"].map((x) => (
                  <SelectItem key={x} value={x}>{x}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Total acreage">
            <Input type="number" step="0.01" value={f.total_acreage ?? ""} onChange={(e) => set("total_acreage", e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="State">
            <Input value={f.state || ""} onChange={(e) => set("state", e.target.value)} />
          </Field>
          <Field label="District">
            <Input value={f.district || ""} onChange={(e) => set("district", e.target.value)} />
          </Field>
          <Field label="Owner name">
            <Input value={f.owner_name || ""} onChange={(e) => set("owner_name", e.target.value)} />
          </Field>
          <Field label="Contact email">
            <Input type="email" value={f.contact_email || ""} onChange={(e) => set("contact_email", e.target.value)} />
          </Field>
          <Field label="Contact phone">
            <Input value={f.contact_phone || ""} onChange={(e) => set("contact_phone", e.target.value)} />
          </Field>
          <Field label="Established year">
            <Input type="number" value={f.established_year ?? ""} onChange={(e) => set("established_year", e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <Textarea rows={2} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Label className="mb-2 block">Location & boundary</Label>
            <FarmMap value={f.geopolygon} onChange={onPolygonChange} height={360} />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Field label="Latitude"><Input type="number" step="0.000001" value={f.latitude ?? ""} onChange={(e) => set("latitude", e.target.value ? +e.target.value : null)} /></Field>
              <Field label="Longitude"><Input type="number" step="0.000001" value={f.longitude ?? ""} onChange={(e) => set("longitude", e.target.value ? +e.target.value : null)} /></Field>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={mut.isPending || !f.name} onClick={() => mut.mutate(f)}>
            {mut.isPending ? "Saving..." : "Save farm"}
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
