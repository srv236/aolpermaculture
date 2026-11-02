-- Migration: Add Seed Storage tracking columns to public.crops
ALTER TABLE public.crops
  ADD COLUMN IF NOT EXISTS seed_stock_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS seed_stock_unit TEXT DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS germination_days INTEGER,
  ADD COLUMN IF NOT EXISTS is_repeat_harvest BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_harvest_interval TEXT,
  ADD COLUMN IF NOT EXISTS seed_expiry_date TEXT,
  ADD COLUMN IF NOT EXISTS seed_notes TEXT;

