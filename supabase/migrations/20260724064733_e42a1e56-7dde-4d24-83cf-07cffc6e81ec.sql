
-- 1. rubric_versions -------------------------------------------------------
CREATE TYPE public.rubric_version_status AS ENUM (
  'draft','pending_approval','approved','active','superseded'
);

CREATE TABLE public.rubric_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status public.rubric_version_status NOT NULL DEFAULT 'draft',
  label text NOT NULL,
  dimensions jsonb NOT NULL DEFAULT '[]'::jsonb,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  anchors jsonb NOT NULL DEFAULT '{}'::jsonb,
  qualifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, version_number),
  UNIQUE (position_id, label)
);

GRANT SELECT, INSERT, UPDATE ON public.rubric_versions TO authenticated;
GRANT ALL ON public.rubric_versions TO service_role;
ALTER TABLE public.rubric_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read rubric versions"
  ON public.rubric_versions FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));
CREATE POLICY "org editors write rubric versions"
  ON public.rubric_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));
CREATE POLICY "org editors update rubric versions"
  ON public.rubric_versions FOR UPDATE TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER trg_rubric_versions_touch_updated_at
  BEFORE UPDATE ON public.rubric_versions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE OR REPLACE FUNCTION public.tg_rubric_versions_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('approved','active','superseded') THEN
    IF NEW.dimensions IS DISTINCT FROM OLD.dimensions
       OR NEW.weights IS DISTINCT FROM OLD.weights
       OR NEW.anchors IS DISTINCT FROM OLD.anchors
       OR NEW.qualifiers IS DISTINCT FROM OLD.qualifiers
       OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
       OR NEW.version_number IS DISTINCT FROM OLD.version_number
       OR NEW.position_id IS DISTINCT FROM OLD.position_id
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'rubric_versions row % is immutable once approved (status=%)', OLD.id, OLD.status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rubric_versions_immutable
  BEFORE UPDATE ON public.rubric_versions
  FOR EACH ROW EXECUTE FUNCTION public.tg_rubric_versions_immutable();

CREATE INDEX idx_rubric_versions_position ON public.rubric_versions(position_id, status);
CREATE UNIQUE INDEX idx_rubric_versions_one_active
  ON public.rubric_versions(position_id) WHERE status = 'active';

-- 2. canonical_scoring_state ----------------------------------------------
CREATE TYPE public.canonical_scoring_state AS ENUM (
  'ingestion','evidence_extraction','provisional_scoring','human_review',
  'approved','published_to_client','returned_for_correction','superseded','failed'
);

ALTER TABLE public.candidate_matches
  ADD COLUMN canonical_state public.canonical_scoring_state NOT NULL DEFAULT 'ingestion';

UPDATE public.candidate_matches m
   SET canonical_state = CASE
     WHEN m.client_visibility = 'visible' AND m.approved_score_run_id IS NOT NULL THEN 'published_to_client'::public.canonical_scoring_state
     WHEN m.approved_score_run_id IS NOT NULL THEN 'approved'::public.canonical_scoring_state
     WHEN m.current_score_run_id IS NOT NULL THEN 'human_review'::public.canonical_scoring_state
     WHEN m.processing_state::text ILIKE '%fail%' THEN 'failed'::public.canonical_scoring_state
     WHEN m.processing_state::text ILIKE '%evidence%' THEN 'evidence_extraction'::public.canonical_scoring_state
     WHEN m.processing_state::text ILIKE '%scor%' THEN 'provisional_scoring'::public.canonical_scoring_state
     ELSE 'ingestion'::public.canonical_scoring_state
   END;

CREATE INDEX idx_candidate_matches_canonical_state
  ON public.candidate_matches(canonical_state);

CREATE OR REPLACE FUNCTION public.tg_candidate_matches_canonical_state()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  o text := OLD.canonical_state::text;
  n text := NEW.canonical_state::text;
  allowed boolean := false;
