CREATE OR REPLACE FUNCTION public.admin_bulk_assign_candidates(_position_id uuid, _candidate_profile_ids uuid[], _actor_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _org uuid;
  _status position_status;
  _requested int := coalesce(array_length(_candidate_profile_ids, 1), 0);
  _changed int := 0;
  _results jsonb := '[]'::jsonb;
BEGIN
  SELECT organization_id, status INTO _org, _status
  FROM public.positions WHERE id = _position_id;

  IF _org IS NULL THEN
    RAISE EXCEPTION 'Position not found';
  END IF;

  -- Per-candidate outcome, computed before any write so the caller can report
  -- partial success accurately.
  CREATE TEMP TABLE _assign_plan ON COMMIT DROP AS
  SELECT
    cid AS candidate_profile_id,
    cp.full_name,
    CASE
      WHEN cp.id IS NULL THEN 'Candidate not found'
      WHEN _status = 'closed' THEN 'Role is closed'
      WHEN EXISTS (
        SELECT 1 FROM public.candidate_matches cm
        WHERE cm.position_id = _position_id AND cm.candidate_profile_id = cp.id
      ) THEN 'Already on this role'
      ELSE NULL
    END AS reason
  FROM unnest(_candidate_profile_ids) AS cid
  LEFT JOIN public.candidate_profiles cp ON cp.id = cid;

  WITH eligible AS (
    SELECT candidate_profile_id FROM _assign_plan WHERE reason IS NULL
  ), inserted_apps AS (
    INSERT INTO public.applications (candidate_profile_id, position_id, status, source)
    SELECT candidate_profile_id, _position_id, 'submitted'::application_status, 'admin_assignment'
    FROM eligible
    RETURNING id, candidate_profile_id
  ), inserted_matches AS (
    INSERT INTO public.candidate_matches (
      application_id, candidate_profile_id, position_id, organization_id,
      stage, admin_status, client_visibility
    )
    SELECT a.id, a.candidate_profile_id, _position_id, _org,
           'new'::match_stage, 'pending'::admin_review_status, 'hidden'::client_visibility
    FROM inserted_apps a
    RETURNING id, candidate_profile_id
  )
  SELECT count(*) INTO _changed FROM inserted_matches;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'candidate_profile_id', candidate_profile_id,
        'name', coalesce(full_name, 'Candidate'),
        'assigned', reason IS NULL,
        'reason', reason
      )
      ORDER BY coalesce(full_name, '')
    ),
    '[]'::jsonb
  ) INTO _results
  FROM _assign_plan;

  IF _changed > 0 THEN
    INSERT INTO public.audit_events (
      actor_user_id, organization_id, action, entity_type, entity_id, after_state
    )
    VALUES (
      _actor_user_id,
      _org,
      'bulk.assign_to_position',
      'position',
      _position_id,
      jsonb_build_object(
        'candidate_profile_ids', (
          SELECT coalesce(jsonb_agg(candidate_profile_id), '[]'::jsonb)
          FROM _assign_plan WHERE reason IS NULL
        ),
        'assigned', _changed,
        'skipped', _requested - _changed,
        'atomic', true
      )
    );
  END IF;

  DROP TABLE _assign_plan;

  RETURN jsonb_build_object(
    'changed', _changed,
    'skipped', _requested - _changed,
    'results', _results
  );
END;
$function$;