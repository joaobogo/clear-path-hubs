
-- 1. Extend candidate_evidence_items
ALTER TABLE public.candidate_evidence_items
  ADD COLUMN IF NOT EXISTS result text
    CHECK (result IN ('strong','partial','weak','missing','contradictory','not_applicable','needs_validation')),
  ADD COLUMN IF NOT EXISTS validation_need text,
  ADD COLUMN IF NOT EXISTS integrity_ok boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_kind text
    CHECK (source_kind IN ('cv','application_answer','interview','manual')) DEFAULT 'cv',
  ADD COLUMN IF NOT EXISTS source_ref uuid,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_evidence_items_integrity
  ON public.candidate_evidence_items(candidate_match_id) WHERE integrity_ok = false;

-- 2. Add integrity_status to candidate_matches
DO $$ BEGIN
  CREATE TYPE public.integrity_status AS ENUM ('ok','missing_required','contradictions','manual_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.candidate_matches
  ADD COLUMN IF NOT EXISTS integrity_status public.integrity_status NOT NULL DEFAULT 'ok';

CREATE INDEX IF NOT EXISTS idx_candidate_matches_integrity
  ON public.candidate_matches(organization_id, integrity_status)
  WHERE integrity_status <> 'ok';

-- 3. evidence_overrides (append-only)
CREATE TABLE IF NOT EXISTS public.evidence_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_item_id uuid NOT NULL REFERENCES public.candidate_evidence_items(id) ON DELETE CASCADE,
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  reason text NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.evidence_overrides TO authenticated;
GRANT ALL ON public.evidence_overrides TO service_role;

ALTER TABLE public.evidence_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org staff read evidence overrides"
  ON public.evidence_overrides FOR SELECT TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR public.is_org_editor(auth.uid(), organization_id)
  );

CREATE POLICY "org staff insert evidence overrides"
  ON public.evidence_overrides FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_platform_staff(auth.uid())
      OR public.is_org_editor(auth.uid(), organization_id))
    AND actor_user_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.tg_evidence_overrides_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'evidence_overrides is append-only' USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS trg_evidence_overrides_no_update ON public.evidence_overrides;
CREATE TRIGGER trg_evidence_overrides_no_update
  BEFORE UPDATE OR DELETE ON public.evidence_overrides
  FOR EACH ROW EXECUTE FUNCTION public.tg_evidence_overrides_append_only();

-- 4. Client-safe evidence view (never expose model prompts, rejected candidates, debug)
CREATE OR REPLACE VIEW public.candidate_evidence_client AS
SELECT
  ei.id,
  ei.candidate_match_id,
  ei.organization_id,
  ei.rubric_criterion_key,
  ei.rubric_dimension_key,
  ei.result,
  ei.match_type,
  ei.confidence,
  ei.source_passage       AS factual_quote,
  ei.normalized_meaning   AS interpretation,
  ei.validation_need,
  ei.source_kind,
  ei.source_ref,
  ei.source_location,
  ei.last_reviewed_at
FROM public.candidate_evidence_items ei
WHERE ei.reviewer_status IN ('accepted','edited')
  AND ei.integrity_ok = true;

GRANT SELECT ON public.candidate_evidence_client TO authenticated;

-- 5. Publish gate: block visibility when integrity_status <> 'ok'
CREATE OR REPLACE FUNCTION public.tg_candidate_matches_publish_gate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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

  IF NEW.client_visibility='visible' AND NEW.integrity_status <> 'ok' THEN
    RAISE EXCEPTION 'publish gate: integrity_status must be ok (got %)', NEW.integrity_status
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
END $$;
