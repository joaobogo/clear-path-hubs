-- Column-level guard for client updates on candidate_matches.
-- RLS cannot limit WHICH columns change, so enforce it in a trigger.
CREATE OR REPLACE FUNCTION public.guard_candidate_matches_client_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
BEGIN
  -- Service role / internal automation and staff run unrestricted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.staff_roles sr WHERE sr.user_id = auth.uid()
  ) INTO is_staff;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Everyone else (client users) may only touch client-feedback columns.
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

DROP TRIGGER IF EXISTS guard_candidate_matches_client_columns ON public.candidate_matches;
CREATE TRIGGER guard_candidate_matches_client_columns
BEFORE UPDATE ON public.candidate_matches
FOR EACH ROW
EXECUTE FUNCTION public.guard_candidate_matches_client_columns();