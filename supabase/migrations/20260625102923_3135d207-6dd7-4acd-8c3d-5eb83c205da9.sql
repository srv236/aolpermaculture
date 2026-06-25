ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS work_done text;
ALTER TABLE public.farm_visitors ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE public.farm_visitors ADD COLUMN IF NOT EXISTS end_time time;