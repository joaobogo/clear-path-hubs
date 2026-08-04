CREATE TABLE public.status_incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL DEFAULT 'incident' CHECK (kind IN ('incident','maintenance')),
  services text[] NOT NULL DEFAULT '{}',
  severity text NOT NULL DEFAULT 'degraded_performance' CHECK (severity IN ('degraded_performance','partial_outage','major_outage','maintenance')),
  title text NOT NULL,
  summary text NOT NULL,
  state text NOT NULL DEFAULT 'investigating' CHECK (state IN ('investigating','identified','monitoring','resolved','scheduled','in_progress','completed','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX status_incidents_public_idx ON public.status_incidents (published, started_at DESC);

GRANT SELECT ON public.status_incidents TO anon;
GRANT SELECT ON public.status_incidents TO authenticated;
GRANT ALL ON public.status_incidents TO service_role;

ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published status notices are public"
  ON public.status_incidents FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE POLICY "Platform admins read every status notice"
  ON public.status_incidents FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins write status notices"
  ON public.status_incidents FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.status_incidents_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER status_incidents_updated_at
BEFORE UPDATE ON public.status_incidents
FOR EACH ROW EXECUTE FUNCTION public.status_incidents_touch_updated_at();