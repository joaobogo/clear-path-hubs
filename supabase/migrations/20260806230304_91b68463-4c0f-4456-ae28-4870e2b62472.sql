-- v_admin_candidate_index was the last SECURITY DEFINER view: it ran with the
-- creator's rights, so it could bypass row level security. Staff code reads it
-- through service_role, which bypasses RLS anyway, so switching to
-- security_invoker changes nothing operationally while closing the bypass.
ALTER VIEW public.v_admin_candidate_index SET (security_invoker = on);

REVOKE ALL ON public.v_admin_candidate_index FROM anon;
REVOKE ALL ON public.v_admin_candidate_index FROM authenticated;
GRANT SELECT ON public.v_admin_candidate_index TO service_role;