BEGIN
  IF o = n THEN RETURN NEW; END IF;
  allowed := CASE
    WHEN o='ingestion'               AND n IN ('evidence_extraction','failed') THEN true
    WHEN o='evidence_extraction'     AND n IN ('provisional_scoring','failed','returned_for_correction') THEN true
    WHEN o='provisional_scoring'     AND n IN ('human_review','failed','returned_for_correction') THEN true
    WHEN o='human_review'            AND n IN ('approved','returned_for_correction','failed') THEN true
    WHEN o='returned_for_correction' AND n IN ('evidence_extraction','provisional_scoring','human_review','failed') THEN true
    WHEN o='approved'                AND n IN ('published_to_client','returned_for_correction','superseded') THEN true
    WHEN o='published_to_client'     AND n IN ('superseded','returned_for_correction') THEN true
    WHEN o='superseded'              AND n IN ('returned_for_correction') THEN true
    WHEN o='failed'                  AND n IN ('ingestion','returned_for_correction') THEN true
    ELSE false
  END;
  IF NOT allowed THEN
    RAISE EXCEPTION 'invalid_canonical_state_transition: % -> %', o, n
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_candidate_matches_canonical_state
  BEFORE UPDATE ON public.candidate_matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_candidate_matches_canonical_state();

-- 3. rubric_version_id on score_runs -------------------------------------
ALTER TABLE public.score_runs
  ADD COLUMN rubric_version_id uuid REFERENCES public.rubric_versions(id) ON DELETE RESTRICT;

-- 4. Backfill (immutability trigger temporarily disabled) ----------------
INSERT INTO public.rubric_versions
  (position_id, organization_id, version_number, status, label, snapshot, approved_at, created_at)
SELECT
  sr.position_id,
  sr.organization_id,
  ROW_NUMBER() OVER (PARTITION BY sr.position_id ORDER BY MIN(sr.started_at)) AS version_number,
  'superseded'::public.rubric_version_status,
  sr.blueprint_version,
  jsonb_build_object('source','backfill','blueprint_version', sr.blueprint_version),
  MIN(sr.started_at),
  MIN(sr.started_at)
FROM public.score_runs sr
WHERE sr.blueprint_version IS NOT NULL
GROUP BY sr.position_id, sr.organization_id, sr.blueprint_version;

WITH latest AS (
  SELECT DISTINCT ON (position_id) id
    FROM public.rubric_versions
   ORDER BY position_id, version_number DESC
)
UPDATE public.rubric_versions rv
   SET status = 'active', approved_at = COALESCE(rv.approved_at, now())
  FROM latest
 WHERE rv.id = latest.id;

ALTER TABLE public.score_runs DISABLE TRIGGER score_runs_immutable;

UPDATE public.score_runs sr
   SET rubric_version_id = rv.id
  FROM public.rubric_versions rv
 WHERE rv.position_id = sr.position_id
   AND rv.label = sr.blueprint_version
   AND sr.rubric_version_id IS NULL;

ALTER TABLE public.score_runs ENABLE TRIGGER score_runs_immutable;

-- 5. scoring_orphans -----------------------------------------------------
CREATE TABLE public.scoring_orphans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_match_id uuid REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  score_run_id uuid REFERENCES public.score_runs(id) ON DELETE CASCADE,
  organization_id uuid,
  reason text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  detected_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.scoring_orphans TO authenticated;
GRANT ALL ON public.scoring_orphans TO service_role;
ALTER TABLE public.scoring_orphans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform staff read scoring orphans"
  ON public.scoring_orphans FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "platform staff update scoring orphans"
  ON public.scoring_orphans FOR UPDATE TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

INSERT INTO public.scoring_orphans (candidate_match_id, score_run_id, organization_id, reason, detail)
SELECT sr.candidate_match_id, sr.id, sr.organization_id,
       'missing_rubric_version',
       jsonb_build_object('blueprint_version', sr.blueprint_version)
  FROM public.score_runs sr
 WHERE sr.rubric_version_id IS NULL
   AND sr.status = 'completed';

