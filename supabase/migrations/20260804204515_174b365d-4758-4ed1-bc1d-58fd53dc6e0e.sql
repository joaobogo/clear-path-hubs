-- 1. Revoke anon (and public) EXECUTE on SECURITY DEFINER functions that are
-- only ever called from authenticated server paths or by triggers.
REVOKE ALL ON FUNCTION public.person_for_candidate_profile(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.outreach_contact_allowed(uuid, uuid, public.outreach_channel) FROM anon, public;

REVOKE ALL ON FUNCTION public.enforce_position_payment_gate() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.ensure_position_commitment() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.tg_conversation_touch_last_message() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.tg_graph_candidate_profile() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.tg_graph_edge_generic() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.tg_outreach_touch_guard() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.tg_positions_intensity_audit() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.tg_writeback_on_close() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.person_for_candidate_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.outreach_contact_allowed(uuid, uuid, public.outreach_channel) TO authenticated, service_role;

-- public_position_closure / public_position_employer stay anon-executable on
-- purpose: they back public job pages and return only published, non-sensitive
-- employer display data for public positions.

-- 2. Correct reversed helper arguments in membership policies.
DROP POLICY IF EXISTS "teams_links_member_read" ON public.teams_channel_links;
CREATE POLICY "teams_links_member_read"
  ON public.teams_channel_links FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS "teams_links_admin_write" ON public.teams_channel_links;
CREATE POLICY "teams_links_admin_write"
  ON public.teams_channel_links FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS "Org members read role commitments" ON public.position_commitments;
CREATE POLICY "Org members read role commitments"
  ON public.position_commitments FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));