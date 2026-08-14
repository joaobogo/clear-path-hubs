-- 1. Workspace admins may manage client-side memberships in their own org.
DROP POLICY IF EXISTS memberships_admin_manage ON public.memberships;
CREATE POLICY memberships_admin_manage
ON public.memberships
FOR UPDATE
TO authenticated
USING (
  public.has_client_permission(auth.uid(), organization_id, 'invite_members'::client_permission)
  AND role = ANY (ARRAY['client_admin'::membership_role, 'client_editor'::membership_role, 'client_viewer'::membership_role])
)
WITH CHECK (
  public.has_client_permission(auth.uid(), organization_id, 'invite_members'::client_permission)
  AND role = ANY (ARRAY['client_admin'::membership_role, 'client_editor'::membership_role, 'client_viewer'::membership_role])
  AND status = ANY (ARRAY['active'::membership_status, 'invited'::membership_status, 'suspended'::membership_status, 'removed'::membership_status])
);

-- 2. Pace (intensity) changes are allowed on a role in any status, for org admins/staff.
CREATE OR REPLACE FUNCTION public.set_position_intensity(
  _org uuid,
  _position uuid,
  _intensity role_intensity
)
RETURNS TABLE (id uuid, title text, status position_status, intensity role_intensity)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_org_admin(auth.uid(), _org) OR public.is_platform_staff(auth.uid())) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.positions p
     SET intensity = _intensity
   WHERE p.id = _position
     AND p.organization_id = _org;

  RETURN QUERY
  SELECT p.id, p.title, p.status, p.intensity
    FROM public.positions p
   WHERE p.id = _position
     AND p.organization_id = _org;
END;
$$;

REVOKE ALL ON FUNCTION public.set_position_intensity(uuid, uuid, role_intensity) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_position_intensity(uuid, uuid, role_intensity) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_position_intensity(uuid, uuid, role_intensity) TO service_role;