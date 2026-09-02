CREATE OR REPLACE FUNCTION public.guard_client_decisions_client_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
BEGIN
  -- Service role / internal automation runs unrestricted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('platform_admin', 'operations')
  ) INTO is_staff;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- A client user may only amend a decision they recorded themselves.
  IF COALESCE(OLD.recorded_by_staff, false)
     OR OLD.actor_user_id IS DISTINCT FROM auth.uid()
  THEN
    RAISE EXCEPTION 'Only the person who recorded this decision can change it';
  END IF;

  -- ...and only the decision, its reason and the written feedback.
  IF NEW.candidate_match_id IS DISTINCT FROM OLD.candidate_match_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id
     OR NEW.recorded_by_staff IS DISTINCT FROM OLD.recorded_by_staff
     OR NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id
     OR NEW.from_stage IS DISTINCT FROM OLD.from_stage
     OR NEW.reversed_at IS DISTINCT FROM OLD.reversed_at
     OR NEW.reversed_by IS DISTINCT FROM OLD.reversed_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'This change needs admin review and cannot be made from the client workspace';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_client_decisions_client_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_client_decisions_client_columns ON public.client_decisions;
CREATE TRIGGER guard_client_decisions_client_columns
BEFORE UPDATE ON public.client_decisions
FOR EACH ROW EXECUTE FUNCTION public.guard_client_decisions_client_columns();