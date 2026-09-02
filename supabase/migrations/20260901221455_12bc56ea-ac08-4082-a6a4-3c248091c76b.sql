CREATE OR REPLACE FUNCTION public.guard_candidate_matches_client_columns()
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

  -- Client users may only touch client-feedback columns.
  IF NEW.admin_status IS DISTINCT FROM OLD.admin_status
     OR NEW.canonical_state IS DISTINCT FROM OLD.canonical_state
     OR NEW.client_visibility IS DISTINCT FROM OLD.client_visibility
     OR NEW.stage IS DISTINCT FROM OLD.stage
     OR NEW.recommendation IS DISTINCT FROM OLD.recommendation
     OR NEW.eligibility_status IS DISTINCT FROM OLD.eligibility_status
     OR NEW.contact_released_at IS DISTINCT FROM OLD.contact_released_at
     OR NEW.contact_release_reason IS DISTINCT FROM OLD.contact_release_reason
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.position_id IS DISTINCT FROM OLD.position_id
     OR NEW.candidate_profile_id IS DISTINCT FROM OLD.candidate_profile_id
     OR NEW.approved_score_run_id IS DISTINCT FROM OLD.approved_score_run_id
     OR NEW.current_score_run_id IS DISTINCT FROM OLD.current_score_run_id
  THEN
    RAISE EXCEPTION 'This change needs admin review and cannot be made from the client workspace';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_candidate_matches_client_columns() FROM PUBLIC, anon, authenticated;