
-- =========================================================================
-- Phase 3 — Authorization & security hardening
-- =========================================================================

-- ---- 1. Fix EXECUTE grants (Phase 2 bug: policies could not call helpers)
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_staff(uuid) TO authenticated;

-- ---- 2. New helpers (SECURITY DEFINER, fixed search_path)

CREATE OR REPLACE FUNCTION public.is_active_user(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE auth_user_id = _user AND status = 'active'
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_org_role(_user uuid, _org uuid, _roles public.membership_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user
      AND organization_id = _org
      AND status = 'active'
      AND role = ANY(_roles)
  )
$$;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid,uuid,public.membership_role[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_user, _org, ARRAY['client_admin']::public.membership_role[])
$$;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_org_editor(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_user, _org, ARRAY['client_admin','client_editor']::public.membership_role[])
$$;
GRANT EXECUTE ON FUNCTION public.is_org_editor(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_org_viewer(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_user, _org,
    ARRAY['client_admin','client_editor','client_viewer']::public.membership_role[])
$$;
GRANT EXECUTE ON FUNCTION public.is_org_viewer(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_owning_candidate(_user uuid, _cp uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidate_profiles
    WHERE id = _cp AND user_id = _user
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_owning_candidate(uuid,uuid) TO authenticated;

-- ---- 3. Drop Phase 2 policies we are replacing
DROP POLICY IF EXISTS organizations_member_read ON public.organizations;
DROP POLICY IF EXISTS organizations_staff_write ON public.organizations;
DROP POLICY IF EXISTS positions_authenticated_read ON public.positions;
DROP POLICY IF EXISTS positions_staff_write ON public.positions;
DROP POLICY IF EXISTS cm_client_read ON public.candidate_matches;
DROP POLICY IF EXISTS cm_candidate_read ON public.candidate_matches;
DROP POLICY IF EXISTS cd_org ON public.client_decisions;
DROP POLICY IF EXISTS iv_org ON public.interviews;
DROP POLICY IF EXISTS files_self ON public.files;
DROP POLICY IF EXISTS files_staff_read ON public.files;
DROP POLICY IF EXISTS sr_client_read ON public.score_runs;

-- ---- 4. Refined policies

-- Organizations: viewer+ can read own; only staff can mutate
CREATE POLICY organizations_read ON public.organizations FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid()) AND (
      public.is_platform_staff(auth.uid())
      OR public.is_org_viewer(auth.uid(), id)
    )
  );
CREATE POLICY organizations_admin_update ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.is_org_admin(auth.uid(), id))
  WITH CHECK (public.is_org_admin(auth.uid(), id));
CREATE POLICY organizations_staff_all ON public.organizations FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

-- Positions: read (public/viewer/staff), create/update (editor/staff), delete (staff only)
CREATE POLICY positions_read ON public.positions FOR SELECT TO authenticated
  USING (
    (visibility = 'public' AND status = 'active')
    OR (public.is_active_user(auth.uid()) AND (
         public.is_platform_staff(auth.uid())
         OR public.is_org_viewer(auth.uid(), organization_id)
       ))
  );
CREATE POLICY positions_editor_insert ON public.positions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user(auth.uid()) AND (
      public.is_platform_staff(auth.uid())
      OR public.is_org_editor(auth.uid(), organization_id)
    )
  );
CREATE POLICY positions_editor_update ON public.positions FOR UPDATE TO authenticated
  USING (
    public.is_active_user(auth.uid()) AND (
      public.is_platform_staff(auth.uid())
      OR (public.is_org_editor(auth.uid(), organization_id)
          AND status IN ('draft','submitted','needs_clarification'))
    )
  )
  WITH CHECK (
    public.is_platform_staff(auth.uid())
    OR (public.is_org_editor(auth.uid(), organization_id)
        AND status IN ('draft','submitted','needs_clarification'))
  );
CREATE POLICY positions_staff_delete ON public.positions FOR DELETE TO authenticated
  USING (public.is_platform_staff(auth.uid()));

-- Candidate_matches
CREATE POLICY cm_client_viewer_read ON public.candidate_matches FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND client_visibility = 'visible'
    AND public.is_org_viewer(auth.uid(), organization_id)
  );
CREATE POLICY cm_client_editor_update ON public.candidate_matches FOR UPDATE TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND client_visibility = 'visible'
    AND public.is_org_editor(auth.uid(), organization_id)
  )
  WITH CHECK (
    public.is_org_editor(auth.uid(), organization_id)
    AND client_visibility = 'visible'
  );
-- Candidates never read this table directly; use security-definer view instead.

-- Client_decisions: editor+ writes for own org
CREATE POLICY cd_editor_read ON public.client_decisions FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid()) AND (
      public.is_platform_staff(auth.uid())
      OR public.is_org_viewer(auth.uid(), organization_id)
    )
  );
CREATE POLICY cd_editor_write ON public.client_decisions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user(auth.uid()) AND (
      public.is_platform_staff(auth.uid())
      OR public.is_org_editor(auth.uid(), organization_id)
    )
  );
CREATE POLICY cd_editor_update ON public.client_decisions FOR UPDATE TO authenticated
  USING (
    public.is_active_user(auth.uid()) AND (
      public.is_platform_staff(auth.uid())
      OR public.is_org_editor(auth.uid(), organization_id)
    )
  )
  WITH CHECK (
    public.is_platform_staff(auth.uid())
    OR public.is_org_editor(auth.uid(), organization_id)
  );