-- 6. Extend publish gate -------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_candidate_matches_publish_gate()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE r RECORD;
BEGIN
  IF NEW.client_visibility='visible' AND NEW.approved_score_run_id IS NULL THEN
    RAISE EXCEPTION 'publish gate: cannot mark visible without approved_score_run_id'
      USING ERRCODE='check_violation';
  END IF;

  IF NEW.client_visibility='visible' AND NEW.canonical_state <> 'published_to_client' THEN
    RAISE EXCEPTION 'publish gate: canonical_state must be published_to_client (got %)', NEW.canonical_state
      USING ERRCODE='check_violation';
  END IF;

  IF NEW.approved_score_run_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP='UPDATE'
     AND OLD.approved_score_run_id IS NOT DISTINCT FROM NEW.approved_score_run_id
     AND OLD.client_visibility IS NOT DISTINCT FROM NEW.client_visibility
     AND OLD.canonical_state IS NOT DISTINCT FROM NEW.canonical_state THEN
    RETURN NEW;
  END IF;

  SELECT candidate_match_id, position_id, application_id, candidate_profile_id,
         organization_id, status, evidence, raw_score, applied_cap, final_score,
         contradiction_status, rubric_version_id
    INTO r FROM public.score_runs WHERE id = NEW.approved_score_run_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'publish gate: approved_score_run_id % not found', NEW.approved_score_run_id
      USING ERRCODE='foreign_key_violation';
  END IF;
  IF r.candidate_match_id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'publish gate: approved run belongs to a different match';
  END IF;
  IF r.position_id IS DISTINCT FROM NEW.position_id
     OR r.application_id IS DISTINCT FROM NEW.application_id
     OR r.candidate_profile_id IS DISTINCT FROM NEW.candidate_profile_id
     OR r.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'publish gate: approved run identity mismatch';
  END IF;
  IF r.status IS DISTINCT FROM 'completed'::public.score_status THEN
    RAISE EXCEPTION 'publish gate: approved run status=% (must be completed)', r.status;
  END IF;
  IF r.contradiction_status = 'disqualifying_answer' THEN
    RAISE EXCEPTION 'publish gate: approved run has a disqualifying contradiction';
  END IF;
  IF NEW.client_visibility='visible' AND r.rubric_version_id IS NULL THEN
    RAISE EXCEPTION 'publish gate: approved run is not linked to a rubric_version';
  END IF;
  IF r.final_score > r.applied_cap OR r.final_score > r.raw_score THEN
    RAISE EXCEPTION 'publish gate: math invariant broken';
  END IF;
  RETURN NEW;
END $function$;

-- 7. client_visible_candidates view --------------------------------------
CREATE OR REPLACE VIEW public.client_visible_candidates
WITH (security_invoker = on) AS
SELECT
  m.id                       AS candidate_match_id,
  m.application_id,
  m.candidate_profile_id,
  m.position_id,
  m.organization_id,
  m.stage,
  m.admin_status,
  m.client_visibility,
  m.canonical_state,
  m.delivered_at,
  m.created_at               AS match_created_at,
  m.updated_at               AS match_updated_at,
  m.approved_score_run_id,
  sr.rubric_version_id,
  sr.final_score,
  sr.raw_score,
  sr.applied_cap,
  sr.evidence,
  sr.blueprint_version,
  sr.engine_version,
  sr.contradiction_status,
  sr.completed_at            AS scored_at
FROM public.candidate_matches m
JOIN public.score_runs sr ON sr.id = m.approved_score_run_id
WHERE m.client_visibility = 'visible'
  AND m.canonical_state = 'published_to_client'
  AND sr.status = 'completed'
  AND sr.rubric_version_id IS NOT NULL;

GRANT SELECT ON public.client_visible_candidates TO authenticated, service_role;
