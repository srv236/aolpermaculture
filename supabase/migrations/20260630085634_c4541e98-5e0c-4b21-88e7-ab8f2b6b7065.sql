
CREATE TABLE public.worker_types (
  value TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_types TO authenticated;
GRANT ALL ON public.worker_types TO service_role;

ALTER TABLE public.worker_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read worker types"
  ON public.worker_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/editors can insert worker types"
  ON public.worker_types FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Admins/editors can update worker types"
  ON public.worker_types FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Admins can delete worker types"
  ON public.worker_types FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER worker_types_updated_at BEFORE UPDATE ON public.worker_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.worker_types (value, label, sort_order) VALUES
  ('short_term_sevak', 'Short-term Sevak (≤ 1 month)', 10),
  ('long_term_sevak',  'Long-term Sevak (~3 months)',  20),
  ('labourer',         'Labourer',                      30),
  ('permanent_staff',  'Permanent staff',               40);

ALTER TABLE public.workers ALTER COLUMN worker_type TYPE TEXT USING worker_type::text;
DROP TYPE public.worker_type;

ALTER TABLE public.workers
  ADD CONSTRAINT workers_worker_type_fkey
  FOREIGN KEY (worker_type) REFERENCES public.worker_types(value) ON UPDATE CASCADE;
