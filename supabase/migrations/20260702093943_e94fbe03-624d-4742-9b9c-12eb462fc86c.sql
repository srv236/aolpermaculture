
ALTER POLICY "attendance_update_editor" ON public.attendance
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'editor'::app_role));

ALTER POLICY "Editors+ update crops" ON public.crops
  WITH CHECK (private.has_role(auth.uid(), 'editor'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "visitors_update_editor" ON public.farm_visitors
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'editor'::app_role));

ALTER POLICY "Editors+ update farms" ON public.farms
  WITH CHECK (private.has_role(auth.uid(), 'editor'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Editors+ update harvest" ON public.harvest_records
  WITH CHECK (private.has_role(auth.uid(), 'editor'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Editors+ update plots" ON public.plots
  WITH CHECK (private.has_role(auth.uid(), 'editor'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "auth update resource_records" ON public.resource_records
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'editor'::app_role));

ALTER POLICY "Editors+ update sowing" ON public.sowing_records
  WITH CHECK (private.has_role(auth.uid(), 'editor'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Admins/editors can update worker types" ON public.worker_types
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'editor'::app_role));

ALTER POLICY "Editors/admins can update workers" ON public.workers
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'editor'::app_role));
