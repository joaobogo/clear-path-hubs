GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams_action_links TO authenticated;
GRANT ALL ON public.teams_action_links TO service_role;

DROP POLICY IF EXISTS "tal_staff" ON public.teams_action_links;
CREATE POLICY "tal_staff" ON public.teams_action_links
  FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

REVOKE ALL ON FUNCTION public.tg_membership_status_reassignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_profile_status_reassignment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_membership_status_reassignment() TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_profile_status_reassignment() TO service_role;