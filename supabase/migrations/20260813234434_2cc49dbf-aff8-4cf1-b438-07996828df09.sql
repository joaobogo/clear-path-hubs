-- Execute the read-only proof and persist its report.
-- Rollback: DELETE FROM public.authz_test_reports WHERE suite = 'tenant_isolation';
DO $$ BEGIN PERFORM public.run_tenant_isolation_proof(); END $$;