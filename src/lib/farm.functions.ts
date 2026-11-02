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
  .validator((d: { id: string }) => d)
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
  .validator((d: { id?: string; values: Record<string, any> }) => d)
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
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("farms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PLOTS ----------
export const listPlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { farmId?: string }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("plots").select("*").order("plot_number");
    if (data.farmId) q = q.eq("farm_id", data.farmId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id?: string; values: Record<string, any> }) => d)
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
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("plots").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- CROPS & SEEDS ----------
export function unpackSeedMetadata(crop: any) {
  if (!crop) return crop;
  let meta: any = {};
  if (crop.description && typeof crop.description === "string") {
    const match = crop.description.match(/<!--seed_meta:([\s\S]*?)-->/);
    if (match) {
      try {
        meta = JSON.parse(match[1]);
      } catch {
        // ignore parse error
      }
    }
  }

  const cleanDescription =
    crop.description && typeof crop.description === "string"
      ? crop.description.replace(/<!--seed_meta:[\s\S]*?-->/g, "").trim()
      : crop.description ?? "";

  return {
    ...crop,
    description: cleanDescription || (crop.description ?? null),
    seed_stock_quantity:
      crop.seed_stock_quantity !== undefined && crop.seed_stock_quantity !== null
        ? Number(crop.seed_stock_quantity)
        : meta.seed_stock_quantity !== undefined && meta.seed_stock_quantity !== null
        ? Number(meta.seed_stock_quantity)
        : null,
    seed_stock_unit: crop.seed_stock_unit ?? meta.seed_stock_unit ?? "g",
    germination_days:
      crop.germination_days !== undefined && crop.germination_days !== null
        ? Number(crop.germination_days)
        : meta.germination_days !== undefined && meta.germination_days !== null
        ? Number(meta.germination_days)
        : null,
    is_repeat_harvest:
      crop.is_repeat_harvest !== undefined && crop.is_repeat_harvest !== null
        ? Boolean(crop.is_repeat_harvest)
        : Boolean(meta.is_repeat_harvest ?? false),
    repeat_harvest_interval:
      crop.repeat_harvest_interval ?? meta.repeat_harvest_interval ?? null,
    seed_expiry_date: crop.seed_expiry_date ?? meta.seed_expiry_date ?? null,
    seed_notes: crop.seed_notes ?? meta.seed_notes ?? (cleanDescription || null),
  };
}

export function packSeedMetadata(
  description: string | null | undefined,
  seedData: {
    seed_stock_quantity?: number | null;
    seed_stock_unit?: string | null;
    germination_days?: number | null;
    is_repeat_harvest?: boolean | null;
    repeat_harvest_interval?: string | null;
    seed_expiry_date?: string | null;
    seed_notes?: string | null;
  }
): string | null {
  const cleanDescription = (description || "")
    .replace(/<!--seed_meta:[\s\S]*?-->/g, "")
    .trim();

  const effectiveNotes = seedData.seed_notes?.trim() || cleanDescription;

  const hasSeedData =
    (seedData.seed_stock_quantity !== undefined && seedData.seed_stock_quantity !== null) ||
    seedData.seed_stock_unit ||
    (seedData.germination_days !== undefined && seedData.germination_days !== null) ||
    seedData.is_repeat_harvest ||
    seedData.repeat_harvest_interval ||
    seedData.seed_expiry_date ||
    seedData.seed_notes;

  if (!hasSeedData) {
    return effectiveNotes || null;
  }

  const metaPayload = {
    seed_stock_quantity: seedData.seed_stock_quantity ?? null,
    seed_stock_unit: seedData.seed_stock_unit || "g",
    germination_days: seedData.germination_days ?? null,
    is_repeat_harvest: !!seedData.is_repeat_harvest,
    repeat_harvest_interval: seedData.repeat_harvest_interval || null,
    seed_expiry_date: seedData.seed_expiry_date || null,
    seed_notes: effectiveNotes || null,
  };

  const tag = `<!--seed_meta:${JSON.stringify(metaPayload)}-->`;
  return effectiveNotes ? `${tag}\n${effectiveNotes}` : tag;
}

export const listCrops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("crops")
      .select("*")
      .order("crop_name")
      .order("variety_name");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    return rows.map(unpackSeedMetadata);
  });

