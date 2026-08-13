-- 1) Remove public/anon EXECUTE on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.assign_position_reference_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evidence_item_in_match(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_in_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.position_in_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.public_position_closure(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.public_position_employer(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.evidence_item_in_match(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_in_org(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.position_in_org(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_position_closure(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_position_employer(uuid) TO authenticated, service_role;

-- 2) Restrict billing rows to workspace admins (and platform staff via existing policy)
DROP POLICY IF EXISTS "Org members read own payments" ON public.payments;
CREATE POLICY "Org admins read own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id));