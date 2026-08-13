
-- Read-only tenancy/role isolation proof. Uses existing _authz_probe_visible
-- (SET LOCAL ROLE authenticated + jwt claims) so every count is measured the
-- way PostgREST would measure it. No data is written except the report rows.
-- Rollback: DROP FUNCTION public.run_tenant_isolation_proof();
--           DELETE FROM public.authz_test_reports WHERE suite = 'tenant_isolation';

CREATE OR REPLACE FUNCTION public.run_tenant_isolation_proof()
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $fn$
DECLARE
  results text[] := ARRAY[]::text[];
  r record;
  u_client uuid;
  org_client uuid;
  u_other uuid;
  org_other uuid;
  u_cand uuid;
  n bigint;
  leaks int := 0;
  m record;
BEGIN
  SELECT p.auth_user_id, mm.organization_id INTO u_client, org_client
  FROM public.profiles p
  JOIN public.memberships mm ON mm.user_id = p.auth_user_id AND mm.status = 'active'
  WHERE p.email = 'qa.clientadmin@qa.taasflow.test' LIMIT 1;

  SELECT p.auth_user_id, mm.organization_id INTO u_other, org_other
  FROM public.profiles p
  JOIN public.memberships mm ON mm.user_id = p.auth_user_id AND mm.status = 'active'
  WHERE p.email = 'qa.otherclientadmin@qa.taasflow.test' LIMIT 1;

  SELECT p.auth_user_id INTO u_cand FROM public.profiles p
  WHERE p.email = 'qa.candidate@qa.taasflow.test' LIMIT 1;

  IF u_client IS NULL OR u_other IS NULL OR u_cand IS NULL THEN
    RETURN NEXT 'FAIL :: proof fixtures missing (qa.* users)';
    RETURN;
  END IF;

  results := array_append(results, format('INFO :: client=%s org=%s | other=%s org=%s | candidate=%s',
    u_client, org_client, u_other, org_other, u_cand));

  -- 1. Cross-tenant reads on every org-scoped table, for the client user and
  --    for the candidate. Both must see zero rows outside their own scope.
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'organization_id'
    ORDER BY 1
  LOOP
    n := public._authz_probe_visible(r.table_name, u_client,
           format('t.organization_id IS NOT NULL AND t.organization_id <> %L', org_client));
    IF n <> 0 THEN leaks := leaks + 1; END IF;
    results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
      || format(' :: client user sees %s foreign-org rows in %s', n, r.table_name));

    n := public._authz_probe_visible(r.table_name, u_cand, 't.organization_id IS NOT NULL');
    IF n <> 0 THEN leaks := leaks + 1; END IF;
    results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
      || format(' :: candidate sees %s org-scoped rows in %s', n, r.table_name));
  END LOOP;

  -- 2. Staff-only surfaces stay closed to clients and candidates.
  FOR r IN SELECT unnest(ARRAY['admin_copilot_conversations','admin_copilot_messages',
                               'notification_deliveries','scoring_debug_events',
                               'business_rules_overrides','processing_jobs',
                               'migration_runs','crm_submission_queue']) AS table_name
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=r.table_name) THEN
      n := public._authz_probe_visible(r.table_name, u_client, 'true');
      IF n <> 0 THEN leaks := leaks + 1; END IF;
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: client user sees %s rows in staff-only %s', n, r.table_name));

      n := public._authz_probe_visible(r.table_name, u_cand, 'true');
      IF n <> 0 THEN leaks := leaks + 1; END IF;
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: candidate sees %s rows in staff-only %s', n, r.table_name));
    END IF;
  END LOOP;

  -- 3. Approval gate: unapproved candidates are invisible to their own client.
  n := public._authz_probe_visible('candidate_matches', u_client,
         format('t.organization_id = %L AND t.client_visibility <> %L', org_client, 'visible'));
  IF n <> 0 THEN leaks := leaks + 1; END IF;
  results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
    || format(' :: client sees %s not-yet-approved candidates in their own org', n));

  n := public._authz_probe_visible('candidate_matches', u_other,
         format('t.client_visibility <> %L', 'visible'));
  IF n <> 0 THEN leaks := leaks + 1; END IF;
  results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
    || format(' :: second client org sees %s not-yet-approved candidates', n));

  -- 4. Contact release is a separate decision from visibility: across all
  --    approved matches, visibility must never imply contact release.
  SELECT count(*) FILTER (WHERE public.is_match_client_visible(mm.user_id, cm.id)) AS visible,
         count(*) FILTER (WHERE public.is_match_client_visible(mm.user_id, cm.id)
                            AND NOT public.is_match_contact_released(mm.user_id, cm.id)) AS visible_no_contact,
         count(*) FILTER (WHERE public.is_match_contact_released(mm.user_id, cm.id)
                            AND cm.contact_released_at IS NULL) AS released_without_decision
    INTO m
  FROM public.candidate_matches cm
  JOIN public.memberships mm ON mm.organization_id = cm.organization_id AND mm.status = 'active';

  results := array_append(results, (CASE WHEN m.released_without_decision = 0 THEN 'PASS' ELSE 'FAIL' END)
    || format(' :: %s matches report contact released without a release decision', m.released_without_decision));
  IF m.released_without_decision <> 0 THEN leaks := leaks + 1; END IF;
  results := array_append(results,
    format('INFO :: approved (member,match) pairs=%s, of which contact still withheld=%s',
           m.visible, m.visible_no_contact));

  results := array_append(results, format('SUMMARY :: leaks=%s', leaks));

  DELETE FROM public.authz_test_reports WHERE suite = 'tenant_isolation';
  INSERT INTO public.authz_test_reports (suite, ordinal, line)
  SELECT 'tenant_isolation', i, results[i] FROM generate_subscripts(results, 1) AS i;

  RETURN QUERY SELECT unnest(results);
END;
$fn$;

REVOKE ALL ON FUNCTION public.run_tenant_isolation_proof() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_tenant_isolation_proof() TO service_role;
