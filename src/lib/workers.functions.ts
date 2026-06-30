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

// ---------- worker types (managed lookup) ----------

export const listWorkerTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("worker_types")
      .select("*")
      .order("sort_order")
      .order("label");
    if (error) throw new Error(error.message);
    return (data ?? []) as { value: string; label: string; sort_order: number }[];
  });

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
}

export const upsertWorkerType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { original_value?: string; value?: string; label: string; sort_order?: number }) => d)
  .handler(async ({ data, context }) => {
    const label = data.label.trim();
    if (!label) throw new Error("Label is required");
    const value = (data.value && data.value.trim()) || slugify(label);
    if (!value) throw new Error("Could not derive a value from the label");

    const row = { value, label, sort_order: data.sort_order ?? 0 };

    if (data.original_value) {
      const { error } = await (context.supabase as any)
        .from("worker_types").update(row).eq("value", data.original_value);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (context.supabase as any).from("worker_types").insert(row);
      if (error) {
        if (/duplicate key/i.test(error.message)) throw new Error(`Type "${value}" already exists`);
        throw new Error(error.message);
      }
    }
    return { value };
  });

export const deleteWorkerType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { value: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("worker_types").delete().eq("value", data.value);
    if (error) {
      if (/foreign key/i.test(error.message)) {
        throw new Error("This type is still assigned to one or more sevaks. Reassign them before deleting.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });
