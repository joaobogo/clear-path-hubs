-- A client may move a candidate's stage. Everything else still needs staff.
--
-- Two fixes for the same finding landed independently and contradicted each
-- other on one column:
--
--   20260901221337 / 20260901221455 added
--     guard_candidate_matches_client_columns, a BEFORE UPDATE trigger that
--     raises "This change needs admin review and cannot be made from the client
--     workspace" when a non-staff caller changes any of a list of columns —
--     including `stage`.
--
--   20260901120000 revoked the blanket UPDATE grant on candidate_matches and
--     granted `authenticated` exactly one column: `stage`.
--
-- Both cannot be right. The trigger forbids the one column the grant permits,
-- and that column is the product's core client action: Shortlist, Reopen, Make
-- offer, Mark hired and the kanban all move `stage` from the client workspace.
-- With the trigger as written, every one of those buttons fails for every
-- client. Confirmed as the owner's decision: clients keep stage changes.
--
-- So `stage` is removed from the trigger's forbidden list. The other columns
-- stay exactly as the trigger author wrote them — admin_status,
-- canonical_state, client_visibility, recommendation, eligibility_status, the
-- contact-release pair, the ownership keys and the score-run pointers all still
-- raise for a non-staff caller.
--
-- The two mechanisms then compose rather than fight, and each covers what the
-- other cannot:
--   • the column GRANT stops a client writing any column but `stage` at all,
--     which RLS cannot express (RLS is row-level);
--   • the TRIGGER gives a clear, readable error for the privileged columns
--     instead of a silent no-op, and covers callers reaching the table by a
--     route the grant does not bind.
--
-- Note for whoever reads this next: a stage write that the DATABASE refuses now
-- surfaces. persistStage (src/lib/client/persist-stage.ts) selects the row back
-- after every stage update and raises when nothing came back, so a blocked or
-- filtered write can no longer return ok:true to the client.

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

  -- Client users may move `stage` and nothing else. Every column below still
  -- needs admin review.
  IF NEW.admin_status IS DISTINCT FROM OLD.admin_status
     OR NEW.canonical_state IS DISTINCT FROM OLD.canonical_state
     OR NEW.client_visibility IS DISTINCT FROM OLD.client_visibility
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

REVOKE EXECUTE ON FUNCTION public.guard_candidate_matches_client_columns()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_candidate_matches_client_columns ON public.candidate_matches;
CREATE TRIGGER guard_candidate_matches_client_columns
BEFORE UPDATE ON public.candidate_matches
FOR EACH ROW
EXECUTE FUNCTION public.guard_candidate_matches_client_columns();