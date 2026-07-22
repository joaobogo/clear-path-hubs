
-- 1. Revoke PUBLIC execute on all helpers
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_platform_staff(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid,uuid,public.membership_role[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_editor(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_viewer(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_owning_candidate(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_write_audit_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_score_runs_immutable() FROM PUBLIC;

-- Grant only where needed
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid,uuid,public.membership_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_editor(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_viewer(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_owning_candidate(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. Add candidate-scoped SELECT policy on positions
CREATE POLICY positions_candidate_applied_read ON public.positions FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.candidate_profiles cp ON cp.id = a.candidate_profile_id
      WHERE a.position_id = positions.id AND cp.user_id = auth.uid()
    )
  );

-- 3. Rebuild candidate_my_applications as security_invoker
DROP VIEW IF EXISTS public.candidate_my_applications;
CREATE VIEW public.candidate_my_applications
WITH (security_invoker = true) AS
SELECT
  a.id AS application_id,
  a.status,
  a.applied_at,
  a.withdrawn_at,
  p.id AS position_id,
  p.title,
  p.location,
  p.work_model,
  p.employment_type,
  o.name AS organization_name,
  CASE m.stage
    WHEN 'new' THEN 'submitted'
    WHEN 'reviewing' THEN 'in_review'
    WHEN 'delivered' THEN 'in_review'
    WHEN 'shortlisted' THEN 'in_review'
    WHEN 'interview_process' THEN 'interviewing'
    WHEN 'offer' THEN 'offer'
    WHEN 'hired' THEN 'hired'
    WHEN 'not_moving_forward' THEN 'closed'
    WHEN 'archived' THEN 'closed'
    ELSE 'submitted'
  END AS candidate_status
FROM public.applications a
JOIN public.candidate_profiles cp ON cp.id = a.candidate_profile_id
JOIN public.positions p ON p.id = a.position_id
JOIN public.organizations o ON o.id = p.organization_id
LEFT JOIN public.candidate_matches m ON m.application_id = a.id
WHERE cp.user_id = auth.uid();
GRANT SELECT ON public.candidate_my_applications TO authenticated;

-- Also allow candidate read on their own candidate_matches for the view join (safe columns only via view)
-- Candidates need to read their own match row for candidate_status.
CREATE POLICY cm_candidate_own_read ON public.candidate_matches FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND public.is_owning_candidate(auth.uid(), candidate_profile_id)
  );

-- Also allow candidate read on their own organization (needed for view join)
CREATE POLICY organizations_candidate_applied_read ON public.organizations FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.positions p
      JOIN public.applications a ON a.position_id = p.id
      JOIN public.candidate_profiles cp ON cp.id = a.candidate_profile_id
      WHERE p.organization_id = organizations.id AND cp.user_id = auth.uid()
    )
  );
