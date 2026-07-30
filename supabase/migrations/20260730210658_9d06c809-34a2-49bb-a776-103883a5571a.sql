CREATE OR REPLACE FUNCTION public.approve_candidate_match(
  _match_id uuid,
  _run_id uuid,
  _actor_user_id uuid,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  cur public.canonical_scoring_state;
  nxt public.canonical_scoring_state;
  guard int := 0;
  inserted_decision boolean := false;
BEGIN
  -- Serialize concurrent approvals of the same match.
  SELECT id, current_score_run_id, approved_score_run_id, canonical_state,
         admin_status, client_visibility, stage, delivered_at,
         organization_id, position_id, application_id, candidate_profile_id
    INTO m
    FROM public.candidate_matches
   WHERE id = _match_id
   FOR UPDATE;

  IF m.id IS NULL THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  -- Idempotent: already published with this run -> no-op success.
  IF m.canonical_state = 'published_to_client'
     AND m.client_visibility = 'visible'
     AND m.admin_status = 'approved'
     AND m.approved_score_run_id = _run_id THEN
    RETURN jsonb_build_object(
      'ok', true, 'already', true, 'match_id', m.id,
      'canonical_state', m.canonical_state,
      'admin_status', m.admin_status,
      'client_visibility', m.client_visibility,
      'stage', m.stage,
      'approved_score_run_id', m.approved_score_run_id,
      'delivered_at', m.delivered_at,
      'organization_id', m.organization_id,
      'position_id', m.position_id,
      'application_id', m.application_id,
      'candidate_profile_id', m.candidate_profile_id
    );
  END IF;

  -- Record the approval decision exactly once per (match, run).
  IF NOT EXISTS (
    SELECT 1 FROM public.score_decisions
     WHERE candidate_match_id = _match_id
       AND score_run_id = _run_id
       AND decision_type = 'approve'
  ) THEN
    INSERT INTO public.score_decisions
      (candidate_match_id, score_run_id, decision_type, reason, actor_user_id)
    VALUES (_match_id, _run_id, 'approve', _reason, _actor_user_id);
    inserted_decision := true;
  END IF;

  -- Walk the legal canonical-state path to 'approved' (triggers allow single hops only).
  cur := m.canonical_state;
  WHILE cur IS NOT NULL
        AND cur <> 'approved'
        AND cur <> 'published_to_client'
        AND guard < 12 LOOP
    guard := guard + 1;
    nxt := CASE cur
             WHEN 'ingestion' THEN 'evidence_extraction'
             WHEN 'evidence_extraction' THEN 'provisional_scoring'
             WHEN 'provisional_scoring' THEN 'human_review'
             WHEN 'human_review' THEN 'approved'
             WHEN 'returned_for_correction' THEN 'human_review'
             WHEN 'superseded' THEN 'returned_for_correction'
             WHEN 'failed' THEN 'ingestion'
             ELSE NULL
           END::public.canonical_scoring_state;
    IF nxt IS NULL THEN
      RAISE EXCEPTION 'approve_state:no_path_from:%', cur;
    END IF;
    UPDATE public.candidate_matches SET canonical_state = nxt WHERE id = _match_id;
    cur := nxt;
  END LOOP;

  IF cur IS NOT NULL AND cur <> 'approved' AND cur <> 'published_to_client' THEN
    RAISE EXCEPTION 'approve_state:path_not_converged:%', cur;
  END IF;

  UPDATE public.candidate_matches
     SET approved_score_run_id = _run_id,
         admin_status = 'approved',
         client_visibility = 'visible',
         canonical_state = 'published_to_client',
         integrity_status = 'ok',
         stage = 'delivered',
         delivered_at = COALESCE(delivered_at, now())
   WHERE id = _match_id
   RETURNING id, canonical_state, admin_status, client_visibility, stage,
             approved_score_run_id, delivered_at, organization_id,
             position_id, application_id, candidate_profile_id
    INTO m;

  IF m.client_visibility <> 'visible' THEN
    RAISE EXCEPTION 'not_visible_after_update';
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'already', false, 'decision_inserted', inserted_decision,
    'match_id', m.id,
    'canonical_state', m.canonical_state,
    'admin_status', m.admin_status,
    'client_visibility', m.client_visibility,
    'stage', m.stage,
    'approved_score_run_id', m.approved_score_run_id,
    'delivered_at', m.delivered_at,
    'organization_id', m.organization_id,
    'position_id', m.position_id,
    'application_id', m.application_id,
    'candidate_profile_id', m.candidate_profile_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_candidate_match(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_candidate_match(uuid, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.approve_candidate_match(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.approve_candidate_match(uuid, uuid, uuid, text) TO service_role;