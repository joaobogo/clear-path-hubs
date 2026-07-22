
CREATE OR REPLACE FUNCTION public.scoring_readiness(_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD; p RECORD; cp RECORD; f RECORD;
  answer_count int;
  blockers text[] := ARRAY[]::text[];
BEGIN
  SELECT id, application_id, candidate_profile_id, position_id, organization_id, processing_state
    INTO m FROM public.candidate_matches WHERE id = _match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'blockers', ARRAY['match_not_found']);
  END IF;

  SELECT id, status::text AS status, requirements, preferred_requirements, organization_id
    INTO p FROM public.positions WHERE id = m.position_id;
  IF NOT FOUND THEN
    blockers := blockers || 'position_not_found';
  ELSE
    IF p.status NOT IN ('active','approved') THEN
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
  IF NOT FOUND THEN
    blockers := blockers || 'candidate_profile_not_found';
  ELSIF cp.current_cv_file_id IS NULL THEN
    blockers := blockers || 'cv_missing';
  ELSE
    SELECT id, extracted_text, extraction_completed_at
      INTO f FROM public.files WHERE id = cp.current_cv_file_id;
    IF NOT FOUND THEN
      blockers := blockers || 'cv_file_missing';
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
$function$;
