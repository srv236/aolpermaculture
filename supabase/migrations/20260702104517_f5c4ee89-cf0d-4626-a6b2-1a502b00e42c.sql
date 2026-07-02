
CREATE TABLE public.bed_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bed_plans_plot_id_idx ON public.bed_plans(plot_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bed_plans TO authenticated;
GRANT ALL ON public.bed_plans TO service_role;

ALTER TABLE public.bed_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view bed plans"
  ON public.bed_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors and admins can insert bed plans"
  ON public.bed_plans FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'editor'::public.app_role));

CREATE POLICY "Editors and admins can update bed plans"
  ON public.bed_plans FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'editor'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'editor'::public.app_role));

CREATE POLICY "Editors and admins can delete bed plans"
  ON public.bed_plans FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'editor'::public.app_role));

CREATE TRIGGER update_bed_plans_updated_at
  BEFORE UPDATE ON public.bed_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
