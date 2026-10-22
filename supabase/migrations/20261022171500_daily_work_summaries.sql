-- Create daily_work_summaries table for farm-level daily work summary on attendance page
CREATE TABLE IF NOT EXISTS public.daily_work_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (farm_id, date)
);

CREATE INDEX IF NOT EXISTS daily_work_summaries_farm_date_idx ON public.daily_work_summaries(farm_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_work_summaries TO authenticated;
GRANT ALL ON public.daily_work_summaries TO service_role;

ALTER TABLE public.daily_work_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_work_summaries_select_auth" ON public.daily_work_summaries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "daily_work_summaries_insert_editor" ON public.daily_work_summaries
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'editor')
  );

CREATE POLICY "daily_work_summaries_update_editor" ON public.daily_work_summaries
  FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'editor')
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'editor')
  );

CREATE POLICY "daily_work_summaries_delete_editor" ON public.daily_work_summaries
  FOR DELETE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'editor')
  );

CREATE TRIGGER update_daily_work_summaries_updated_at
  BEFORE UPDATE ON public.daily_work_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
