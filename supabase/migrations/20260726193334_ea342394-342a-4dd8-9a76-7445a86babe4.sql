-- ============================================================
-- 1. CONTACT RELEASE (scoped to candidate + job + client via candidate_matches)
-- ============================================================
ALTER TABLE public.candidate_matches
  ADD COLUMN IF NOT EXISTS contact_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_released_by uuid,
  ADD COLUMN IF NOT EXISTS contact_release_reason text;

CREATE INDEX IF NOT EXISTS idx_candidate_matches_contact_released
  ON public.candidate_matches (organization_id, contact_released_at)
  WHERE contact_released_at IS NOT NULL;

-- ============================================================
-- 2. CLIENT PERMISSION SET
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_permission') THEN
    CREATE TYPE public.client_permission AS ENUM (
      'view_candidates',
      'add_feedback',
      'request_interviews',
      'manage_jobs',
      'invite_members',
      'view_reports'
    );
  END IF;
END $$;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS permissions public.client_permission[] NOT NULL DEFAULT '{}';

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS client_seat_limit integer NOT NULL DEFAULT 3;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_client_seat_limit_range;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_client_seat_limit_range
  CHECK (client_seat_limit BETWEEN 0 AND 3);

-- default permissions per role
CREATE OR REPLACE FUNCTION public.default_permissions_for_role(_role public.membership_role)
RETURNS public.client_permission[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'client_admin' THEN ARRAY['view_candidates','add_feedback','request_interviews','manage_jobs','invite_members','view_reports']::public.client_permission[]
    WHEN 'client_editor' THEN ARRAY['view_candidates','add_feedback','request_interviews','manage_jobs']::public.client_permission[]
    WHEN 'client_viewer' THEN ARRAY['view_candidates','view_reports']::public.client_permission[]
    ELSE '{}'::public.client_permission[]
  END
$$;

-- backfill existing client memberships
UPDATE public.memberships
   SET permissions = public.default_permissions_for_role(role)
 WHERE role IN ('client_admin','client_editor','client_viewer')
   AND permissions = '{}'::public.client_permission[];

CREATE OR REPLACE FUNCTION public.has_client_permission(_user uuid, _org uuid, _perm public.client_permission)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.user_id = _user
      AND m.organization_id = _org
      AND m.status = 'active'
      AND o.archived_at IS NULL
      AND _perm = ANY(m.permissions)
  )
$$;

-- ============================================================
-- 3. MEMBERSHIP GUARD: no self-escalation, staff-only grants, seat cap
-- ============================================================
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
  -- service_role / internal jobs (no auth context) bypass; app paths always have auth.uid()
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 3a. Nobody may modify their own membership row's privileges.
  IF TG_OP <> 'INSERT' AND OLD.user_id = v_actor THEN
    IF TG_OP = 'DELETE'
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.permissions IS DISTINCT FROM OLD.permissions
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.is_master_admin IS DISTINCT FROM OLD.is_master_admin THEN
      RAISE EXCEPTION 'self_privilege_change_forbidden: a member cannot change their own role, permissions or status'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF NOT v_staff THEN
      RAISE EXCEPTION 'membership_delete_requires_platform_staff'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;

  -- 3b. Only platform staff may grant platform roles.
  IF NEW.role IN ('platform_admin','operations') AND NOT v_staff THEN
    RAISE EXCEPTION 'platform_role_grant_requires_platform_staff'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.is_master_admin AND NOT v_staff THEN
    RAISE EXCEPTION 'master_admin_flag_requires_platform_staff'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3c. Non-staff (i.e. a client owner inviting) may only create pending invites
  --     and may never set permissions directly.
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
      -- permissions are always derived, never client-supplied
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

  -- 3d. Seat cap: one owner seat + organizations.client_seat_limit additional seats.
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
      RAISE EXCEPTION 'seat_limit_exceeded: organization allows % additional recruiter seats', COALESCE(v_seat_limit, 3)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS memberships_guard ON public.memberships;
CREATE TRIGGER memberships_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_memberships_guard();

-- Client owners may create pending invites for their own org (guard enforces the rest)
DROP POLICY IF EXISTS memberships_owner_invite ON public.memberships;
CREATE POLICY memberships_owner_invite ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'invited'
    AND role IN ('client_editor','client_viewer')
    AND public.has_client_permission(auth.uid(), organization_id, 'invite_members')
  );

