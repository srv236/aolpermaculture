import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listWorkNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { farmId: string; period_type: "weekly" | "monthly"; period_start: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("sevak_work_notes")
      .select("*")
      .eq("farm_id", data.farmId)
      .eq("period_type", data.period_type)
      .eq("period_start", data.period_start);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertWorkNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    worker_id: string; farm_id: string;
    period_type: "weekly" | "monthly"; period_start: string;
    notes: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    if (!data.notes || !data.notes.trim()) {
      const { error } = await context.supabase
        .from("sevak_work_notes")
        .delete()
        .eq("worker_id", data.worker_id)
        .eq("farm_id", data.farm_id)
        .eq("period_type", data.period_type)
        .eq("period_start", data.period_start);
      if (error) throw new Error(error.message);
      return { ok: true, deleted: true };
    }
    const { error } = await context.supabase
      .from("sevak_work_notes")
      .upsert(
        {
          worker_id: data.worker_id,
          farm_id: data.farm_id,
          period_type: data.period_type,
          period_start: data.period_start,
          notes: data.notes,
        } as any,
        { onConflict: "worker_id,farm_id,period_type,period_start" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
