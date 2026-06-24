import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFarms } from "@/lib/farm.functions";
import { listWorkers } from "@/lib/workers.functions";
import {
  listAttendance,
  upsertAttendance,
  bulkMarkPresent,
  listVisitors,
  upsertVisitor,
  deleteVisitor,
} from "@/lib/attendance.functions";
import { AppShell, useMe } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCheck, Download, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const STATUS: { value: string; label: string; short: string; cls: string }[] = [
  { value: "present", label: "Present", short: "P", cls: "bg-[#D4E8D4] text-[#1B3022] ring-[#1B3022]/15" },
  { value: "absent", label: "Absent", short: "A", cls: "bg-[#F8D7DA] text-[#721C24] ring-[#721C24]/15" },
  { value: "half_day", label: "Half day", short: "H", cls: "bg-[#FFF3CD] text-[#856404] ring-[#856404]/15" },
  { value: "leave", label: "On leave", short: "L", cls: "bg-[#E5EEF5] text-[#4A6D8C] ring-[#4A6D8C]/15" },
  { value: "holiday", label: "Holiday", short: "·", cls: "bg-muted text-muted-foreground ring-border" },
];
const statusMeta = (v?: string | null) => STATUS.find((s) => s.value === v);

const VISITOR_TYPES = [
  { value: "farmer", label: "Farmer" },
  { value: "government", label: "Government" },
  { value: "previous_sevak", label: "Previous Sevak" },
  { value: "students", label: "Students" },
  { value: "other", label: "Other" },
];
const visitorTypeLabel = (v: string) => VISITOR_TYPES.find((t) => t.value === v)?.label ?? v;

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function AttendancePage() {
  const me = useMe();
  const canEdit = me.data?.roles.some((r) => r === "admin" || r === "editor");

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1..12
  const [farmId, setFarmId] = useState<string | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<string>(ymd(today));

  const farmsFn = useServerFn(listFarms);
  const farms = useQuery({ queryKey: ["farms"], queryFn: () => farmsFn() });

  // default farm
  if (!farmId && farms.data?.length) {
    setFarmId(farms.data[0].id);
  }

  const workersFn = useServerFn(listWorkers);
  const workers = useQuery({ queryKey: ["workers"], queryFn: () => workersFn() });

  const attFn = useServerFn(listAttendance);
  const attendance = useQuery({
    queryKey: ["attendance", farmId, year, month],
    queryFn: () => attFn({ data: { farmId: farmId!, year, month } }),
    enabled: !!farmId,
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  // map (worker_id|date) -> row
  const lookup = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of attendance.data ?? []) m.set(`${r.worker_id}|${r.date}`, r);
    return m;
  }, [attendance.data]);

  const activeWorkers = useMemo(() => {
    const ws = (workers.data ?? []).filter((w: any) => {
      const start = w.start_date ?? null;
      const end = w.end_date ?? null;
      if (start && start > monthEnd) return false;
      if (end && end < monthStart) return false;
      return true;
    });
    return ws.sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
  }, [workers.data, monthStart, monthEnd]);

  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertAttendance);
  const upsertMut = useMutation({
    mutationFn: (v: { worker_id: string; date: string; status: string; notes?: string | null }) =>
      upsertFn({ data: { ...v, farm_id: farmId! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", farmId, year, month] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkFn = useServerFn(bulkMarkPresent);
  const bulkMut = useMutation({
    mutationFn: (date: string) =>
      bulkFn({ data: { farm_id: farmId!, date, worker_ids: activeWorkers.map((w: any) => w.id) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", farmId, year, month] });
      toast.success("Marked all present");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportCsv() {
    const rows: any[] = [];
    for (const w of activeWorkers) {
      for (const d of days) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const rec = lookup.get(`${w.id}|${date}`);
        rows.push({
          sevak: w.full_name,
          sevak_id: w.worker_code ?? "",
          role: w.role ?? "",
          date,
          status: rec?.status ?? "",
          notes: rec?.notes ?? "",
        });
      }
    }
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const farmName = farms.data?.find((f: any) => f.id === farmId)?.name;

  return (
    <AppShell>
      <div className="p-8 max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-3xl">Attendance</h1>
            <p className="text-sm text-muted-foreground mt-1">Daily sevak presence and farm visitors</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Farm</Label>
              <Select value={farmId} onValueChange={(v) => setFarmId(v)}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select farm" /></SelectTrigger>
                <SelectContent>
                  {(farms.data ?? []).map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {new Date(2000, m - 1, 1).toLocaleString("default", { month: "long" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, i) => today.getFullYear() - 3 + i).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="size-3.5 mr-1.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
          {STATUS.map((s) => (
            <div key={s.value} className="flex items-center gap-1.5">
              <span className={cn("inline-flex w-5 h-5 rounded-full ring-1 items-center justify-center text-[10px] font-bold", s.cls)}>
                {s.short}
              </span>
              {s.label}
            </div>
          ))}
          <div className="ml-auto italic">Click any cell to set status & add a note</div>
        </div>

        {/* Grid */}
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="overflow-auto max-h-[60vh]">
            <table className="border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-muted/60 backdrop-blur border-b border-r px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[220px]">
                    Sevak
                  </th>
                  {days.map((d) => {
                    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const dow = new Date(year, month - 1, d).getDay();
                    const weekend = dow === 0 || dow === 6;
                    return (
                      <th
                        key={d}
                        className={cn(
                          "border-b border-r px-1 py-2 text-center min-w-[44px] bg-muted/60 backdrop-blur",
                          weekend && "bg-muted",
                          dateStr === selectedDate && "bg-primary/10",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedDate(dateStr)}
                          className="block w-full"
                          title="Select day for visitors"
                        >
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(year, month - 1, d).toLocaleDateString("default", { weekday: "short" }).slice(0, 2)}
                          </div>
                          <div className="text-xs font-semibold">{String(d).padStart(2, "0")}</div>
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => bulkMut.mutate(dateStr)}
                            className="mt-1 text-muted-foreground/60 hover:text-primary"
                            title="Mark all present"
                          >
                            <CheckCheck className="size-3 mx-auto" />
                          </button>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {activeWorkers.length === 0 && (
                  <tr>
                    <td colSpan={days.length + 1} className="text-center text-muted-foreground italic py-10">
                      No sevaks active in this month. Add one in the Sevaks tab.
                    </td>
                  </tr>
                )}
                {activeWorkers.map((w: any) => (
                  <tr key={w.id} className="group">
                    <th className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 border-b border-r px-4 py-3 text-left font-medium align-top">
                      <div className="text-sm">{w.full_name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {w.role && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{w.role}</span>}
                      </div>
                    </th>
                    {days.map((d) => {
                      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                      const rec = lookup.get(`${w.id}|${dateStr}`);
                      const meta = statusMeta(rec?.status);
                      const dow = new Date(year, month - 1, d).getDay();
                      const weekend = dow === 0 || dow === 6;
                      return (
                        <td
                          key={d}
                          className={cn(
                            "border-b border-r p-1 text-center",
                            weekend && "bg-muted/30",
                            dateStr === selectedDate && "bg-primary/5",
                          )}
                        >
                          <AttendanceCell
                            disabled={!canEdit}
                            current={rec}
                            onSave={(status, notes) =>
                              upsertMut.mutate({ worker_id: w.id, date: dateStr, status, notes })
                            }
                          >
                            <button
                              type="button"
                              className={cn(
                                "relative w-7 h-7 mx-auto rounded-full ring-1 flex items-center justify-center text-[10px] font-bold transition hover:scale-110",
                                meta?.cls ?? "bg-background ring-border text-muted-foreground/40",
                              )}
                            >
                              {meta?.short ?? "·"}
                              {rec?.notes && (
                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-foreground/70" />
                              )}
                            </button>
                          </AttendanceCell>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Visitors */}
        <VisitorsPanel
          farmId={farmId}
          farmName={farmName}
          date={selectedDate}
          canEdit={!!canEdit}
        />
      </div>
    </AppShell>
  );
}

function AttendanceCell({
  children, current, onSave, disabled,
}: {
  children: React.ReactNode;
  current?: any;
  onSave: (status: string, notes: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>(current?.status ?? "present");
  const [notes, setNotes] = useState<string>(current?.notes ?? "");

  if (disabled) return <>{children}</>;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setStatus(current?.status ?? "present");
          setNotes(current?.notes ?? "");
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Status</div>
        <div className="grid grid-cols-3 gap-1 mb-3">
          {STATUS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={cn(
                "px-2 py-1.5 rounded text-[11px] font-medium ring-1 transition",
                s.cls,
                status === s.value ? "ring-2 ring-foreground/40 scale-105" : "opacity-60 hover:opacity-100",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Note</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional — e.g. left early, unwell, training"
          className="mt-1 text-xs"
        />
        <div className="flex justify-end mt-3">
          <Button
            size="sm"
            onClick={() => {
              onSave(status, notes.trim() ? notes.trim() : null);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function VisitorsPanel({
  farmId, farmName, date, canEdit,
}: { farmId?: string; farmName?: string; date: string; canEdit: boolean }) {
  const fn = useServerFn(listVisitors);
  const visitors = useQuery({
    queryKey: ["visitors", farmId, date],
    queryFn: () => fn({ data: { farmId: farmId!, date } }),
    enabled: !!farmId,
  });
  const [editing, setEditing] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any>(null);

  const delFn = useServerFn(deleteVisitor);
  const qc = useQueryClient();
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visitors", farmId, date] });
      setConfirmDel(null);
      toast.success("Visitor removed");
    },
  });

  const niceDate = new Date(date + "T00:00:00").toLocaleDateString("default", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-serif text-2xl flex items-center gap-2">
            <Users className="size-5 text-primary" /> Visitors
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {farmName ? `${farmName} — ` : ""}{niceDate}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setAdding(true)} disabled={!farmId}>
            <Plus className="size-3.5 mr-1" /> Log visitor
          </Button>
        )}
      </div>

      {visitors.data?.length === 0 && (
        <div className="border border-dashed rounded-xl py-10 text-center text-muted-foreground italic">
          No visitors logged for this day.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {(visitors.data ?? []).map((v: any) => (
          <div key={v.id} className="bg-card border rounded-xl p-4 flex flex-col group">
            <div className="flex items-start justify-between mb-2">
              <Badge variant="secondary">{visitorTypeLabel(v.visitor_type)}</Badge>
              <span className="font-serif italic text-lg text-primary">×{v.count}</span>
            </div>
            <div className="font-medium">{v.visitor_name}</div>
            {v.description && (
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{v.description}</p>
            )}
            {canEdit && (
              <div className="flex justify-end gap-1 mt-auto pt-3 opacity-0 group-hover:opacity-100 transition">
                <Button size="sm" variant="ghost" onClick={() => setEditing(v)}><Pencil className="size-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDel(v)}><Trash2 className="size-3.5" /></Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {(adding || editing) && farmId && (
        <VisitorDialog
          open
          onOpenChange={(v) => { if (!v) { setAdding(false); setEditing(null); } }}
          initial={editing}
          farmId={farmId}
          date={date}
        />
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove visitor entry?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => delMut.mutate(confirmDel.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function VisitorDialog({
  open, onOpenChange, initial, farmId, date,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  initial?: any; farmId: string; date: string;
}) {
  const [f, setF] = useState(() => initial || {
    visitor_name: "", visitor_type: "farmer", count: 1, description: "",
  });
  const upsert = useServerFn(upsertVisitor);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => {
      const { id, created_at, updated_at, ...rest } = f;
      const values = { ...rest, farm_id: farmId, date, count: Number(rest.count) || 1 };
      return upsert({ data: { id, values } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visitors", farmId, date] });
      onOpenChange(false);
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  function set(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{initial ? "Edit visitor" : "Log a visitor"}</DialogTitle>
          <DialogDescription>Anyone who came to the farm today — farmers, officials, students, returning sevaks.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div><Label>Name / group *</Label><Input value={f.visitor_name} onChange={(e) => set("visitor_name", e.target.value)} placeholder="e.g. Krishi Vigyan Kendra team" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type *</Label>
              <Select value={f.visitor_type} onValueChange={(v) => set("visitor_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VISITOR_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Number of people</Label><Input type="number" min={1} value={f.count} onChange={(e) => set("count", e.target.value)} /></div>
          </div>
          <div><Label>Description</Label><Textarea rows={3} value={f.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="Purpose of visit, notes…" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !f.visitor_name}>
            {mut.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
