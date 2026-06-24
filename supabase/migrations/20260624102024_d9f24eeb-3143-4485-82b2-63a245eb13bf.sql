
CREATE TYPE public.worker_type AS ENUM ('short_term_sevak','long_term_sevak','labourer','permanent_staff');

CREATE TABLE public.workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  worker_type public.worker_type NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT ALL ON public.workers TO service_role;

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view workers" ON public.workers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors/admins can insert workers" ON public.workers
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')
  );
CREATE POLICY "Editors/admins can update workers" ON public.workers
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')
  );
CREATE POLICY "Admins can delete workers" ON public.workers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
