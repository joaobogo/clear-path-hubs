CREATE TABLE IF NOT EXISTS public.position_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL UNIQUE REFERENCES public.positions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_shortlist_days integer NOT NULL DEFAULT 5 CHECK (first_shortlist_days BETWEEN 1 AND 90),
  shortlist_size integer NOT NULL DEFAULT 3 CHECK (shortlist_size BETWEEN 1 AND 25),
  interview_slots_hours integer NOT NULL DEFAULT 24 CHECK (interview_slots_hours BETWEEN 1 AND 336),
  baseline_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS position_commitments_org_idx ON public.position_commitments(organization_id);

GRANT SELECT ON public.position_commitments TO authenticated;
GRANT ALL ON public.position_commitments TO service_role;

ALTER TABLE public.position_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read role commitments"
  ON public.position_commitments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "Platform staff manage role commitments"
  ON public.position_commitments FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE TRIGGER position_commitments_updated_at
  BEFORE UPDATE ON public.position_commitments
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_position_commitment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.search_live_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.search_live_at IS DISTINCT FROM NEW.search_live_at) THEN
    INSERT INTO public.position_commitments (position_id, organization_id, baseline_at)
    VALUES (NEW.id, NEW.organization_id, NEW.search_live_at)
    ON CONFLICT (position_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS positions_ensure_commitment ON public.positions;
CREATE TRIGGER positions_ensure_commitment
  AFTER INSERT OR UPDATE OF search_live_at ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.ensure_position_commitment();

INSERT INTO public.position_commitments (position_id, organization_id, baseline_at)
SELECT p.id, p.organization_id, COALESCE(p.search_live_at, p.approved_at, p.created_at)
FROM public.positions p
WHERE p.status IN ('active', 'paused', 'approved')
ON CONFLICT (position_id) DO NOTHING;