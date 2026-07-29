REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, membership_role[]) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_candidate_contact_released_to_org(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, membership_role[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_candidate_contact_released_to_org(uuid, uuid, uuid) TO service_role;