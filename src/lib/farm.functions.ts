import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- FARMS ----------
export const listFarms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("farms")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getFarm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: farm, error } = await context.supabase
      .from("farms")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return farm;
  });

export const upsertFarm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; values: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    const payload: any = { ...data.values };
    if (data.id) {
      const { error } = await context.supabase.from("farms").update(payload as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("farms").insert(payload as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteFarm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("farms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PLOTS ----------
export const listPlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { farmId?: string }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("plots").select("*").order("plot_number");
    if (data.farmId) q = q.eq("farm_id", data.farmId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; values: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase.from("plots").update(data.values as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("plots").insert(data.values as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deletePlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("plots").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- CROPS ----------
export const listCrops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("crops")
      .select("*")
      .order("crop_name")
      .order("variety_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertCrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; values: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase.from("crops").update(data.values as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("crops").insert(data.values as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteCrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crops").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- SOWING ----------
export const listSowing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { farmId?: string }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("sowing_records")
      .select("*, plots!inner(id, plot_number, farm_id), crops:variety_id(crop_name, variety_name)")
      .order("planting_date", { ascending: false });
    if (data.farmId) q = q.eq("plots.farm_id", data.farmId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const SOWING_ALLOWED_COLUMNS = new Set([
  "plot_id",
  "variety_id",
  "planting_date",
  "quantity_planted",
  "quantity_unit",
  "seed_source",
  "expected_first_harvest",
  "expected_final_harvest",
  "status",
  "is_continuous_harvest",
  "estimated_harvest_interval_days",
  "is_replanting",
  "original_sowing_id",
  "area_utilized_percent",
  "notes",
]);

function filterSowingColumns(values: Record<string, any>) {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(values || {})) {
    if (SOWING_ALLOWED_COLUMNS.has(k)) clean[k] = v;
  }
  return clean;
}

export const upsertSowing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; values: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    const cleanValues = filterSowingColumns(data.values);
    if (data.id) {
      const { error } = await context.supabase.from("sowing_records").update(cleanValues as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("sowing_records").insert(cleanValues as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteSowing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sowing_records").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- HARVEST ----------
const HARVEST_ALLOWED_COLUMNS = new Set([
  "plot_id",
  "variety_id",
  "sowing_id",
  "harvest_date",
  "harvest_time_start",
  "harvest_time_end",
  "quantity_harvested",
  "quality_grade",
  "harvest_sequence_number",
  "estimated_remaining_yield",
  "notes",
]);

function filterHarvestColumns(values: Record<string, any>) {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(values || {})) {
    if (HARVEST_ALLOWED_COLUMNS.has(k)) clean[k] = v;
  }
  return clean;
}

export const listHarvest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { farmId?: string }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("harvest_records")
      .select("*, plots!inner(id, plot_number, farm_id), crops:variety_id(crop_name, variety_name, crop_category)")
      .order("harvest_date", { ascending: false });
    if (data.farmId) q = q.eq("plots.farm_id", data.farmId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertHarvest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; values: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    const cleanValues = filterHarvestColumns(data.values);
    if (data.id) {
      const { error } = await context.supabase.from("harvest_records").update(cleanValues as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("harvest_records").insert(cleanValues as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteHarvest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("harvest_records").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- ME / ROLE ----------
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, roles] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    return {
      userId: context.userId,
      profile: profile.data,
      roles: (roles.data ?? []).map((r) => r.role as "admin" | "editor" | "viewer"),
    };
  });
