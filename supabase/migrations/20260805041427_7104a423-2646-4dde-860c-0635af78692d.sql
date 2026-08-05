CREATE OR REPLACE FUNCTION public.flag_roles_for_reassignment(
  _user_id uuid,
  _reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _n integer := 0;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;

  WITH flagged AS (
    UPDATE public.positions p
       SET needs_reassignment = true,
           reassignment_flagged_at = now(),
           reassignment_reason = _reason
     WHERE p.status IN ('submitted','under_review','needs_clarification','approved','active','paused')
       AND (p.owner_user_id = _user_id OR p.backup_owner_user_id = _user_id)
       AND p.needs_reassignment = false
    RETURNING p.id, p.organization_id
  ), logged AS (
    INSERT INTO public.audit_events (entity_type, entity_id, organization_id, action, after_state)
    SELECT 'position', f.id, f.organization_id, 'position.flagged_for_reassignment',
           jsonb_build_object('reason', _reason, 'inactive_user_id', _user_id)
      FROM flagged f
    RETURNING 1
  )
  SELECT count(*)::int INTO _n FROM logged;

  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.flag_roles_for_reassignment(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.flag_roles_for_reassignment(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flag_roles_for_reassignment(uuid, text) TO service_role;