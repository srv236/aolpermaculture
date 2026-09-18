-- Add image_url column to public.crops table
ALTER TABLE public.crops ADD COLUMN IF NOT EXISTS image_url text;