-- Interviews: editor+ manage; viewer read
CREATE POLICY iv_read ON public.interviews FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid()) AND (
      public.is_platform_staff(auth.uid())
      OR public.is_org_viewer(auth.uid(), organization_id)
    )
  );
CREATE POLICY iv_write ON public.interviews FOR ALL TO authenticated
  USING (
    public.is_active_user(auth.uid()) AND (
      public.is_platform_staff(auth.uid())
      OR public.is_org_editor(auth.uid(), organization_id)
    )
  )
  WITH CHECK (
    public.is_platform_staff(auth.uid())
    OR public.is_org_editor(auth.uid(), organization_id)
  );

-- Files: owner + staff; org members read files bound to visible matches in their org
CREATE POLICY files_owner ON public.files FOR ALL TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND owner_user_id = auth.uid()
  )
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND owner_user_id = auth.uid()
  );
CREATE POLICY files_staff_read ON public.files FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));
CREATE POLICY files_org_visible_read ON public.files FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND candidate_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.candidate_matches m
      WHERE m.candidate_profile_id = files.candidate_profile_id
        AND m.client_visibility = 'visible'
        AND public.is_org_viewer(auth.uid(), m.organization_id)
    )
  );

-- Score_runs: staff only; no client, no candidate reads
-- (existing sr_staff policy remains; explicitly no client_read)

-- ---- 5. Deactivated-user gate: fold into applications policies (already OK via candidate_profile join)
-- but ensure profiles.status='active' is enforced on applications insert
DROP POLICY IF EXISTS applications_candidate_insert ON public.applications;
CREATE POLICY applications_candidate_insert ON public.applications FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND public.is_owning_candidate(auth.uid(), candidate_profile_id)
  );

-- ---- 6. Audit event trigger

CREATE OR REPLACE FUNCTION public.tg_write_audit_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid;
  v_trace text := current_setting('app.trace_id', true);
  v_before jsonb;
  v_after jsonb;
  v_entity uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_entity := OLD.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_entity := NEW.id;
  ELSE
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_entity := NEW.id;
  END IF;

  -- Best-effort organization_id lookup
  BEGIN
    v_org := (COALESCE(v_after, v_before) ->> 'organization_id')::uuid;
  EXCEPTION WHEN others THEN
    v_org := NULL;
  END;

  INSERT INTO public.audit_events(
    actor_user_id, organization_id, entity_type, entity_id,
    action, before_state, after_state, trace_id
  ) VALUES (
    v_actor, v_org, TG_TABLE_NAME, v_entity,
    TG_OP, v_before, v_after, NULLIF(v_trace, '')
  );

  RETURN COALESCE(NEW, OLD);
END $$;

-- Attach audit trigger to sensitive tables
DROP TRIGGER IF EXISTS audit_positions ON public.positions;
CREATE TRIGGER audit_positions
  AFTER INSERT OR UPDATE OR DELETE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_audit_event();

DROP TRIGGER IF EXISTS audit_candidate_matches ON public.candidate_matches;
CREATE TRIGGER audit_candidate_matches
  AFTER INSERT OR UPDATE OR DELETE ON public.candidate_matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_audit_event();

DROP TRIGGER IF EXISTS audit_client_decisions ON public.client_decisions;
CREATE TRIGGER audit_client_decisions
  AFTER INSERT OR UPDATE OR DELETE ON public.client_decisions
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_audit_event();

DROP TRIGGER IF EXISTS audit_score_decisions ON public.score_decisions;
CREATE TRIGGER audit_score_decisions
  AFTER INSERT OR UPDATE OR DELETE ON public.score_decisions
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_audit_event();

DROP TRIGGER IF EXISTS audit_memberships ON public.memberships;
CREATE TRIGGER audit_memberships
  AFTER INSERT OR UPDATE OR DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_audit_event();

-- ---- 7. Candidate-facing view hardening
-- Recreate as SECURITY DEFINER (bypass RLS) with strict WHERE + safe column projection.

DROP VIEW IF EXISTS public.candidate_my_applications;
CREATE VIEW public.candidate_my_applications
WITH (security_invoker = false) AS
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
  -- Only expose CANDIDATE-SAFE stage bucket
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

-- Restrict client_candidate_matches_view to safe columns (no admin_status, no evidence)
DROP VIEW IF EXISTS public.client_candidate_matches_view;
CREATE VIEW public.client_candidate_matches_view
WITH (security_invoker = true) AS
SELECT
  m.id, m.position_id, m.organization_id, m.stage, m.delivered_at,
  p.title AS position_title,
  cp.full_name, cp.headline, cp.location,
  (SELECT sr.score FROM public.score_runs sr
     WHERE sr.candidate_match_id = m.id AND sr.status='completed'
     ORDER BY sr.completed_at DESC LIMIT 1) AS latest_score
FROM public.candidate_matches m
JOIN public.candidate_profiles cp ON cp.id = m.candidate_profile_id
JOIN public.positions p ON p.id = m.position_id
WHERE m.client_visibility = 'visible';
GRANT SELECT ON public.client_candidate_matches_view TO authenticated;

-- Allow authenticated to invoke has_role too (needed for RLS on user_roles-based checks)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
