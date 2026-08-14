-- 1. Correct swapped role helpers
CREATE OR REPLACE FUNCTION public.is_org_admin(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_user, _org, ARRAY['client_admin']::public.membership_role[])
$$;

CREATE OR REPLACE FUNCTION public.is_org_editor(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_user, _org, ARRAY['client_admin','client_editor']::public.membership_role[])
$$;

-- 2. Allow workspace members to write audit events for their own workspace
DROP POLICY IF EXISTS ae_org_member_insert ON public.audit_events;
CREATE POLICY ae_org_member_insert ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_staff(auth.uid())
    OR (
      organization_id IS NOT NULL
      AND public.is_org_member(auth.uid(), organization_id)
      AND (actor_user_id IS NULL OR actor_user_id = auth.uid())
    )
  );

-- 3. Soft-deleting a task must not be blocked by the SELECT policy hiding deleted rows
DROP POLICY IF EXISTS "org members read tasks" ON public.tasks;
CREATE POLICY "org members read tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR (
      public.is_org_member(auth.uid(), organization_id)
      AND (candidate_match_id IS NULL OR public.is_match_client_visible(auth.uid(), candidate_match_id))
      AND (candidate_profile_id IS NULL OR public.is_candidate_visible_to_org(auth.uid(), organization_id, candidate_profile_id))
    )
  );