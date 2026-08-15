CREATE POLICY "candidate_profiles_client_org_read"
ON public.candidate_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.candidate_matches cm
    JOIN public.memberships me ON me.organization_id = cm.organization_id
    WHERE cm.candidate_profile_id = candidate_profiles.id
      AND cm.client_visibility = 'visible'
      AND me.user_id = auth.uid()
      AND me.status = 'active'
  )
);

CREATE POLICY "profiles_client_org_read"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = profiles.auth_user_id
      AND m.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM public.memberships me
        WHERE me.organization_id = m.organization_id
          AND me.user_id = auth.uid()
          AND me.status = 'active'
      )
  )
);