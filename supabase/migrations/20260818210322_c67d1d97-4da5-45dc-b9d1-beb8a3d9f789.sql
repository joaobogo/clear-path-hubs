-- Public board gate: a role whose owning organization is a test/QA/demo fixture
-- may never be publicly listed or read, whatever its own visibility/status
-- flags say. Anon has no read access to `organizations` (and must not get any),
-- so the check runs in a definer function that returns ids only.
CREATE OR REPLACE FUNCTION public.public_publishable_position_ids(_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.positions p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = ANY(_ids)
    AND COALESCE(p.is_test_record, false) = false
    AND COALESCE(o.is_test_record, false) = false
    AND o.test_run_id IS NULL
$$;

GRANT EXECUTE ON FUNCTION public.public_publishable_position_ids(uuid[]) TO anon, authenticated, service_role;