-- === Phase 8: requisition model ===

-- 1. Requisition-level structured fields on positions
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS reference_code text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS travel_expectation text,
  ADD COLUMN IF NOT EXISTS primary_timezone text,
  ADD COLUMN IF NOT EXISTS timezone_overlap_hours integer,
  ADD COLUMN IF NOT EXISTS compensation_collected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compensation_visibility text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS evaluation_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS target_start_date date,
  ADD COLUMN IF NOT EXISTS rescore_state text NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS rescore_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS scoring_signature text,
  ADD COLUMN IF NOT EXISTS content_version integer NOT NULL DEFAULT 1;

DO $$ BEGIN
  ALTER TABLE public.positions
    ADD CONSTRAINT positions_compensation_visibility_chk
    CHECK (compensation_visibility IN ('internal','client','public'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.positions
    ADD CONSTRAINT positions_rescore_state_chk
    CHECK (rescore_state IN ('current','pending','running'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- reference code unique per organization (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS positions_org_reference_code_uidx
  ON public.positions (organization_id, lower(reference_code))
  WHERE reference_code IS NOT NULL AND reference_code <> '';

-- duplicate-requisition guard: same org + same title + same department while live
CREATE UNIQUE INDEX IF NOT EXISTS positions_org_title_dept_open_uidx
  ON public.positions (organization_id, lower(btrim(title)), lower(btrim(coalesce(department,''))))
  WHERE status IN ('draft','submitted','under_review','needs_clarification','approved','active','paused');

-- 2. Multi-location model
CREATE TABLE IF NOT EXISTS public.position_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  country text NOT NULL,
  region text,
  city text,
  work_model public.work_model NOT NULL DEFAULT 'onsite',
  is_primary boolean NOT NULL DEFAULT false,
  headcount integer,
  timezone text,
  onsite_days_per_week integer,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT position_locations_headcount_chk CHECK (headcount IS NULL OR (headcount >= 1 AND headcount <= 999)),
  CONSTRAINT position_locations_onsite_days_chk CHECK (onsite_days_per_week IS NULL OR (onsite_days_per_week >= 0 AND onsite_days_per_week <= 7))
);

CREATE INDEX IF NOT EXISTS position_locations_position_idx ON public.position_locations(position_id);
CREATE INDEX IF NOT EXISTS position_locations_org_idx ON public.position_locations(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS position_locations_unique_place_uidx
  ON public.position_locations (position_id, country_code, lower(coalesce(region,'')), lower(coalesce(city,'')));
CREATE UNIQUE INDEX IF NOT EXISTS position_locations_one_primary_uidx
  ON public.position_locations (position_id) WHERE is_primary;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_locations TO authenticated;
GRANT SELECT ON public.position_locations TO anon;
GRANT ALL ON public.position_locations TO service_role;

ALTER TABLE public.position_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "position_locations_public_read" ON public.position_locations;
CREATE POLICY "position_locations_public_read"
  ON public.position_locations FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.positions p
    WHERE p.id = position_locations.position_id
      AND p.status = 'active'
      AND p.visibility = 'public'
  ));

DROP POLICY IF EXISTS "position_locations_member_read" ON public.position_locations;
CREATE POLICY "position_locations_member_read"
  ON public.position_locations FOR SELECT TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR public.is_org_member(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.positions p
      WHERE p.id = position_locations.position_id
        AND p.status = 'active' AND p.visibility = 'public'
    )
  );

DROP POLICY IF EXISTS "position_locations_write" ON public.position_locations;
CREATE POLICY "position_locations_write"
  ON public.position_locations FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid()) OR public.is_org_editor(auth.uid(), organization_id))
  WITH CHECK (public.is_platform_staff(auth.uid()) OR public.is_org_editor(auth.uid(), organization_id));

DROP TRIGGER IF EXISTS position_locations_touch ON public.position_locations;
CREATE TRIGGER position_locations_touch
  BEFORE UPDATE ON public.position_locations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 3. Version snapshot + rescore signalling on scoring-relevant change
CREATE OR REPLACE FUNCTION public.tg_positions_version_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
  v_scoring_changed boolean;
BEGIN
  v_scoring_changed :=
    OLD.title IS DISTINCT FROM NEW.title
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.requirements IS DISTINCT FROM NEW.requirements
    OR OLD.preferred_requirements IS DISTINCT FROM NEW.preferred_requirements
    OR OLD.dealbreakers IS DISTINCT FROM NEW.dealbreakers
    OR OLD.seniority IS DISTINCT FROM NEW.seniority
    OR OLD.employment_type IS DISTINCT FROM NEW.employment_type
    OR OLD.work_model IS DISTINCT FROM NEW.work_model
    OR OLD.evaluation_weights IS DISTINCT FROM NEW.evaluation_weights
    OR OLD.intake_context IS DISTINCT FROM NEW.intake_context;

  IF NOT v_scoring_changed THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(max(version_number), 0) + 1 INTO v_next
    FROM public.position_versions WHERE position_id = OLD.id;

  INSERT INTO public.position_versions (
    position_id, organization_id, version_number, title, description,
    requirements, preferred_requirements, dealbreakers, compensation,
    intake_context, snapshot, created_by
  ) VALUES (
    OLD.id, OLD.organization_id, v_next, OLD.title, OLD.description,
    OLD.requirements, OLD.preferred_requirements, OLD.dealbreakers, OLD.compensation,
    OLD.intake_context, to_jsonb(OLD), auth.uid()
  );

  NEW.content_version := v_next + 1;
  NEW.rescore_state := 'pending';
  NEW.rescore_requested_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_positions_version_snapshot ON public.positions;
CREATE TRIGGER trg_positions_version_snapshot
  BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_positions_version_snapshot();

-- 4. Backfill primary location rows from the legacy single text location
INSERT INTO public.position_locations (position_id, organization_id, country_code, country, city, work_model, is_primary, display_order)
SELECT p.id, p.organization_id, 'XX', btrim(p.location), NULL, coalesce(p.work_model,'onsite'), true, 0
FROM public.positions p
WHERE coalesce(btrim(p.location),'') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.position_locations l WHERE l.position_id = p.id);