-- Client admins may read their own org's roster (needed for the team screen)
DROP POLICY IF EXISTS memberships_org_roster_read ON public.memberships;
CREATE POLICY memberships_org_roster_read ON public.memberships
  FOR SELECT TO authenticated
  USING (public.has_client_permission(auth.uid(), organization_id, 'invite_members'));

-- ============================================================
-- 4. CANONICAL VISIBILITY PREDICATES
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_match_client_visible(_user uuid, _match uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.candidate_matches m
    WHERE m.id = _match
      AND m.client_visibility = 'visible'
      AND m.canonical_state = 'published_to_client'
      AND public.has_client_permission(_user, m.organization_id, 'view_candidates')
  )
$$;

-- candidate is visible to this org ONLY through a match approved for that org
CREATE OR REPLACE FUNCTION public.is_candidate_visible_to_org(_user uuid, _org uuid, _cp uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.candidate_matches m
    WHERE m.candidate_profile_id = _cp
      AND m.organization_id = _org
      AND m.client_visibility = 'visible'
      AND m.canonical_state = 'published_to_client'
      AND public.has_client_permission(_user, _org, 'view_candidates')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_match_contact_released(_user uuid, _match uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.candidate_matches m
    WHERE m.id = _match
      AND m.client_visibility = 'visible'
      AND m.canonical_state = 'published_to_client'
      AND m.contact_released_at IS NOT NULL
      AND public.has_client_permission(_user, m.organization_id, 'view_candidates')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_candidate_contact_released_to_org(_user uuid, _org uuid, _cp uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.candidate_matches m
    WHERE m.candidate_profile_id = _cp
      AND m.organization_id = _org
      AND m.client_visibility = 'visible'
      AND m.canonical_state = 'published_to_client'
      AND m.contact_released_at IS NOT NULL
      AND public.has_client_permission(_user, _org, 'view_candidates')
  )
$$;

REVOKE ALL ON FUNCTION public.default_permissions_for_role(public.membership_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.default_permissions_for_role(public.membership_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_client_permission(uuid, uuid, public.client_permission) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_client_permission(uuid, uuid, public.client_permission) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_match_client_visible(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_match_client_visible(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_candidate_visible_to_org(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_candidate_visible_to_org(uuid, uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_match_contact_released(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_match_contact_released(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_candidate_contact_released_to_org(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_candidate_contact_released_to_org(uuid, uuid, uuid) TO authenticated, service_role;

-- ============================================================
-- 5. TIGHTEN CANDIDATE-LINKED RLS TO PER-MATCH APPROVAL
-- ============================================================

-- candidate_matches: require view_candidates permission + published state
DROP POLICY IF EXISTS cm_client_viewer_read ON public.candidate_matches;
CREATE POLICY cm_client_viewer_read ON public.candidate_matches
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND client_visibility = 'visible'
    AND canonical_state = 'published_to_client'
    AND public.has_client_permission(auth.uid(), organization_id, 'view_candidates')
  );

DROP POLICY IF EXISTS cm_client_editor_update ON public.candidate_matches;
CREATE POLICY cm_client_editor_update ON public.candidate_matches
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND client_visibility = 'visible'
    AND canonical_state = 'published_to_client'
    AND public.has_client_permission(auth.uid(), organization_id, 'add_feedback')
  )
  WITH CHECK (
    client_visibility = 'visible'
    AND public.has_client_permission(auth.uid(), organization_id, 'add_feedback')
  );

-- candidate_evidence_items
DROP POLICY IF EXISTS "org viewers read evidence items" ON public.candidate_evidence_items;
CREATE POLICY "org viewers read evidence items" ON public.candidate_evidence_items
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()) OR public.is_match_client_visible(auth.uid(), candidate_match_id));

DROP POLICY IF EXISTS "org editors review evidence items" ON public.candidate_evidence_items;
CREATE POLICY "org editors review evidence items" ON public.candidate_evidence_items
  FOR UPDATE TO authenticated
  USING (public.is_platform_staff(auth.uid())
         OR (public.is_match_client_visible(auth.uid(), candidate_match_id)
             AND public.has_client_permission(auth.uid(), organization_id, 'add_feedback')))
  WITH CHECK (public.is_platform_staff(auth.uid())
         OR (public.is_match_client_visible(auth.uid(), candidate_match_id)
             AND public.has_client_permission(auth.uid(), organization_id, 'add_feedback')));

-- candidate_stage_history
DROP POLICY IF EXISTS "org members read stage history" ON public.candidate_stage_history;
CREATE POLICY "org members read stage history" ON public.candidate_stage_history
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()) OR public.is_match_client_visible(auth.uid(), candidate_match_id));

-- client_decisions
DROP POLICY IF EXISTS cd_editor_read ON public.client_decisions;
CREATE POLICY cd_editor_read ON public.client_decisions
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid())
         AND (public.is_platform_staff(auth.uid()) OR public.is_match_client_visible(auth.uid(), candidate_match_id)));

DROP POLICY IF EXISTS cd_editor_update ON public.client_decisions;
CREATE POLICY cd_editor_update ON public.client_decisions
  FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid())
         AND (public.is_platform_staff(auth.uid())
              OR (public.is_match_client_visible(auth.uid(), candidate_match_id)
                  AND public.has_client_permission(auth.uid(), organization_id, 'add_feedback'))))
  WITH CHECK (public.is_platform_staff(auth.uid())
              OR (public.is_match_client_visible(auth.uid(), candidate_match_id)
                  AND public.has_client_permission(auth.uid(), organization_id, 'add_feedback')));

-- eligibility_checks
DROP POLICY IF EXISTS "org members read eligibility checks" ON public.eligibility_checks;
CREATE POLICY "org members read eligibility checks" ON public.eligibility_checks
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()) OR public.is_match_client_visible(auth.uid(), candidate_match_id));

