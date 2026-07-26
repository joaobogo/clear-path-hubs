CREATE OR REPLACE FUNCTION public.tg_memberships_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_staff boolean := public.is_platform_staff(auth.uid());
  v_seat_limit integer;
  v_active_client_seats integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF v_actor IS NOT NULL THEN
      IF OLD.user_id = v_actor THEN
        RAISE EXCEPTION 'self_privilege_change_forbidden: a member cannot remove their own membership'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      IF NOT v_staff THEN
        RAISE EXCEPTION 'membership_delete_requires_platform_staff'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF v_actor IS NOT NULL THEN
    -- Nobody may modify their own membership row's privileges.
    IF TG_OP = 'UPDATE' AND OLD.user_id = v_actor THEN
      IF NEW.role IS DISTINCT FROM OLD.role
         OR NEW.status IS DISTINCT FROM OLD.status
         OR NEW.permissions IS DISTINCT FROM OLD.permissions
         OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
         OR NEW.is_master_admin IS DISTINCT FROM OLD.is_master_admin THEN
        RAISE EXCEPTION 'self_privilege_change_forbidden: a member cannot change their own role, permissions or status'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;

    IF NEW.role IN ('platform_admin','operations') AND NOT v_staff THEN
      RAISE EXCEPTION 'platform_role_grant_requires_platform_staff'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.is_master_admin AND NOT v_staff THEN
      RAISE EXCEPTION 'master_admin_flag_requires_platform_staff'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NOT v_staff THEN
      IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'invited' THEN
          RAISE EXCEPTION 'seat_activation_requires_platform_staff: invites start as pending'
            USING ERRCODE = 'insufficient_privilege';
        END IF;
        IF NOT public.has_client_permission(v_actor, NEW.organization_id, 'invite_members') THEN
          RAISE EXCEPTION 'invite_members_permission_required'
            USING ERRCODE = 'insufficient_privilege';
        END IF;
        IF NEW.role NOT IN ('client_editor','client_viewer') THEN
          RAISE EXCEPTION 'client_owner_may_only_invite_recruiter_seats'
            USING ERRCODE = 'insufficient_privilege';
        END IF;
        NEW.permissions := public.default_permissions_for_role(NEW.role);
      ELSE
        IF NEW.permissions IS DISTINCT FROM OLD.permissions
           OR NEW.role IS DISTINCT FROM OLD.role
           OR NEW.status IS DISTINCT FROM OLD.status THEN
          RAISE EXCEPTION 'permission_change_requires_platform_staff'
            USING ERRCODE = 'insufficient_privilege';
        END IF;
      END IF;
    END IF;
  END IF;

  -- Derive permissions whenever a role is set/changed and none were supplied explicitly.
  IF TG_OP = 'INSERT' AND NEW.permissions = '{}'::public.client_permission[] THEN
    NEW.permissions := public.default_permissions_for_role(NEW.role);
  ELSIF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role
        AND NEW.permissions IS NOT DISTINCT FROM OLD.permissions THEN
    NEW.permissions := public.default_permissions_for_role(NEW.role);
  END IF;

  -- Seat cap: enforced on every write path, including service_role.
  IF NEW.role IN ('client_admin','client_editor','client_viewer')
     AND NEW.status IN ('active','invited') THEN
    SELECT o.client_seat_limit INTO v_seat_limit
      FROM public.organizations o WHERE o.id = NEW.organization_id;

    SELECT count(*) INTO v_active_client_seats
      FROM public.memberships m
     WHERE m.organization_id = NEW.organization_id
       AND m.role IN ('client_admin','client_editor','client_viewer')
       AND m.status IN ('active','invited')
       AND m.id <> NEW.id;

    IF v_active_client_seats + 1 > COALESCE(v_seat_limit, 3) + 1 THEN
      RAISE EXCEPTION 'seat_limit_exceeded: organization allows 1 owner seat plus % recruiter seats', COALESCE(v_seat_limit, 3)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END $$;
