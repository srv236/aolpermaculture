
DO $$ BEGIN
  CREATE TYPE public.work_note_period AS ENUM ('weekly','monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.sevak_work_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  period_type public.work_note_period NOT NULL,
  period_start date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, farm_id, period_type, period_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sevak_work_notes TO authenticated;
GRANT ALL ON public.sevak_work_notes TO service_role;

ALTER TABLE public.sevak_work_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "swn_select_auth" ON public.sevak_work_notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "swn_insert_editor" ON public.sevak_work_notes
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'editor'::public.app_role));
CREATE POLICY "swn_update_editor" ON public.sevak_work_notes
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'editor'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'editor'::public.app_role));
CREATE POLICY "swn_delete_editor" ON public.sevak_work_notes
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'editor'::public.app_role));

CREATE TRIGGER update_sevak_work_notes_updated_at
  BEFORE UPDATE ON public.sevak_work_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
