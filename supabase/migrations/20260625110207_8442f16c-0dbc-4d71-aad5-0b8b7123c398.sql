
CREATE TYPE public.resource_type AS ENUM ('equipment','labor','material','water','biological','energy','other');

CREATE TABLE public.resource_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  plot_id uuid REFERENCES public.plots(id) ON DELETE SET NULL,
  resource_name text NOT NULL,
  resource_type public.resource_type NOT NULL,
  quantity numeric,
  unit text,
  used_for text,
  start_time timestamptz,
  end_time timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_records TO authenticated;
GRANT ALL ON public.resource_records TO service_role;

ALTER TABLE public.resource_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read resource_records" ON public.resource_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert resource_records" ON public.resource_records FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "auth update resource_records" ON public.resource_records FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "auth delete resource_records" ON public.resource_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));

CREATE TRIGGER trg_resource_records_updated BEFORE UPDATE ON public.resource_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_resource_records_farm ON public.resource_records(farm_id);
CREATE INDEX idx_resource_records_plot ON public.resource_records(plot_id);
