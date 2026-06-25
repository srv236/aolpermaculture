import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { farmId?: string }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("resource_records")
      .select("*, plots:plot_id(id, plot_number)")
      .order("start_time", { ascending: false, nullsFirst: false });
    if (data.farmId) q = q.eq("farm_id", data.farmId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; values: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    const values: any = { ...data.values };
    if (values.plot_id === "") values.plot_id = null;
    if (data.id) {
      const { error } = await context.supabase.from("resource_records").update(values).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    values.created_by = context.userId;
    const { data: ins, error } = await context.supabase.from("resource_records").insert(values).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("resource_records").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
