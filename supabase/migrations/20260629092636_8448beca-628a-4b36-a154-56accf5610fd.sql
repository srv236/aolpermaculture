DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

NOTIFY pgrst, 'reload schema';