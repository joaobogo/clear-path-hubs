-- authz_test_reports was missed by the platform-wide privilege sweep: `anon` and
-- `authenticated` both still held arwdDxtm (including INSERT/UPDATE/DELETE/TRUNCATE/
-- TRIGGER) even though the table's only policy is a platform-staff SELECT.
-- RLS already denied anon every row, but the grants are far wider than the policy
-- surface and must match it.
--
-- Rollback: GRANT ALL ON public.authz_test_reports TO anon, authenticated;

REVOKE ALL ON public.authz_test_reports FROM anon;
REVOKE ALL ON public.authz_test_reports FROM authenticated;

GRANT SELECT ON public.authz_test_reports TO authenticated;
GRANT ALL ON public.authz_test_reports TO service_role;
