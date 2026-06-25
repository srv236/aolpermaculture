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
    const values: Record<string, any> = { ...data.values };
    // Empty Sevak ID → null, so the unique index doesn't collide on ""
    if (values.worker_code === "" || values.worker_code === undefined) values.worker_code = null;

    const fail = (error: { message: string; code?: string }): never => {
      if (error.code === "23505" || /worker_code_key|duplicate key/i.test(error.message)) {
        throw new Error(`Sevak ID "${values.worker_code}" is already in use. Please choose a different ID or leave it blank.`);
      }
      throw new Error(error.message);
    };

    if (data.id) {
      const { error } = await context.supabase.from("workers").update(values as any).eq("id", data.id);
      if (error) fail(error);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("workers").insert(values as any).select("id").single();
    if (error) fail(error);
    return { id: ins!.id };
  });

export const deleteWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("workers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
