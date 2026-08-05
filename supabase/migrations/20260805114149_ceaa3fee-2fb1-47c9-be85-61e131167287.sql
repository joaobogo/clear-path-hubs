-- 1) Assignment table
CREATE TABLE public.candidate_interviewer_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  interviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  interview_id uuid REFERENCES public.interviews(id) ON DELETE SET NULL,
  stage_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_reason text CHECK (ended_reason IN ('feedback_submitted','candidate_declined','revoked'))
);

CREATE UNIQUE INDEX cia_one_active_per_pair
  ON public.candidate_interviewer_assignments (candidate_match_id, interviewer_user_id)
  WHERE ended_at IS NULL;
CREATE INDEX cia_by_interviewer ON public.candidate_interviewer_assignments (interviewer_user_id) WHERE ended_at IS NULL;
CREATE INDEX cia_by_match ON public.candidate_interviewer_assignments (candidate_match_id);

GRANT SELECT, INSERT, UPDATE ON public.candidate_interviewer_assignments TO authenticated;
GRANT ALL ON public.candidate_interviewer_assignments TO service_role;
ALTER TABLE public.candidate_interviewer_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY cia_staff ON public.candidate_interviewer_assignments
  FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE POLICY cia_manager_read ON public.candidate_interviewer_assignments
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.is_org_editor(auth.uid(), organization_id));

CREATE POLICY cia_self_read ON public.candidate_interviewer_assignments
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND interviewer_user_id = auth.uid());

CREATE POLICY cia_manager_insert ON public.candidate_interviewer_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND public.is_org_editor(auth.uid(), organization_id)
    AND granted_by_user_id = auth.uid()
  );

CREATE POLICY cia_manager_update ON public.candidate_interviewer_assignments
  FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.is_org_editor(auth.uid(), organization_id))
  WITH CHECK (public.is_active_user(auth.uid()) AND public.is_org_editor(auth.uid(), organization_id));

-- 2) Assignment check helper
CREATE OR REPLACE FUNCTION public.is_match_assigned_interviewer(_user uuid, _match uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.candidate_interviewer_assignments a
    WHERE a.candidate_match_id = _match
      AND a.interviewer_user_id = _user
      AND a.ended_at IS NULL
  )
$$;
REVOKE ALL ON FUNCTION public.is_match_assigned_interviewer(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_match_assigned_interviewer(uuid, uuid) TO authenticated, service_role;

-- 3) Narrow candidate visibility: managers see the pipeline, interviewers see only assigned candidates
CREATE OR REPLACE FUNCTION public.is_match_client_visible(_user uuid, _match uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.candidate_matches m
    WHERE m.id = _match
      AND m.client_visibility = 'visible'
      AND m.canonical_state = 'published_to_client'
      AND public.has_client_permission(_user, m.organization_id, 'view_candidates')
      AND (
        public.is_org_editor(_user, m.organization_id)
        OR public.is_match_assigned_interviewer(_user, m.id)
      )
  )
$$;

DROP POLICY IF EXISTS cm_client_viewer_read ON public.candidate_matches;
CREATE POLICY cm_client_viewer_read ON public.candidate_matches
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND client_visibility = 'visible'
    AND canonical_state = 'published_to_client'
    AND public.has_client_permission(auth.uid(), organization_id, 'view_candidates')
    AND (
      public.is_org_editor(auth.uid(), organization_id)
      OR public.is_match_assigned_interviewer(auth.uid(), id)
    )
  );

DROP POLICY IF EXISTS files_org_visible_read ON public.files;
CREATE POLICY files_org_visible_read ON public.files
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND candidate_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.candidate_matches m
      WHERE m.candidate_profile_id = files.candidate_profile_id
        AND m.client_visibility = 'visible'
        AND m.canonical_state = 'published_to_client'
        AND m.contact_released_at IS NOT NULL
        AND public.has_client_permission(auth.uid(), m.organization_id, 'view_candidates')
        AND (
          public.is_org_editor(auth.uid(), m.organization_id)
          OR public.is_match_assigned_interviewer(auth.uid(), m.id)
        )
    )
  );

-- 4) Assignments expire on feedback submission
CREATE OR REPLACE FUNCTION public.tg_end_assignment_on_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.submitted_at IS NOT NULL THEN
    UPDATE public.candidate_interviewer_assignments a
       SET ended_at = now(), ended_reason = 'feedback_submitted'
     WHERE a.candidate_match_id = NEW.candidate_match_id
       AND a.interviewer_user_id = NEW.reviewer_user_id
       AND a.ended_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_end_assignment_on_feedback() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_end_assignment_on_feedback_ins ON public.interview_scorecards;
CREATE TRIGGER trg_end_assignment_on_feedback_ins
AFTER INSERT ON public.interview_scorecards
FOR EACH ROW EXECUTE FUNCTION public.tg_end_assignment_on_feedback();

DROP TRIGGER IF EXISTS trg_end_assignment_on_feedback_upd ON public.interview_scorecards;
CREATE TRIGGER trg_end_assignment_on_feedback_upd
AFTER UPDATE OF submitted_at ON public.interview_scorecards
FOR EACH ROW EXECUTE FUNCTION public.tg_end_assignment_on_feedback();

-- 5) Assignments expire when the candidate is declined or archived
CREATE OR REPLACE FUNCTION public.tg_end_assignments_on_decline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.stage IN ('not_moving_forward','archived') AND (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    UPDATE public.candidate_interviewer_assignments a
       SET ended_at = now(), ended_reason = 'candidate_declined'
     WHERE a.candidate_match_id = NEW.id
       AND a.ended_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_end_assignments_on_decline() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_end_assignments_on_decline ON public.candidate_matches;
CREATE TRIGGER trg_end_assignments_on_decline
AFTER UPDATE OF stage ON public.candidate_matches
FOR EACH ROW EXECUTE FUNCTION public.tg_end_assignments_on_decline();