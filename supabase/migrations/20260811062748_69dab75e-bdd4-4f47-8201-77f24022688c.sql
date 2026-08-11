-- Record authorization test runs (incl. the seat cap checks) into
-- public.authz_test_reports so CI and staff can verify coverage.
-- Rollback:
--   DROP VIEW IF EXISTS public.authz_test_report_summary;
--   DROP FUNCTION IF EXISTS public.record_authz_test_run();
--   DELETE FROM public.authz_test_reports WHERE suite IN ('authz_matrix','seat_cap');

CREATE OR REPLACE FUNCTION public.record_authz_test_run()
RETURNS TABLE (suite text, checks int, failures int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lines text[];
BEGIN
  SELECT array_agg(t) INTO lines FROM public.run_all_authz_tests() t;
  lines := COALESCE(lines, ARRAY[]::text[]);

  DELETE FROM public.authz_test_reports WHERE authz_test_reports.suite IN ('authz_matrix', 'seat_cap');

  INSERT INTO public.authz_test_reports (suite, ordinal, line)
  SELECT 'authz_matrix', ord::int, l
  FROM unnest(lines) WITH ORDINALITY AS u(l, ord);

  -- Dedicated seat-enforcement slice so seat coverage is verifiable on its own.
  INSERT INTO public.authz_test_reports (suite, ordinal, line)
  SELECT 'seat_cap', row_number() OVER (ORDER BY ord)::int, l
  FROM unnest(lines) WITH ORDINALITY AS u(l, ord)
  WHERE l ILIKE '%seat%';

  RETURN QUERY
  SELECT r.suite,
         count(*)::int,
         count(*) FILTER (WHERE r.line LIKE 'FAIL%')::int
  FROM public.authz_test_reports r
  WHERE r.suite IN ('authz_matrix', 'seat_cap')
  GROUP BY r.suite
  ORDER BY r.suite;
END $$;

REVOKE ALL ON FUNCTION public.record_authz_test_run() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_authz_test_run() TO service_role;

CREATE OR REPLACE VIEW public.authz_test_report_summary
WITH (security_invoker = true) AS
SELECT suite,
       max(created_at) AS last_run_at,
       count(*)::int AS checks,
       count(*) FILTER (WHERE line LIKE 'PASS%')::int AS passed,
       count(*) FILTER (WHERE line LIKE 'FAIL%')::int AS failed
FROM public.authz_test_reports
GROUP BY suite;

REVOKE ALL ON public.authz_test_report_summary FROM anon;
GRANT SELECT ON public.authz_test_report_summary TO authenticated;
GRANT ALL ON public.authz_test_report_summary TO service_role;

-- Record one run now.
SELECT * FROM public.record_authz_test_run();