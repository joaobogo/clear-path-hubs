ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS backup_owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS owner_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS backup_owner_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS needs_reassignment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reassignment_flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS reassignment_reason text;

CREATE INDEX IF NOT EXISTS positions_needs_reassignment_idx
  ON public.positions (needs_reassignment) WHERE needs_reassignment;
CREATE INDEX IF NOT EXISTS positions_backup_owner_idx
  ON public.positions (backup_owner_user_id);

-- Keep owner_assigned_at in step with owner changes.
CREATE OR REPLACE FUNCTION public.tg_positions_owner_assigned_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.owner_user_id IS NOT NULL AND NEW.owner_assigned_at IS NULL THEN
      NEW.owner_assigned_at := now();
    END IF;
    IF NEW.backup_owner_user_id IS NOT NULL AND NEW.backup_owner_assigned_at IS NULL THEN
      NEW.backup_owner_assigned_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    NEW.owner_assigned_at := CASE WHEN NEW.owner_user_id IS NULL THEN NULL ELSE now() END;
    IF NEW.owner_user_id IS NOT NULL AND NEW.needs_reassignment = OLD.needs_reassignment THEN
      NEW.needs_reassignment := false;
      NEW.reassignment_flagged_at := NULL;
      NEW.reassignment_reason := NULL;
    END IF;
  END IF;

  IF NEW.backup_owner_user_id IS DISTINCT FROM OLD.backup_owner_user_id THEN
    NEW.backup_owner_assigned_at :=
      CASE WHEN NEW.backup_owner_user_id IS NULL THEN NULL ELSE now() END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS positions_owner_assigned_at ON public.positions;
CREATE TRIGGER positions_owner_assigned_at
  BEFORE INSERT OR UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_positions_owner_assigned_at();

-- Flag / unflag open roles owned or backed up by a staff member.
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
  _ids uuid[];
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;

  UPDATE public.positions p
     SET needs_reassignment = true,
         reassignment_flagged_at = now(),
         reassignment_reason = _reason
   WHERE p.status IN ('submitted','under_review','needs_clarification','approved','active','paused')
     AND (p.owner_user_id = _user_id OR p.backup_owner_user_id = _user_id)
     AND p.needs_reassignment = false
  RETURNING p.id INTO _ids;

  SELECT array_agg(id) INTO _ids
    FROM public.positions
   WHERE needs_reassignment
     AND reassignment_reason = _reason
     AND reassignment_flagged_at > now() - interval '5 seconds'
     AND (owner_user_id = _user_id OR backup_owner_user_id = _user_id);

  IF _ids IS NOT NULL THEN
    INSERT INTO public.audit_events (entity_type, entity_id, organization_id, action, after_state)
    SELECT 'position', p.id, p.organization_id, 'position.flagged_for_reassignment',
           jsonb_build_object('reason', _reason, 'inactive_user_id', _user_id)
      FROM public.positions p
     WHERE p.id = ANY(_ids);
    RETURN array_length(_ids, 1);
  END IF;

  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.flag_roles_for_reassignment(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.flag_roles_for_reassignment(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flag_roles_for_reassignment(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.clear_reassignment_flags(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.positions
     SET needs_reassignment = false,
         reassignment_flagged_at = NULL,
         reassignment_reason = NULL
   WHERE needs_reassignment
     AND (owner_user_id = _user_id OR backup_owner_user_id = _user_id);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_reassignment_flags(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_reassignment_flags(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_reassignment_flags(uuid) TO service_role;

-- Membership deactivation
CREATE OR REPLACE FUNCTION public.tg_membership_status_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('suspended','removed') AND OLD.status = 'active' THEN
      PERFORM public.flag_roles_for_reassignment(NEW.user_id, 'membership_' || NEW.status::text);
    ELSIF NEW.status = 'active' AND OLD.status IN ('suspended','removed') THEN
      PERFORM public.clear_reassignment_flags(NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS membership_status_reassignment ON public.memberships;
CREATE TRIGGER membership_status_reassignment
  AFTER UPDATE OF status ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_membership_status_reassignment();

-- Profile deactivation (covers platform staff without a client membership)
CREATE OR REPLACE FUNCTION public.tg_profile_status_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.auth_user_id IS NOT NULL THEN
    IF NEW.status IN ('suspended','deleted') AND OLD.status = 'active' THEN
      PERFORM public.flag_roles_for_reassignment(NEW.auth_user_id, 'profile_' || NEW.status::text);
    ELSIF NEW.status = 'active' AND OLD.status IN ('suspended','deleted') THEN
      PERFORM public.clear_reassignment_flags(NEW.auth_user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_status_reassignment ON public.profiles;
CREATE TRIGGER profile_status_reassignment
  AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profile_status_reassignment();