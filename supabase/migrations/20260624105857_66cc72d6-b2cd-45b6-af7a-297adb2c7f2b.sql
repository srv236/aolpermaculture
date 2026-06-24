
CREATE TYPE public.attendance_status AS ENUM ('present','absent','half_day','leave','holiday');
CREATE TYPE public.visitor_type AS ENUM ('farmer','government','previous_sevak','students','other');

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, farm_id, date)
);
CREATE INDEX attendance_farm_date_idx ON public.attendance(farm_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select_auth" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_insert_editor" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "attendance_update_editor" ON public.attendance FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "attendance_delete_editor" ON public.attendance FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE TRIGGER attendance_set_updated_at BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.farm_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  visitor_name TEXT NOT NULL,
  visitor_type public.visitor_type NOT NULL DEFAULT 'other',
  count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX farm_visitors_farm_date_idx ON public.farm_visitors(farm_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_visitors TO authenticated;
GRANT ALL ON public.farm_visitors TO service_role;
ALTER TABLE public.farm_visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visitors_select_auth" ON public.farm_visitors FOR SELECT TO authenticated USING (true);
CREATE POLICY "visitors_insert_editor" ON public.farm_visitors FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "visitors_update_editor" ON public.farm_visitors FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "visitors_delete_editor" ON public.farm_visitors FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE TRIGGER farm_visitors_set_updated_at BEFORE UPDATE ON public.farm_visitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