DROP POLICY IF EXISTS "editors manage eligibility checks" ON public.eligibility_checks;
CREATE POLICY "editors manage eligibility checks" ON public.eligibility_checks
  FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())
         OR (public.is_match_client_visible(auth.uid(), candidate_match_id)
             AND public.has_client_permission(auth.uid(), organization_id, 'add_feedback')))
  WITH CHECK (public.is_platform_staff(auth.uid())
         OR (public.is_match_client_visible(auth.uid(), candidate_match_id)
             AND public.has_client_permission(auth.uid(), organization_id, 'add_feedback')));

-- eligibility_exceptions
DROP POLICY IF EXISTS "org members read exceptions" ON public.eligibility_exceptions;
CREATE POLICY "org members read exceptions" ON public.eligibility_exceptions
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()) OR public.is_match_client_visible(auth.uid(), candidate_match_id));

-- evidence_overrides
DROP POLICY IF EXISTS "org staff read evidence overrides" ON public.evidence_overrides;
CREATE POLICY "org staff read evidence overrides" ON public.evidence_overrides
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()) OR public.is_match_client_visible(auth.uid(), candidate_match_id));

-- interviews (match-scoped)
DROP POLICY IF EXISTS iv_read ON public.interviews;
CREATE POLICY iv_read ON public.interviews
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid())
         AND (public.is_platform_staff(auth.uid()) OR public.is_match_client_visible(auth.uid(), candidate_match_id)));

DROP POLICY IF EXISTS iv_write ON public.interviews;
CREATE POLICY iv_write ON public.interviews
  FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())
         AND (public.is_platform_staff(auth.uid())
              OR (public.is_match_client_visible(auth.uid(), candidate_match_id)
                  AND public.has_client_permission(auth.uid(), organization_id, 'request_interviews'))))
  WITH CHECK (public.is_platform_staff(auth.uid())
              OR (public.is_match_client_visible(auth.uid(), candidate_match_id)
                  AND public.has_client_permission(auth.uid(), organization_id, 'request_interviews')));

-- hire_records
DROP POLICY IF EXISTS hr_read ON public.hire_records;
CREATE POLICY hr_read ON public.hire_records
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid())
         AND (public.is_platform_staff(auth.uid()) OR public.is_match_client_visible(auth.uid(), candidate_match_id)));

DROP POLICY IF EXISTS hr_update ON public.hire_records;
CREATE POLICY hr_update ON public.hire_records
  FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid())
         AND (public.is_platform_staff(auth.uid())
              OR (public.is_match_client_visible(auth.uid(), candidate_match_id)
                  AND public.has_client_permission(auth.uid(), organization_id, 'add_feedback'))))
  WITH CHECK (public.is_platform_staff(auth.uid())
              OR (public.is_match_client_visible(auth.uid(), candidate_match_id)
                  AND public.has_client_permission(auth.uid(), organization_id, 'add_feedback')));

-- tasks: candidate-linked tasks require approval; org-level tasks stay org-scoped
DROP POLICY IF EXISTS "org members read tasks" ON public.tasks;
CREATE POLICY "org members read tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.is_platform_staff(auth.uid())
      OR (
        public.is_org_member(auth.uid(), organization_id)
        AND (candidate_match_id IS NULL OR public.is_match_client_visible(auth.uid(), candidate_match_id))
        AND (candidate_profile_id IS NULL OR public.is_candidate_visible_to_org(auth.uid(), organization_id, candidate_profile_id))
      )
    )
  );

