
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE public.sowing_status AS ENUM ('planned', 'active', 'completed', 'failed', 'abandoned');

-- =========================================================
-- updated_at helper
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER_ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = id);
CREATE POLICY "Admins delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- user_roles policies
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- handle_new_user trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  -- Auto-grant admin to Srinivas; viewer to everyone else
  IF lower(NEW.email) = 'srv.236@gmail.com' THEN
    v_role := 'admin';
  ELSE
    v_role := 'viewer';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- FARMS
-- =========================================================
CREATE TABLE public.farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  farming_type TEXT,
  total_acreage NUMERIC,
  latitude NUMERIC,
  longitude NUMERIC,
  geopolygon TEXT,
  state TEXT,
  district TEXT,
  owner_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  established_year INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farms TO authenticated;
GRANT ALL ON public.farms TO service_role;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER farms_updated_at BEFORE UPDATE ON public.farms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone signed in reads farms" ON public.farms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors+ insert farms" ON public.farms
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors+ update farms" ON public.farms
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors+ delete farms" ON public.farms
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- PLOTS
-- =========================================================
CREATE TABLE public.plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  plot_number TEXT NOT NULL,
  acreage NUMERIC,
  geopolygon TEXT,
  soil_type TEXT,
  irrigation_type TEXT,
  elevation NUMERIC,
  slope_percent NUMERIC,
  aspect TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX plots_farm_id_idx ON public.plots(farm_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plots TO authenticated;
GRANT ALL ON public.plots TO service_role;
ALTER TABLE public.plots ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER plots_updated_at BEFORE UPDATE ON public.plots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone signed in reads plots" ON public.plots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors+ insert plots" ON public.plots
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors+ update plots" ON public.plots
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors+ delete plots" ON public.plots
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- CROPS
-- =========================================================
CREATE TABLE public.crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_name TEXT NOT NULL,
  variety_name TEXT,
  crop_category TEXT,
  yield_unit TEXT DEFAULT 'kg',
  description TEXT,
  typical_yield_per_acre NUMERIC,
  growing_days INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crops TO authenticated;
GRANT ALL ON public.crops TO service_role;
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER crops_updated_at BEFORE UPDATE ON public.crops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone signed in reads crops" ON public.crops
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors+ insert crops" ON public.crops
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors+ update crops" ON public.crops
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors+ delete crops" ON public.crops
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- SOWING RECORDS
-- =========================================================
CREATE TABLE public.sowing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
  variety_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE RESTRICT,
  planting_date DATE NOT NULL,
  quantity_planted NUMERIC,
  quantity_unit TEXT,
  seed_source TEXT,
  expected_first_harvest DATE,
  expected_final_harvest DATE,
  status public.sowing_status NOT NULL DEFAULT 'planned',
  is_continuous_harvest BOOLEAN NOT NULL DEFAULT false,
  estimated_harvest_interval_days INTEGER,
  is_replanting BOOLEAN NOT NULL DEFAULT false,
  original_sowing_id UUID REFERENCES public.sowing_records(id) ON DELETE SET NULL,
  area_utilized_percent NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sowing_plot_idx ON public.sowing_records(plot_id);
CREATE INDEX sowing_variety_idx ON public.sowing_records(variety_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sowing_records TO authenticated;
GRANT ALL ON public.sowing_records TO service_role;
ALTER TABLE public.sowing_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER sowing_updated_at BEFORE UPDATE ON public.sowing_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone signed in reads sowing" ON public.sowing_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors+ insert sowing" ON public.sowing_records
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors+ update sowing" ON public.sowing_records
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors+ delete sowing" ON public.sowing_records
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- HARVEST RECORDS
-- =========================================================
CREATE TABLE public.harvest_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
  variety_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE RESTRICT,
  sowing_id UUID REFERENCES public.sowing_records(id) ON DELETE SET NULL,
  harvest_date DATE NOT NULL,
  harvest_time_start TIME,
  harvest_time_end TIME,
  quantity_harvested NUMERIC NOT NULL,
  quality_grade TEXT,
  harvest_sequence_number INTEGER,
  estimated_remaining_yield NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX harvest_plot_idx ON public.harvest_records(plot_id);
CREATE INDEX harvest_variety_idx ON public.harvest_records(variety_id);
CREATE INDEX harvest_sowing_idx ON public.harvest_records(sowing_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.harvest_records TO authenticated;
GRANT ALL ON public.harvest_records TO service_role;
ALTER TABLE public.harvest_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER harvest_updated_at BEFORE UPDATE ON public.harvest_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone signed in reads harvest" ON public.harvest_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors+ insert harvest" ON public.harvest_records
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors+ update harvest" ON public.harvest_records
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors+ delete harvest" ON public.harvest_records
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
