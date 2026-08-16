-- PROMPT 13 — Release audit register fixes: F-006, F-010, F-012
-- F-006: transactional publish gate inside approve_candidate_match
-- F-010: dedupe candidate_matches + unconditional unique index on (position_id, candidate_profile_id)
-- F-012: re-affirm notification_events visibility-join policy

-- ============================================================================
-- F-006 — Transactional publish gate inside the approve RPC
-- ============================================================================
-- The app already calls assertPublishGate before the RPC, but that gate runs
-- outside the row lock. This function re-verifies the same minimum conditions
-- inside the same transaction as the score_decisions insert and the
-- candidate_matches update, so any failure rolls back together and leaves no
-- orphaned approve decision.

DROP FUNCTION IF EXISTS public.approve_candidate_match(uuid, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.approve_candidate_match(
  _match_id uuid,
  _run_id uuid,
  _actor_user_id uuid,
  _reason text DEFAULT NULL,
  _trace_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  before_state jsonb;
  cur public.canonical_scoring_state;
  nxt public.canonical_scoring_state;
  path text[] := ARRAY[]::text[];
  guard int := 0;
  inserted_decision boolean := false;
  trace text := COALESCE(_trace_id, 'approve-' || _match_id::text || '-' || extract(epoch from clock_timestamp())::bigint::text);
BEGIN
  SELECT id, current_score_run_id, approved_score_run_id, canonical_state,
         admin_status, client_visibility, stage, delivered_at, integrity_status,
         organization_id, position_id, application_id, candidate_profile_id
    INTO m
    FROM public.candidate_matches
   WHERE id = _match_id
   FOR UPDATE;

  IF m.id IS NULL THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  -- Transactional publish gate: the run must exist, belong to this match,
  -- be completed, and not carry a disqualifying contradiction. This runs
  -- inside the same transaction as the score_decisions insert and the
  -- candidate_matches update, so any failure leaves no orphaned decision.
  IF NOT EXISTS (
    SELECT 1 FROM public.score_runs
     WHERE id = _run_id
       AND candidate_match_id = _match_id
       AND position_id = m.position_id
       AND status = 'completed'
       AND COALESCE(contradiction_status, '') NOT IN ('disqualifying_answer', 'contradiction_found')
  ) THEN
    RAISE EXCEPTION 'publish_gate:not_publishable';
  END IF;

  before_state := jsonb_build_object(
    'canonical_state', m.canonical_state,
    'admin_status', m.admin_status,
    'client_visibility', m.client_visibility,
    'stage', m.stage,
    'integrity_status', m.integrity_status,
    'approved_score_run_id', m.approved_score_run_id,
    'current_score_run_id', m.current_score_run_id,
    'delivered_at', m.delivered_at
  );

  -- Idempotent: already published with this run -> no-op success.
  IF m.canonical_state = 'published_to_client'
     AND m.client_visibility = 'visible'
     AND m.admin_status = 'approved'
     AND m.approved_score_run_id = _run_id THEN
    INSERT INTO public.audit_events
      (actor_user_id, organization_id, entity_type, entity_id, action,
       before_state, after_state, trace_id)
    VALUES (_actor_user_id, m.organization_id, 'candidate_match', m.id,
            'score_approval_noop', before_state,
            before_state || jsonb_build_object('already_approved', true,
                                               'score_run_id', _run_id,
                                               'reason', _reason),
            trace);
    RETURN jsonb_build_object(
      'ok', true, 'already', true, 'match_id', m.id, 'trace_id', trace,
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
    path := path || nxt::text;
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
             integrity_status, approved_score_run_id, delivered_at,
             organization_id, position_id, application_id, candidate_profile_id
    INTO m;

  IF m.client_visibility <> 'visible' THEN
    RAISE EXCEPTION 'not_visible_after_update';
  END IF;

  INSERT INTO public.audit_events
    (actor_user_id, organization_id, entity_type, entity_id, action,
     before_state, after_state, trace_id)
  VALUES (_actor_user_id, m.organization_id, 'candidate_match', m.id,
          'score_approved', before_state,
          jsonb_build_object(
            'canonical_state', m.canonical_state,
            'admin_status', m.admin_status,
            'client_visibility', m.client_visibility,
            'stage', m.stage,
            'integrity_status', m.integrity_status,
            'approved_score_run_id', m.approved_score_run_id,
            'delivered_at', m.delivered_at,
            'score_run_id', _run_id,
            'reason', _reason,
            'decision_inserted', inserted_decision,
            'state_path', to_jsonb(path)
          ),
          trace);

  RETURN jsonb_build_object(
    'ok', true, 'already', false, 'decision_inserted', inserted_decision,
    'match_id', m.id, 'trace_id', trace, 'state_path', to_jsonb(path),
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

REVOKE ALL ON FUNCTION public.approve_candidate_match(uuid, uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_candidate_match(uuid, uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.approve_candidate_match(uuid, uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.approve_candidate_match(uuid, uuid, uuid, text, text) TO service_role;

-- ============================================================================
-- F-010 — Unconditional unique index on candidate_matches(position_id, candidate_profile_id)
-- ============================================================================
-- First, remove any duplicate rows that would block the index. Keep the most
-- recently updated row (and the oldest id as a deterministic tie-breaker).

DELETE FROM public.candidate_matches
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY position_id, candidate_profile_id
        ORDER BY updated_at DESC, created_at DESC, id DESC
      ) AS rn
    FROM public.candidate_matches
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS candidate_matches_position_candidate_uq
  ON public.candidate_matches (position_id, candidate_profile_id);

-- ============================================================================
-- F-012 — Re-affirm notification_events visibility-join policy
-- ============================================================================
-- Org viewers may only see events that are either position-level (no candidate
-- attached) or tied to a candidate that is explicitly visible to them. The
-- visibility check is performed by security-definer helpers so the join does
-- not leak through RLS recursion.

DROP POLICY IF EXISTS events_org_read ON public.notification_events;
CREATE POLICY events_org_read ON public.notification_events
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.is_org_viewer(auth.uid(), organization_id)
    AND (candidate_match_id IS NULL OR public.is_match_client_visible(auth.uid(), candidate_match_id))
    AND (candidate_profile_id IS NULL OR public.is_candidate_visible_to_org(auth.uid(), organization_id, candidate_profile_id))
  );
