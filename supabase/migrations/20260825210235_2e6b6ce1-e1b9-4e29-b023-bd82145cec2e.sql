ALTER FUNCTION public._authz_probe_view_visible(text, uuid, text, text) SECURITY INVOKER;
ALTER FUNCTION public.run_talent_pool_rls_proof() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public._authz_probe_view_visible(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_talent_pool_rls_proof() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._authz_probe_view_visible(text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_talent_pool_rls_proof() TO service_role;