export const upsertCrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id?: string; values: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    const allowed = [
      "crop_name",
      "variety_name",
      "crop_category",
      "yield_unit",
      "typical_yield_per_acre",
      "growing_days",
      "cultivation_season",
      "sowing_window",
      "harvesting_window",
      "optimal_temp",
      "water_requirement",
      "description",
      "is_active",
      "image_url",
      // Seed Storage fields
      "seed_stock_quantity",
      "seed_stock_unit",
      "germination_days",
      "is_repeat_harvest",
      "repeat_harvest_interval",
      "seed_expiry_date",
      "seed_notes",
    ];
    const sanitized: Record<string, any> = {};
    for (const key of allowed) {
      if (key in data.values) {
        sanitized[key] = data.values[key];
      }
    }

    // Always preserve seed metadata safely inside description for resilient fallback
    sanitized.description = packSeedMetadata(
      sanitized.description ?? sanitized.seed_notes,
      {
        seed_stock_quantity: sanitized.seed_stock_quantity,
        seed_stock_unit: sanitized.seed_stock_unit,
        germination_days: sanitized.germination_days,
        is_repeat_harvest: sanitized.is_repeat_harvest,
        repeat_harvest_interval: sanitized.repeat_harvest_interval,
        seed_expiry_date: sanitized.seed_expiry_date,
        seed_notes: sanitized.seed_notes,
      }
    );

    const execute = async (payload: Record<string, any>) => {
      if (data.id) {
        return await context.supabase.from("crops").update(payload as any).eq("id", data.id);
      }
      return await context.supabase.from("crops").insert(payload as any).select("id").single();
    };

    let result = await execute(sanitized);

    // Defensive fallback: If PostgREST schema cache has not reloaded columns yet, strip non-core columns and retry
    const seedColumns = [
      "seed_stock_quantity",
      "seed_stock_unit",
      "germination_days",
      "is_repeat_harvest",
      "repeat_harvest_interval",
      "seed_expiry_date",
      "seed_notes",
    ];

    if (result.error) {
      const errMsg = result.error.message || "";
      const hasMissingSeedCol = seedColumns.some((col) => errMsg.includes(col));
      const hasMissingImageCol = errMsg.includes("image_url");

      if (hasMissingSeedCol || hasMissingImageCol) {
        const fallbackPayload: Record<string, any> = { ...sanitized };
        if (hasMissingSeedCol) {
          for (const col of seedColumns) {
            delete fallbackPayload[col];
          }
        }
        if (hasMissingImageCol) {
          delete fallbackPayload.image_url;
        }
        result = await execute(fallbackPayload);
      }
    }

    if (result.error) throw new Error(result.error.message);
    return { id: data.id || result.data?.id };
  });

export const deleteCrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crops").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- SOWING ----------
export const listSowing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { farmId?: string }) => d)
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

export const upsertSowing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id?: string; values: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    const allowed = [
      "plot_id", "variety_id", "planting_date", "quantity_planted", "quantity_unit",
      "seed_source", "expected_first_harvest", "expected_final_harvest", "status",
      "is_continuous_harvest", "estimated_harvest_interval_days", "is_replanting",
      "original_sowing_id", "area_utilized_percent", "notes",
    ];
    const payload: Record<string, any> = {};
    for (const k of allowed) {
      if (data.values && k in data.values) payload[k] = data.values[k];
    }
    if (data.id) {
      const { error } = await context.supabase.from("sowing_records").update(payload as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("sowing_records").insert(payload as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteSowing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sowing_records").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- HARVEST ----------
export const listHarvest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { farmId?: string }) => d)
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
  .validator((d: { id?: string; values: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    const allowed = [
      "plot_id", "variety_id", "sowing_id", "harvest_date", "harvest_time_start",
      "harvest_time_end", "quantity_harvested", "quality_grade",
      "harvest_sequence_number", "estimated_remaining_yield", "notes",
    ];
    const payload: Record<string, any> = {};
    for (const k of allowed) {
      if (data.values && k in data.values) payload[k] = data.values[k];
    }
    if (data.id) {
      const { error } = await context.supabase.from("harvest_records").update(payload as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("harvest_records").insert(payload as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteHarvest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
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
