
ALTER TABLE public.knowledge_sections ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE POLICY "knowledge_images_read_auth"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'knowledge-images');

CREATE POLICY "knowledge_images_insert_editor"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'knowledge-images' AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'editor'::public.app_role)));

CREATE POLICY "knowledge_images_update_editor"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'knowledge-images' AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'editor'::public.app_role)));

CREATE POLICY "knowledge_images_delete_editor"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'knowledge-images' AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'editor'::public.app_role)));
