-- Availability windows a client sets once and reuses for every interview.
CREATE TABLE IF NOT EXISTS public.org_availability_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute integer NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute integer NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  timezone text NOT NULL DEFAULT 'UTC',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_availability_window_range CHECK (end_minute > start_minute),
  CONSTRAINT org_availability_window_unique UNIQUE (organization_id, weekday, start_minute, end_minute)
);

CREATE INDEX IF NOT EXISTS idx_org_availability_windows_org
  ON public.org_availability_windows (organization_id, weekday);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_availability_windows TO authenticated;
GRANT ALL ON public.org_availability_windows TO service_role;

ALTER TABLE public.org_availability_windows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "availability_windows_select" ON public.org_availability_windows;
CREATE POLICY "availability_windows_select"
  ON public.org_availability_windows FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS "availability_windows_write" ON public.org_availability_windows;
CREATE POLICY "availability_windows_write"
  ON public.org_availability_windows FOR ALL TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_org_availability_windows_updated_at ON public.org_availability_windows;
CREATE TRIGGER trg_org_availability_windows_updated_at
  BEFORE UPDATE ON public.org_availability_windows
  FOR EACH ROW EXECUTE FUNCTION public._mig_touch_updated_at();

-- New lifecycle event for one-tap reschedules.
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'interview_rescheduled';