DROP POLICY IF EXISTS "org editors update tasks" ON public.tasks;
CREATE POLICY "org editors update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR (
      public.is_org_editor(auth.uid(), organization_id)
      AND (candidate_match_id IS NULL OR public.is_match_client_visible(auth.uid(), candidate_match_id))
      AND (candidate_profile_id IS NULL OR public.is_candidate_visible_to_org(auth.uid(), organization_id, candidate_profile_id))
    )
  )
  WITH CHECK (
    public.is_platform_staff(auth.uid())
    OR (
      public.is_org_editor(auth.uid(), organization_id)
      AND (candidate_match_id IS NULL OR public.is_match_client_visible(auth.uid(), candidate_match_id))
      AND (candidate_profile_id IS NULL OR public.is_candidate_visible_to_org(auth.uid(), organization_id, candidate_profile_id))
    )
  );

-- notification_events: never surface an unapproved candidate through notifications
DROP POLICY IF EXISTS events_org_read ON public.notification_events;
CREATE POLICY events_org_read ON public.notification_events
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.is_org_viewer(auth.uid(), organization_id)
    AND (candidate_match_id IS NULL OR public.is_match_client_visible(auth.uid(), candidate_match_id))
    AND (candidate_profile_id IS NULL OR public.is_candidate_visible_to_org(auth.uid(), organization_id, candidate_profile_id))
  );

-- outreach_touches
DROP POLICY IF EXISTS outreach_touches_org_read ON public.outreach_touches;
CREATE POLICY outreach_touches_org_read ON public.outreach_touches
  FOR SELECT TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR (
      public.is_org_member(auth.uid(), organization_id)
      AND (candidate_profile_id IS NULL OR public.is_candidate_visible_to_org(auth.uid(), organization_id, candidate_profile_id))
    )
  );

-- role_memory
DROP POLICY IF EXISTS "org members read role memory" ON public.role_memory;
CREATE POLICY "org members read role memory" ON public.role_memory
  FOR SELECT TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR (
      public.is_org_member(auth.uid(), organization_id)
      AND (candidate_profile_id IS NULL OR public.is_candidate_visible_to_org(auth.uid(), organization_id, candidate_profile_id))
    )
  );

-- talent_memory
DROP POLICY IF EXISTS "talent_memory org read" ON public.talent_memory;
CREATE POLICY "talent_memory org read" ON public.talent_memory
  FOR SELECT TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR (
      public.is_org_member(auth.uid(), organization_id)
      AND public.is_candidate_visible_to_org(auth.uid(), organization_id, candidate_profile_id)
    )
  );

-- talent_pool_members
DROP POLICY IF EXISTS pool_members_read_by_org_member ON public.talent_pool_members;
CREATE POLICY pool_members_read_by_org_member ON public.talent_pool_members
  FOR SELECT TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR (
      public.is_org_member(auth.uid(), organization_id)
      AND public.is_candidate_visible_to_org(auth.uid(), organization_id, candidate_profile_id)
    )
  );

-- ============================================================
-- 6. CONTACT-DETAIL SURFACES REQUIRE AN EXPLICIT RELEASE
-- ============================================================
DROP POLICY IF EXISTS files_org_visible_read ON public.files;
CREATE POLICY files_org_visible_read ON public.files
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND candidate_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.candidate_matches m
      WHERE m.candidate_profile_id = files.candidate_profile_id
        AND m.client_visibility = 'visible'
        AND m.canonical_state = 'published_to_client'
        AND m.contact_released_at IS NOT NULL
        AND public.has_client_permission(auth.uid(), m.organization_id, 'view_candidates')
    )
  );

DROP POLICY IF EXISTS cvs_org_visible_read ON storage.objects;
CREATE POLICY cvs_org_visible_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cvs'
    AND public.is_active_user(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.candidate_matches m
      JOIN public.candidate_profiles cp ON cp.id = m.candidate_profile_id
      WHERE cp.user_id::text = (storage.foldername(objects.name))[1]
        AND m.client_visibility = 'visible'
        AND m.canonical_state = 'published_to_client'
        AND m.contact_released_at IS NOT NULL
        AND public.has_client_permission(auth.uid(), m.organization_id, 'view_candidates')
    )
  );
