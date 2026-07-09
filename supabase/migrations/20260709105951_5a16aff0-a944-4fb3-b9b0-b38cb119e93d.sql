
CREATE TABLE public.knowledge_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_sections TO authenticated;
GRANT ALL ON public.knowledge_sections TO service_role;

ALTER TABLE public.knowledge_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read knowledge sections"
  ON public.knowledge_sections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors insert knowledge sections"
  ON public.knowledge_sections FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Editors update knowledge sections"
  ON public.knowledge_sections FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'editor'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Editors delete knowledge sections"
  ON public.knowledge_sections FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'editor'::app_role));

CREATE TRIGGER update_knowledge_sections_updated_at
  BEFORE UPDATE ON public.knowledge_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
