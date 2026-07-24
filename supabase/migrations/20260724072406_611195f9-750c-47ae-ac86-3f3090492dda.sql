CREATE OR REPLACE FUNCTION public.hard_delete_candidate_match(
  _match_id uuid,
  _actor_user_id uuid,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_match record;
  v_profile_id uuid;
  v_application_id uuid;
  v_score_run_ids uuid[] := ARRAY[]::uuid[];
  v_file_ids uuid[] := ARRAY[]::uuid[];
  v_deleted jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_platform_staff(_actor_user_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id, candidate_profile_id, application_id, current_score_run_id, approved_score_run_id
    INTO v_match
    FROM public.candidate_matches
   WHERE id = _match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  v_profile_id := v_match.candidate_profile_id;
  v_application_id := v_match.application_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_score_run_ids
    FROM public.score_runs
   WHERE candidate_match_id = _match_id
      OR application_id = v_application_id
      OR candidate_profile_id = v_profile_id
      OR id = v_match.current_score_run_id
      OR id = v_match.approved_score_run_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_file_ids
    FROM public.files
   WHERE candidate_profile_id = v_profile_id
      OR id IN (
        SELECT current_cv_file_id
          FROM public.candidate_profiles
         WHERE id = v_profile_id
           AND current_cv_file_id IS NOT NULL
      );

  -- Remove free-floating references that would otherwise be nulled and keep traces of the candidate.
  DELETE FROM public.notification_events
   WHERE candidate_match_id = _match_id
      OR candidate_profile_id = v_profile_id
      OR application_id = v_application_id;

  DELETE FROM public.outreach_touches
   WHERE candidate_profile_id = v_profile_id
      OR application_id = v_application_id;

  DELETE FROM public.data_subject_requests
   WHERE candidate_profile_id = v_profile_id;

  DELETE FROM public.role_memory
   WHERE candidate_profile_id = v_profile_id;

  DELETE FROM public.tasks
   WHERE candidate_match_id = _match_id
      OR candidate_profile_id = v_profile_id;

  DELETE FROM public.shortlist_share_comments
   WHERE match_id = _match_id;

  UPDATE public.shortlist_shares
     SET match_ids = array_remove(match_ids, _match_id)
   WHERE _match_id = ANY(match_ids);

  DELETE FROM public.shortlist_shares
   WHERE cardinality(match_ids) = 0;

  DELETE FROM public.audit_events
   WHERE entity_id = _match_id
      OR entity_id = v_profile_id
      OR entity_id = v_application_id
      OR entity_id = ANY(v_score_run_ids)
      OR entity_id = ANY(v_file_ids)
      OR before_state @> jsonb_build_object('candidate_match_id', _match_id::text)
      OR after_state @> jsonb_build_object('candidate_match_id', _match_id::text)
      OR before_state @> jsonb_build_object('candidate_profile_id', v_profile_id::text)
      OR after_state @> jsonb_build_object('candidate_profile_id', v_profile_id::text)
      OR before_state @> jsonb_build_object('application_id', v_application_id::text)
      OR after_state @> jsonb_build_object('application_id', v_application_id::text);

  -- Break circular score/file references before deleting.
  UPDATE public.candidate_matches
     SET current_score_run_id = NULL,
         approved_score_run_id = NULL
   WHERE id = _match_id;

  UPDATE public.candidate_profiles
     SET current_cv_file_id = NULL
   WHERE id = v_profile_id;

  -- These tables are intentionally append-only/immutable in normal workflows.
  -- The hard-delete routine is the single controlled escape hatch for admin data purges.
  ALTER TABLE public.score_runs DISABLE TRIGGER USER;
  ALTER TABLE public.candidate_stage_history DISABLE TRIGGER USER;
  ALTER TABLE public.evidence_overrides DISABLE TRIGGER USER;
  ALTER TABLE public.candidate_matches DISABLE TRIGGER USER;

  DELETE FROM public.evidence_overrides
   WHERE candidate_match_id = _match_id;

  DELETE FROM public.candidate_evidence_items
   WHERE candidate_match_id = _match_id;

  DELETE FROM public.candidate_evidence
   WHERE candidate_match_id = _match_id
      OR candidate_profile_id = v_profile_id;

  DELETE FROM public.score_decisions
   WHERE candidate_match_id = _match_id
      OR score_run_id = ANY(v_score_run_ids);

  DELETE FROM public.scoring_debug_events
   WHERE candidate_match_id = _match_id
      OR score_run_id = ANY(v_score_run_ids);

  DELETE FROM public.scoring_orphans
   WHERE candidate_match_id = _match_id
      OR score_run_id = ANY(v_score_run_ids);

  DELETE FROM public.score_runs
   WHERE candidate_match_id = _match_id
      OR application_id = v_application_id
      OR candidate_profile_id = v_profile_id
      OR id = ANY(v_score_run_ids);

  DELETE FROM public.candidate_stage_history
   WHERE candidate_match_id = _match_id
      OR candidate_profile_id = v_profile_id;

  DELETE FROM public.candidate_matches
   WHERE id = _match_id;

  ALTER TABLE public.candidate_matches ENABLE TRIGGER USER;
  ALTER TABLE public.evidence_overrides ENABLE TRIGGER USER;
  ALTER TABLE public.candidate_stage_history ENABLE TRIGGER USER;
  ALTER TABLE public.score_runs ENABLE TRIGGER USER;

  -- Cascades from candidate_profiles remove applications, answers, files, consent, talent memory, pool links, etc.
  DELETE FROM public.candidate_profiles
   WHERE id = v_profile_id;

  -- Clean any remaining file rows collected before profile deletion.
  DELETE FROM public.files
   WHERE id = ANY(v_file_ids);

  v_deleted := jsonb_build_object(
    'match_id', _match_id,
    'candidate_profile_id', v_profile_id,
    'application_id', v_application_id,
    'score_run_count', COALESCE(array_length(v_score_run_ids, 1), 0),
    'file_count', COALESCE(array_length(v_file_ids, 1), 0),
    'reason', _reason
  );

  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);
EXCEPTION WHEN OTHERS THEN
  BEGIN
    ALTER TABLE public.candidate_matches ENABLE TRIGGER USER;
    ALTER TABLE public.evidence_overrides ENABLE TRIGGER USER;
    ALTER TABLE public.candidate_stage_history ENABLE TRIGGER USER;
    ALTER TABLE public.score_runs ENABLE TRIGGER USER;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.hard_delete_candidate_match(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hard_delete_candidate_match(uuid, uuid, text) TO service_role;