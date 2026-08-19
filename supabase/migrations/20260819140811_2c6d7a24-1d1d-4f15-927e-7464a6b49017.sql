ALTER VIEW public.v_admin_candidate_index SET (security_invoker = true);
REVOKE ALL ON public.v_admin_candidate_index FROM anon, authenticated;
GRANT SELECT ON public.v_admin_candidate_index TO service_role;