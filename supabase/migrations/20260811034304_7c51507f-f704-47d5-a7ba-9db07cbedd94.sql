-- Test-harness and trigger functions should never be callable through the Data API.
-- RLS helper predicates (is_org_member, match_in_org, position_in_org, evidence_item_in_match,
-- public_position_*) are intentionally left executable: policies evaluate them as the
-- querying role, so revoking EXECUTE would break row-level security.
-- Rollback: GRANT EXECUTE ON FUNCTION <name> TO anon, authenticated;
REVOKE ALL ON FUNCTION public.run_all_authz_tests() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.run_scoring_authz_tests() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public._authz_probe_insert_allowed(_table text, _user uuid, _row text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_rubric_versions_immutable() FROM anon, authenticated;