-- Postgres grants EXECUTE to PUBLIC by default, so revoking from anon/authenticated alone
-- is a no-op. Revoke from PUBLIC and re-grant only to service_role.
-- Rollback: GRANT EXECUTE ON FUNCTION <name> TO PUBLIC;
REVOKE ALL ON FUNCTION public.run_all_authz_tests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_scoring_authz_tests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._authz_probe_insert_allowed(_table text, _user uuid, _row text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_rubric_versions_immutable() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.run_all_authz_tests() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_scoring_authz_tests() TO service_role;
GRANT EXECUTE ON FUNCTION public._authz_probe_insert_allowed(_table text, _user uuid, _row text) TO service_role;