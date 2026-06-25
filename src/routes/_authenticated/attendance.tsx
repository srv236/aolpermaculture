import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFarms } from "@/lib/farm.functions";
import { listWorkers } from "@/lib/workers.functions";
import {
  listAttendance,
  upsertAttendance,
  bulkMarkPresent,
  bulkUpsertAttendance,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCheck, ChevronLeft, ChevronRight, Download, Pencil, Plus, Trash2, Users, Keyboard } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const STATUS: { value: string; label: string; short: string; key: string; cls: string }[] = [
  { value: "present", label: "Present", short: "P", key: "p", cls: "bg-[#D4E8D4] text-[#1B3022] ring-[#1B3022]/15" },
  { value: "absent", label: "Absent", short: "A", key: "a", cls: "bg-[#F8D7DA] text-[#721C24] ring-[#721C24]/15" },
  { value: "half_day", label: "Half day", short: "H", key: "h", cls: "bg-[#FFF3CD] text-[#856404] ring-[#856404]/15" },
  { value: "leave", label: "On leave", short: "L", key: "l", cls: "bg-[#E5EEF5] text-[#4A6D8C] ring-[#4A6D8C]/15" },
  { value: "holiday", label: "Holiday", short: "·", key: "o", cls: "bg-muted text-muted-foreground ring-border" },
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
  const [farmId, setFarmId] = useState<string | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<string>(ymd(today));
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const farmsFn = useServerFn(listFarms);
  const farms = useQuery({ queryKey: ["farms"], queryFn: () => farmsFn() });

  useEffect(() => {
    if (!farmId && farms.data?.length) setFarmId(farms.data[0].id);
  }, [farmId, farms.data]);

  const workersFn = useServerFn(listWorkers);
  const workers = useQuery({ queryKey: ["workers"], queryFn: () => workersFn() });

  const farmName = farms.data?.find((f: any) => f.id === farmId)?.name;

  return (
    <AppShell>
      <div className="p-8 max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-3xl">Attendance</h1>
            <p className="text-sm text-muted-foreground mt-1">Daily sevak presence and farm visitors</p>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Farm</Label>
            <Select value={farmId} onValueChange={(v) => setFarmId(v)}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select farm" /></SelectTrigger>
              <SelectContent>
                {(farms.data ?? []).map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="monthly">Monthly grid</TabsTrigger>
            <TabsTrigger value="visitors">Visitors</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-6">
            <DailyView
              farmId={farmId}
              workers={workers.data ?? []}
              date={selectedDate}
              setDate={setSelectedDate}
              canEdit={!!canEdit}
            />
          </TabsContent>

          <TabsContent value="monthly" className="mt-6">
            <MonthlyGrid
              farmId={farmId}
              workers={workers.data ?? []}
              year={year}
              month={month}
              setYear={setYear}
              setMonth={setMonth}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              canEdit={!!canEdit}
            />
          </TabsContent>

          <TabsContent value="visitors" className="mt-6">
            <VisitorsPanel
              farmId={farmId}
              farmName={farmName}
              date={selectedDate}
              setDate={setSelectedDate}
              canEdit={!!canEdit}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/* ---------- DAILY VIEW ---------- */

function DailyView({
  farmId, workers, date, setDate, canEdit,
}: {
  farmId?: string; workers: any[]; date: string;
  setDate: (d: string) => void; canEdit: boolean;
}) {
  const activeWorkers = useMemo(() => {
    return workers
      .filter((w: any) => {
        if (w.start_date && w.start_date > date) return false;
        if (w.end_date && w.end_date < date) return false;
        return true;
      })
      .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
  }, [workers, date]);

  // attendance for the month containing this date
  const d = new Date(date + "T00:00:00");
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  const attFn = useServerFn(listAttendance);
  const attendance = useQuery({
    queryKey: ["attendance", farmId, year, month],
    queryFn: () => attFn({ data: { farmId: farmId!, year, month } }),
    enabled: !!farmId,
  });
  const lookup = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of attendance.data ?? []) if (r.date === date) m.set(r.worker_id, r);
    return m;
  }, [attendance.data, date]);

  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertAttendance);
  const upsertMut = useMutation({
    mutationFn: (v: { worker_id: string; status: string; notes?: string | null; work_done?: string | null }) =>
      upsertFn({ data: { ...v, farm_id: farmId!, date } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", farmId, year, month] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkFn = useServerFn(bulkUpsertAttendance);
  const bulkMut = useMutation({
    mutationFn: (v: { worker_ids: string[]; status: string }) =>
      bulkFn({ data: { farm_id: farmId!, date, ...v } }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["attendance", farmId, year, month] });
      toast.success(`Marked ${v.worker_ids.length} sevak${v.worker_ids.length === 1 ? "" : "s"} ${statusMeta(v.status)?.label.toLowerCase()}`);
      setSelected(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === activeWorkers.length) setSelected(new Set());
    else setSelected(new Set(activeWorkers.map((w) => w.id)));
  };

  // Keyboard: P/A/H/L/O sets status on selected (or focused) row(s)
  useEffect(() => {
    if (!canEdit) return;
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      const status = STATUS.find((s) => s.key === e.key.toLowerCase());
      if (!status) return;
      let ids: string[] = [];
      if (selected.size > 0) ids = Array.from(selected);
      else if (focusedIdx >= 0 && activeWorkers[focusedIdx]) ids = [activeWorkers[focusedIdx].id];
      if (!ids.length) return;
      e.preventDefault();
      if (ids.length === 1) {
        upsertMut.mutate({ worker_id: ids[0], status: status.value });
      } else {
        bulkMut.mutate({ worker_ids: ids, status: status.value });
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, focusedIdx, activeWorkers, canEdit, upsertMut, bulkMut]);

  function shiftDate(delta: number) {
    const nd = new Date(date + "T00:00:00");
    nd.setDate(nd.getDate() + delta);
    setDate(ymd(nd));
  }

  const niceDate = new Date(date + "T00:00:00").toLocaleDateString("default", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const w of activeWorkers) {
      const s = lookup.get(w.id)?.status;
      if (s) c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [activeWorkers, lookup]);

  return (
    <div ref={containerRef}>
      {/* Date header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}><ChevronLeft className="size-4" /></Button>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[170px]"
          />
          <Button variant="outline" size="icon" onClick={() => shiftDate(1)}><ChevronRight className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(ymd(new Date()))}>Today</Button>
        </div>
        <div className="text-sm text-muted-foreground italic">{niceDate}</div>
      </div>

      {/* Summary chips + keyboard hint */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {STATUS.map((s) => (
          <span key={s.value} className={cn("inline-flex items-center gap-1.5 rounded-full ring-1 px-2.5 py-1 text-xs", s.cls)}>
            <span className="font-bold">{s.short}</span>
            {s.label} · {counts[s.value] ?? 0}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Keyboard className="size-3.5" /> select rows then press <kbd className="px-1 border rounded">P</kbd> <kbd className="px-1 border rounded">A</kbd> <kbd className="px-1 border rounded">H</kbd> <kbd className="px-1 border rounded">L</kbd> <kbd className="px-1 border rounded">O</kbd>
        </span>
      </div>

      {/* Bulk bar */}
      {canEdit && selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm font-medium ml-2">{selected.size} selected</span>
          <div className="flex flex-wrap gap-1 ml-2">
            {STATUS.map((s) => (
              <Button
                key={s.value}
                size="sm"
                variant="outline"
                className={cn("h-7", s.cls)}
                onClick={() => bulkMut.mutate({ worker_ids: Array.from(selected), status: s.value })}
              >
                {s.short} · {s.label}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* List */}
      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        {canEdit && activeWorkers.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 border-b text-xs text-muted-foreground">
            <Checkbox
              checked={selected.size === activeWorkers.length && activeWorkers.length > 0}
              onCheckedChange={toggleAll}
            />
            <span>Select all</span>
            <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => bulkMut.mutate({ worker_ids: activeWorkers.map((w) => w.id), status: "present" })}>
              <CheckCheck className="size-3.5 mr-1" /> Mark all present
            </Button>
          </div>
        )}
        {activeWorkers.length === 0 && (
          <div className="text-center text-muted-foreground italic py-12">
            No sevaks active on this date. Add one in the Sevaks tab.
          </div>
        )}
        <ul className="divide-y">
          {activeWorkers.map((w, idx) => {
            const rec = lookup.get(w.id);
            return (
              <DailyRow
                key={w.id}
                worker={w}
                rec={rec}
                checked={selected.has(w.id)}
                onCheck={() => toggle(w.id)}
                focused={focusedIdx === idx}
                onFocus={() => setFocusedIdx(idx)}
                canEdit={canEdit}
                onStatus={(status) => upsertMut.mutate({ worker_id: w.id, status })}
                onDetail={(v) => upsertMut.mutate({ worker_id: w.id, status: rec?.status ?? "present", ...v })}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function DailyRow({
  worker, rec, checked, onCheck, focused, onFocus, canEdit, onStatus, onDetail,
}: {
  worker: any; rec?: any;
  checked: boolean; onCheck: () => void;
  focused: boolean; onFocus: () => void;
  canEdit: boolean;
  onStatus: (s: string) => void;
  onDetail: (v: { notes?: string | null; work_done?: string | null }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [work, setWork] = useState(rec?.work_done ?? "");
  const [notes, setNotes] = useState(rec?.notes ?? "");
  useEffect(() => { setWork(rec?.work_done ?? ""); setNotes(rec?.notes ?? ""); }, [rec?.work_done, rec?.notes]);

  const meta = statusMeta(rec?.status);
  return (
    <li
      tabIndex={0}
      onFocus={onFocus}
      className={cn(
        "px-4 py-3 outline-none transition",
        focused && "bg-primary/5 ring-1 ring-inset ring-primary/30",
        checked && "bg-primary/[0.04]",
      )}
    >
      <div className="flex items-center gap-3">
        {canEdit && (
          <Checkbox checked={checked} onCheckedChange={onCheck} onClick={(e) => e.stopPropagation()} />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{worker.full_name}</div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
            {worker.role || worker.worker_type?.replace(/_/g, " ")}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {STATUS.map((s) => (
            <button
              key={s.value}
              type="button"
              disabled={!canEdit}
              onClick={() => onStatus(s.value)}
              title={`${s.label} (${s.key.toUpperCase()})`}
              className={cn(
                "w-8 h-8 rounded-full ring-1 flex items-center justify-center text-[11px] font-bold transition",
                s.cls,
                rec?.status === s.value ? "scale-110 ring-2 ring-foreground/40" : "opacity-50 hover:opacity-100",
              )}
            >
              {s.short}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="ml-2"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Hide" : (rec?.work_done || rec?.notes) ? "Details ✓" : "Details"}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 ml-7 grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Work done today</Label>
            <Textarea
              rows={2}
              value={work}
              onChange={(e) => setWork(e.target.value)}
              onBlur={() => {
                if ((rec?.work_done ?? "") !== work) onDetail({ work_done: work.trim() || null });
              }}
              placeholder="e.g. weeding tomato bed, watered orchard…"
              disabled={!canEdit}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if ((rec?.notes ?? "") !== notes) onDetail({ notes: notes.trim() || null });
              }}
              placeholder="e.g. left early, unwell, training"
              disabled={!canEdit}
              className="text-sm"
            />
          </div>
        </div>
      )}

      {!expanded && (rec?.work_done || rec?.notes) && (
        <div className="ml-7 mt-1 text-xs text-muted-foreground truncate">
          {rec.work_done && <span><span className="font-medium text-foreground/70">Work:</span> {rec.work_done}</span>}
          {rec.work_done && rec.notes && <span> · </span>}
          {rec.notes && <span className="italic">{rec.notes}</span>}
        </div>
      )}
      {meta && <span className="sr-only">{meta.label}</span>}
    </li>
  );
}

/* ---------- MONTHLY GRID ---------- */

function MonthlyGrid({
  farmId, workers, year, month, setYear, setMonth, selectedDate, setSelectedDate, canEdit,
}: {
  farmId?: string; workers: any[];
  year: number; month: number;
  setYear: (n: number) => void; setMonth: (n: number) => void;
  selectedDate: string; setSelectedDate: (d: string) => void;
  canEdit: boolean;
}) {
  const today = new Date();
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

  const lookup = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of attendance.data ?? []) m.set(`${r.worker_id}|${r.date}`, r);
    return m;
  }, [attendance.data]);

  const activeWorkers = useMemo(() => {
    return workers
      .filter((w: any) => {
        if (w.start_date && w.start_date > monthEnd) return false;
        if (w.end_date && w.end_date < monthStart) return false;
        return true;
      })
      .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
  }, [workers, monthStart, monthEnd]);

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
      bulkFn({ data: { farm_id: farmId!, date, worker_ids: activeWorkers.map((w) => w.id) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", farmId, year, month] });
      toast.success("Marked all present");
    },
  });

  function exportCsv() {
    const rows: any[] = [];
    for (const w of activeWorkers) {
      for (const d of days) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const rec = lookup.get(`${w.id}|${date}`);
        rows.push({
          sevak: w.full_name, sevak_id: w.worker_code ?? "", role: w.role ?? "",
          date, status: rec?.status ?? "", work_done: rec?.work_done ?? "", notes: rec?.notes ?? "",
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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="flex items-end gap-3">
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
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="size-3.5 mr-1.5" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
        {STATUS.map((s) => (
          <div key={s.value} className="flex items-center gap-1.5">
            <span className={cn("inline-flex w-5 h-5 rounded-full ring-1 items-center justify-center text-[10px] font-bold", s.cls)}>{s.short}</span>
            {s.label}
          </div>
        ))}
        <div className="ml-auto italic">Click a date header to jump to that day in the Daily tab</div>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-auto max-h-[65vh]">
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
                      <button type="button" onClick={() => setSelectedDate(dateStr)} className="block w-full">
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(year, month - 1, d).toLocaleDateString("default", { weekday: "short" }).slice(0, 2)}
                        </div>
                        <div className="text-xs font-semibold">{String(d).padStart(2, "0")}</div>
                      </button>
                      {canEdit && (
                        <button type="button" onClick={() => bulkMut.mutate(dateStr)} className="mt-1 text-muted-foreground/60 hover:text-primary" title="Mark all present">
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
                <tr><td colSpan={days.length + 1} className="text-center text-muted-foreground italic py-10">No sevaks active in this month.</td></tr>
              )}
              {activeWorkers.map((w) => (
                <tr key={w.id} className="group">
                  <th className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 border-b border-r px-4 py-3 text-left font-medium align-top">
                    <div className="text-sm">{w.full_name}</div>
                    {w.role && <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{w.role}</div>}
                  </th>
                  {days.map((d) => {
                    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const rec = lookup.get(`${w.id}|${dateStr}`);
                    const meta = statusMeta(rec?.status);
                    const dow = new Date(year, month - 1, d).getDay();
                    const weekend = dow === 0 || dow === 6;
                    return (
                      <td key={d} className={cn("border-b border-r p-1 text-center", weekend && "bg-muted/30", dateStr === selectedDate && "bg-primary/5")}>
                        <MonthlyCell
                          disabled={!canEdit}
                          current={rec}
                          onSave={(status, notes) => upsertMut.mutate({ worker_id: w.id, date: dateStr, status, notes })}
                        >
                          <button
                            type="button"
                            className={cn(
                              "relative w-7 h-7 mx-auto rounded-full ring-1 flex items-center justify-center text-[10px] font-bold transition hover:scale-110",
                              meta?.cls ?? "bg-background ring-border text-muted-foreground/40",
                            )}
                          >
                            {meta?.short ?? "·"}
                            {(rec?.notes || rec?.work_done) && (
                              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-foreground/70" />
                            )}
                          </button>
                        </MonthlyCell>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MonthlyCell({
  children, current, onSave, disabled,
}: {
  children: React.ReactNode; current?: any;
  onSave: (status: string, notes: string | null) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>(current?.status ?? "present");
  const [notes, setNotes] = useState<string>(current?.notes ?? "");
  if (disabled) return <>{children}</>;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setStatus(current?.status ?? "present"); setNotes(current?.notes ?? ""); } }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Status</div>
        <div className="grid grid-cols-3 gap-1 mb-3">
          {STATUS.map((s) => (
            <button key={s.value} type="button" onClick={() => setStatus(s.value)} className={cn("px-2 py-1.5 rounded text-[11px] font-medium ring-1 transition", s.cls, status === s.value ? "ring-2 ring-foreground/40 scale-105" : "opacity-60 hover:opacity-100")}>
              {s.label}
            </button>
          ))}
        </div>
        {current?.work_done && (
          <div className="text-xs text-muted-foreground mb-2"><span className="font-medium">Work:</span> {current.work_done}</div>
        )}
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Note</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" className="mt-1 text-xs" />
        <div className="flex justify-end mt-3">
          <Button size="sm" onClick={() => { onSave(status, notes.trim() ? notes.trim() : null); setOpen(false); }}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------- VISITORS ---------- */

function VisitorsPanel({
  farmId, farmName, date, setDate, canEdit,
}: { farmId?: string; farmName?: string; date: string; setDate: (d: string) => void; canEdit: boolean }) {
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["visitors", farmId, date] }); setConfirmDel(null); toast.success("Visitor removed"); },
  });

  const niceDate = new Date(date + "T00:00:00").toLocaleDateString("default", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <section>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-serif text-2xl flex items-center gap-2">
            <Users className="size-5 text-primary" /> Visitors
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{farmName ? `${farmName} — ` : ""}{niceDate}</p>
        </div>
        <div className="flex items-end gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[170px]" />
          {canEdit && (
            <Button size="sm" onClick={() => setAdding(true)} disabled={!farmId}>
              <Plus className="size-3.5 mr-1" /> Log visitor
            </Button>
          )}
        </div>
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
            {(v.start_time || v.end_time) && (
              <div className="text-xs text-muted-foreground mt-1">
                {fmtTime(v.start_time)} {v.end_time ? `– ${fmtTime(v.end_time)}` : ""}
              </div>
            )}
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
          <AlertDialogHeader><AlertDialogTitle>Remove visitor entry?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => delMut.mutate(confirmDel.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function fmtTime(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function VisitorDialog({
  open, onOpenChange, initial, farmId, date,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  initial?: any; farmId: string; date: string;
}) {
  const [f, setF] = useState(() => initial || {
    visitor_name: "", visitor_type: "farmer", count: 1, description: "", start_time: "", end_time: "",
  });
  const upsert = useServerFn(upsertVisitor);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => {
      const { id, created_at, updated_at, ...rest } = f;
      const values = {
        ...rest, farm_id: farmId, date, count: Number(rest.count) || 1,
        start_time: rest.start_time || null,
        end_time: rest.end_time || null,
      };
      return upsert({ data: { id, values } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["visitors", farmId, date] }); onOpenChange(false); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  function set(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{initial ? "Edit visitor" : "Log a visitor"}</DialogTitle>
          <DialogDescription>Anyone who came to the farm — farmers, officials, students, returning sevaks.</DialogDescription>
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
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Arrival time</Label><Input type="time" value={f.start_time ?? ""} onChange={(e) => set("start_time", e.target.value)} /></div>
            <div><Label>Departure time</Label><Input type="time" value={f.end_time ?? ""} onChange={(e) => set("end_time", e.target.value)} /></div>
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
