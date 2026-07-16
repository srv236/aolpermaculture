ALTER TABLE public.crops
  ADD COLUMN IF NOT EXISTS cultivation_season text,
  ADD COLUMN IF NOT EXISTS sowing_window text,
  ADD COLUMN IF NOT EXISTS harvesting_window text,
  ADD COLUMN IF NOT EXISTS optimal_temp text,
  ADD COLUMN IF NOT EXISTS water_requirement text;