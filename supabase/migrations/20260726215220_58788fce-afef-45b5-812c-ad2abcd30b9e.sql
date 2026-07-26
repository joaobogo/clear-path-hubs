-- Lock down privileged/trigger functions from anonymous execution
REVOKE ALL ON FUNCTION public.grant_platform_admin_for_taasflow_domain() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_candidate_matches_log_stage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_hire_records_sync_match() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_interviews_status_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_memberships_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_positions_version_snapshot() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.scoring_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scoring_readiness(uuid) TO authenticated, service_role;