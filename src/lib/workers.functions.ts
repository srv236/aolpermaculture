import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listWorkers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("workers")
      .select("*")
      .order("full_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; values: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase.from("workers").update(data.values as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("workers").insert(data.values as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("workers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
