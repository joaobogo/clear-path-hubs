-- 1) score_runs.position_id MUST equal candidate_matches.position_id.
--    Enforced by trigger because CHECK constraints can't reference other tables.
CREATE OR REPLACE FUNCTION public.tg_score_runs_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  match_pos uuid;
BEGIN
  SELECT position_id INTO match_pos
  FROM public.candidate_matches
  WHERE id = NEW.candidate_match_id;

  IF match_pos IS NULL THEN
    RAISE EXCEPTION 'score_runs identity: candidate_match % has no row', NEW.candidate_match_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.position_id IS DISTINCT FROM match_pos THEN
    RAISE EXCEPTION 'score_runs identity mismatch: run.position_id=% match.position_id=%',
      NEW.position_id, match_pos
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS score_runs_identity ON public.score_runs;
CREATE TRIGGER score_runs_identity
  BEFORE INSERT ON public.score_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_score_runs_identity();

-- 2) Publish gate: approved_score_run_id must (a) belong to the same match, and
--    (b) be a completed run with non-empty evidence.
CREATE OR REPLACE FUNCTION public.tg_candidate_matches_publish_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  r RECORD;
BEGIN
  IF NEW.approved_score_run_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.approved_score_run_id IS NOT DISTINCT FROM NEW.approved_score_run_id THEN
    -- Same approved run as before; nothing to re-validate.
    RETURN NEW;
  END IF;

  SELECT candidate_match_id, position_id, status, evidence
    INTO r
    FROM public.score_runs
   WHERE id = NEW.approved_score_run_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'publish gate: approved_score_run_id % not found', NEW.approved_score_run_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF r.candidate_match_id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'publish gate: approved run % belongs to match %, not %',
      NEW.approved_score_run_id, r.candidate_match_id, NEW.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF r.position_id IS DISTINCT FROM NEW.position_id THEN
    RAISE EXCEPTION 'publish gate: approved run position % != match position %',
      r.position_id, NEW.position_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF r.status IS DISTINCT FROM 'completed'::public.score_status THEN
    RAISE EXCEPTION 'publish gate: approved run status=% (must be completed)', r.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF r.evidence IS NULL OR jsonb_typeof(r.evidence) <> 'array' OR jsonb_array_length(r.evidence) = 0 THEN
    RAISE EXCEPTION 'publish gate: approved run has empty evidence'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS candidate_matches_publish_gate ON public.candidate_matches;
CREATE TRIGGER candidate_matches_publish_gate
  BEFORE UPDATE ON public.candidate_matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_candidate_matches_publish_gate();

-- 3) Fast readiness helper the app uses instead of composing four selects.
CREATE OR REPLACE FUNCTION public.scoring_readiness(_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  m RECORD;
  p RECORD;
  cp RECORD;
  f RECORD;
  answer_count int;
  blockers text[] := ARRAY[]::text[];
BEGIN
  SELECT id, application_id, candidate_profile_id, position_id, organization_id,
         processing_state
    INTO m FROM public.candidate_matches WHERE id = _match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'blockers', ARRAY['match_not_found']);
  END IF;

  SELECT id, status, requirements, preferred_requirements, organization_id
    INTO p FROM public.positions WHERE id = m.position_id;
  IF NOT FOUND THEN blockers := blockers || 'position_not_found';
  ELSE
    IF p.status NOT IN ('active','draft','ready_for_review') THEN
      blockers := blockers || ('position_status:' || p.status);
    END IF;
    IF (COALESCE(jsonb_array_length(p.requirements), 0)
        + COALESCE(jsonb_array_length(p.preferred_requirements), 0)) = 0 THEN
      blockers := blockers || 'requirements_missing';
    END IF;
    IF p.organization_id IS DISTINCT FROM m.organization_id THEN
      blockers := blockers || 'tenant_mismatch';
    END IF;
  END IF;

  SELECT id, current_cv_file_id INTO cp
    FROM public.candidate_profiles WHERE id = m.candidate_profile_id;
  IF NOT FOUND THEN blockers := blockers || 'candidate_profile_not_found';
  ELSIF cp.current_cv_file_id IS NULL THEN blockers := blockers || 'cv_missing';
  ELSE
    SELECT id, extracted_text, extraction_completed_at
      INTO f FROM public.files WHERE id = cp.current_cv_file_id;
    IF NOT FOUND THEN blockers := blockers || 'cv_file_missing';
    ELSIF f.extracted_text IS NULL OR length(f.extracted_text) < 60 THEN
      blockers := blockers || 'cv_unparsed';
    END IF;
  END IF;

  SELECT count(*) INTO answer_count FROM public.application_answers
   WHERE application_id = m.application_id;

  RETURN jsonb_build_object(
    'ok', array_length(blockers, 1) IS NULL,
    'blockers', COALESCE(blockers, ARRAY[]::text[]),
    'match_id', m.id,
    'application_id', m.application_id,
    'candidate_profile_id', m.candidate_profile_id,
    'position_id', m.position_id,
    'organization_id', m.organization_id,
    'processing_state', m.processing_state,
    'screening_answer_count', answer_count
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.scoring_readiness(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.scoring_readiness(uuid) TO authenticated, service_role;