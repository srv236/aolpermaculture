
-- 1) Restrict farms SELECT to editors/admins
DROP POLICY IF EXISTS "Anyone signed in reads farms" ON public.farms;
CREATE POLICY "Editors+ read farms" ON public.farms
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));

-- 2) Restrict workers SELECT to editors/admins
DROP POLICY IF EXISTS "Authenticated can view workers" ON public.workers;
CREATE POLICY "Editors+ read workers" ON public.workers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));

-- 3) Move has_role out of the API-exposed public schema so signed-in users
--    can no longer call it via PostgREST RPC. Existing RLS policies keep
--    working because Postgres tracks the function dependency by OID.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
