CREATE OR REPLACE FUNCTION public.admin_bulk_assign_candidates(
  _position_id uuid,
  _candidate_profile_ids uuid[],
  _actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _org uuid;
  _status position_status;
  _eligible uuid[];
  _requested int := coalesce(array_length(_candidate_profile_ids, 1), 0);
  _changed int := 0;
BEGIN
  SELECT organization_id, status INTO _org, _status
  FROM public.positions WHERE id = _position_id;

  IF _org IS NULL THEN
    RAISE EXCEPTION 'Position not found';
  END IF;

  IF _status = 'closed' THEN
    RETURN jsonb_build_object('changed', 0, 'skipped', _requested, 'reason', 'Role is closed');
  END IF;

  SELECT coalesce(array_agg(cp.id), '{}'::uuid[]) INTO _eligible
  FROM public.candidate_profiles cp
  WHERE cp.id = ANY(_candidate_profile_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.candidate_matches cm
      WHERE cm.position_id = _position_id AND cm.candidate_profile_id = cp.id
    );

  IF coalesce(array_length(_eligible, 1), 0) = 0 THEN
    RETURN jsonb_build_object('changed', 0, 'skipped', _requested);
  END IF;

  WITH inserted_apps AS (
    INSERT INTO public.applications (candidate_profile_id, position_id, status, source)
    SELECT cid, _position_id, 'submitted'::application_status, 'admin_assignment'
    FROM unnest(_eligible) AS cid
    RETURNING id, candidate_profile_id
  ), inserted_matches AS (
    INSERT INTO public.candidate_matches (
      application_id, candidate_profile_id, position_id, organization_id,
      stage, admin_status, client_visibility
    )
    SELECT a.id, a.candidate_profile_id, _position_id, _org,
           'screening'::match_stage, 'pending'::admin_review_status, 'hidden'::client_visibility
    FROM inserted_apps a
    RETURNING id
  )
  SELECT count(*) INTO _changed FROM inserted_matches;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (
    _actor_user_id,
    'bulk.assign_to_position',
    'position',
    _position_id,
    jsonb_build_object(
      'candidate_profile_ids', to_jsonb(_eligible),
      'skipped', _requested - _changed,
      'atomic', true
    )
  );

  RETURN jsonb_build_object('changed', _changed, 'skipped', _requested - _changed);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_assign_candidates(uuid, uuid[], uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_bulk_assign_candidates(uuid, uuid[], uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_bulk_assign_candidates(uuid, uuid[], uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_assign_candidates(uuid, uuid[], uuid) TO service_role;