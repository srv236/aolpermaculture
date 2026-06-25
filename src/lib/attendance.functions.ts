import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { farmId: string; year: number; month: number }) => d)
  .handler(async ({ data, context }) => {
    const start = new Date(Date.UTC(data.year, data.month - 1, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(data.year, data.month, 0)).toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("attendance")
      .select("*")
      .eq("farm_id", data.farmId)
      .gte("date", start)
      .lte("date", end);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { worker_id: string; farm_id: string; date: string; status: string; notes?: string | null; work_done?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const payload: any = {
      worker_id: data.worker_id,
      farm_id: data.farm_id,
      date: data.date,
      status: data.status as any,
    };
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.work_done !== undefined) payload.work_done = data.work_done;
    const { error } = await context.supabase
      .from("attendance")
      .upsert(payload, { onConflict: "worker_id,farm_id,date" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { farm_id: string; date: string; worker_ids: string[]; status: string }) => d)
  .handler(async ({ data, context }) => {
    if (!data.worker_ids.length) return { ok: true };
    const rows = data.worker_ids.map((wid) => ({
      worker_id: wid,
      farm_id: data.farm_id,
      date: data.date,
      status: data.status as any,
    }));
    const { error } = await context.supabase
      .from("attendance")
      .upsert(rows as any, { onConflict: "worker_id,farm_id,date" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkMarkPresent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { farm_id: string; date: string; worker_ids: string[] }) => d)
  .handler(async ({ data, context }) => {
    if (!data.worker_ids.length) return { ok: true };
    const rows = data.worker_ids.map((wid) => ({
      worker_id: wid,
      farm_id: data.farm_id,
      date: data.date,
      status: "present" as const,
    }));
    const { error } = await context.supabase
      .from("attendance")
      .upsert(rows as any, { onConflict: "worker_id,farm_id,date" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("attendance").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Visitors -----
export const listVisitors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { farmId: string; date: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("farm_visitors")
      .select("*")
      .eq("farm_id", data.farmId)
      .eq("date", data.date)
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertVisitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; values: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase.from("farm_visitors").update(data.values as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("farm_visitors").insert(data.values as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteVisitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("farm_visitors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
