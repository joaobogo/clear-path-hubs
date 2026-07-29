CREATE OR REPLACE FUNCTION public.hard_delete_position(_position_id uuid, _actor_user_id uuid, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pos record;
  v_match_ids uuid[] := ARRAY[]::uuid[];
  v_application_ids uuid[] := ARRAY[]::uuid[];
  v_score_run_ids uuid[] := ARRAY[]::uuid[];
  v_match record;
  v_deleted jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_platform_staff(_actor_user_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id, organization_id, title INTO v_pos
    FROM public.positions WHERE id = _position_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'position_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  FOR v_match IN SELECT id FROM public.candidate_matches WHERE position_id = _position_id LOOP
    PERFORM public.hard_delete_candidate_match(v_match.id, _actor_user_id, _reason);
    v_match_ids := v_match_ids || v_match.id;
  END LOOP;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_application_ids
    FROM public.applications WHERE position_id = _position_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_score_run_ids
    FROM public.score_runs WHERE position_id = _position_id;

  ALTER TABLE public.score_runs DISABLE TRIGGER USER;
  ALTER TABLE public.position_versions DISABLE TRIGGER USER;
  ALTER TABLE public.candidate_stage_history DISABLE TRIGGER USER;
  ALTER TABLE public.rubric_versions DISABLE TRIGGER USER;

  DELETE FROM public.scoring_orphans WHERE score_run_id = ANY(v_score_run_ids);
  DELETE FROM public.scoring_debug_events WHERE score_run_id = ANY(v_score_run_ids);
  DELETE FROM public.score_decisions WHERE score_run_id = ANY(v_score_run_ids);
  DELETE FROM public.score_runs WHERE position_id = _position_id;

  DELETE FROM public.candidate_stage_history WHERE position_id = _position_id;
  DELETE FROM public.eligibility_checks WHERE position_id = _position_id;
  DELETE FROM public.hire_records WHERE position_id = _position_id;
  DELETE FROM public.interviews WHERE position_id = _position_id;
  DELETE FROM public.notification_events WHERE position_id = _position_id;
  DELETE FROM public.outreach_touches
    WHERE campaign_id IN (SELECT id FROM public.outreach_campaigns WHERE position_id = _position_id);
  DELETE FROM public.outreach_campaigns WHERE position_id = _position_id;
  DELETE FROM public.role_memory WHERE position_id = _position_id;
  DELETE FROM public.rubric_versions WHERE position_id = _position_id;
  DELETE FROM public.screening_questions WHERE position_id = _position_id;
  DELETE FROM public.shortlist_share_comments
    WHERE share_id IN (SELECT id FROM public.shortlist_shares WHERE position_id = _position_id);
  DELETE FROM public.shortlist_shares WHERE position_id = _position_id;
  DELETE FROM public.talent_memory_events WHERE position_id = _position_id;
  UPDATE public.talent_memory SET source_position_id = NULL WHERE source_position_id = _position_id;
  DELETE FROM public.tasks WHERE position_id = _position_id;
  DELETE FROM public.position_versions WHERE position_id = _position_id;
  DELETE FROM public.intake_submissions WHERE position_id = _position_id;
  DELETE FROM public.application_answers WHERE application_id = ANY(v_application_ids);
  DELETE FROM public.applications WHERE position_id = _position_id;

  DELETE FROM public.processing_jobs WHERE entity_id = _position_id;

  DELETE FROM public.audit_events
    WHERE entity_id = _position_id
       OR entity_id = ANY(v_application_ids)
       OR entity_id = ANY(v_score_run_ids)
       OR before_state @> jsonb_build_object('position_id', _position_id::text)
       OR after_state @> jsonb_build_object('position_id', _position_id::text);

  DELETE FROM public.positions WHERE id = _position_id;

  DELETE FROM public.audit_events
    WHERE entity_id = _position_id
       OR before_state @> jsonb_build_object('position_id', _position_id::text)
       OR after_state @> jsonb_build_object('position_id', _position_id::text);

  ALTER TABLE public.rubric_versions ENABLE TRIGGER USER;
  ALTER TABLE public.candidate_stage_history ENABLE TRIGGER USER;
  ALTER TABLE public.position_versions ENABLE TRIGGER USER;
  ALTER TABLE public.score_runs ENABLE TRIGGER USER;

  v_deleted := jsonb_build_object(
    'position_id', _position_id,
    'organization_id', v_pos.organization_id,
    'title', v_pos.title,
    'match_count', COALESCE(array_length(v_match_ids, 1), 0),
    'application_count', COALESCE(array_length(v_application_ids, 1), 0),
    'score_run_count', COALESCE(array_length(v_score_run_ids, 1), 0),
    'reason', _reason
  );
  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);
EXCEPTION WHEN OTHERS THEN
  BEGIN
    ALTER TABLE public.rubric_versions ENABLE TRIGGER USER;
    ALTER TABLE public.candidate_stage_history ENABLE TRIGGER USER;
    ALTER TABLE public.position_versions ENABLE TRIGGER USER;
    ALTER TABLE public.score_runs ENABLE TRIGGER USER;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE;
END;
$function$;

REVOKE ALL ON FUNCTION public.hard_delete_position(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_position(uuid, uuid, text) TO service_role;