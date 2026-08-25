CREATE OR REPLACE FUNCTION public._authz_probe_view_visible(_view text, _user uuid, _filter text DEFAULT 'true'::text, _role text DEFAULT 'authenticated'::text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  n bigint;
  prev text := current_user;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    CASE WHEN _user IS NULL THEN json_build_object('role', _role)::text
         ELSE json_build_object('sub', _user::text, 'role', _role)::text END,
    true);
  BEGIN
    EXECUTE format('SET LOCAL ROLE %I', _role);
    EXECUTE format('SELECT count(*) FROM public.%I t WHERE (%s)', _view, _filter) INTO n;
    EXECUTE format('SET LOCAL ROLE %I', prev);
  EXCEPTION WHEN insufficient_privilege THEN
    EXECUTE format('SET LOCAL ROLE %I', prev);
    n := -1;
  END;
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN coalesce(n, -1);
END $$;

REVOKE ALL ON FUNCTION public._authz_probe_view_visible(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._authz_probe_view_visible(text, uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.run_talent_pool_rls_proof()
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  results text[] := ARRAY[]::text[];
  r text;
BEGIN
  BEGIN
    DECLARE
      ids jsonb;
      prev text := current_user;
      org_a uuid := gen_random_uuid();
      org_b uuid := gen_random_uuid();
      u_staff uuid := gen_random_uuid();
      u_a_admin uuid := gen_random_uuid();
      u_a_view uuid := gen_random_uuid();
      u_b_admin uuid := gen_random_uuid();
      u_cand uuid := gen_random_uuid();
      pos_a uuid := gen_random_uuid();
      cand_ok uuid := gen_random_uuid();
      cand_hidden uuid := gen_random_uuid();
      app_ok uuid := gen_random_uuid();
      app_hidden uuid := gen_random_uuid();
      match_ok uuid := gen_random_uuid();
      match_hidden uuid := gen_random_uuid();
      rubric uuid := gen_random_uuid();
      run_ok uuid := gen_random_uuid();
      ev_ok uuid := gen_random_uuid();
      ev_hidden uuid := gen_random_uuid();
      pool_a uuid := gen_random_uuid();
      pool_sys uuid := gen_random_uuid();
      pool_b uuid := gen_random_uuid();
      n bigint;
      ok boolean;
      deleted int;
    BEGIN
      ids := jsonb_build_object(
        'org_a', org_a, 'org_b', org_b, 'u_staff', u_staff, 'u_a_admin', u_a_admin,
        'u_a_view', u_a_view, 'u_b_admin', u_b_admin, 'u_cand', u_cand, 'pos_a', pos_a,
        'cand_ok', cand_ok, 'cand_hidden', cand_hidden, 'app_ok', app_ok,
        'app_hidden', app_hidden, 'match_ok', match_ok, 'match_hidden', match_hidden,
        'rubric', rubric, 'run_ok', run_ok, 'ev_ok', ev_ok, 'ev_hidden', ev_hidden,
        'pool_a', pool_a, 'pool_sys', pool_sys, 'pool_b', pool_b);
      PERFORM public._rls_proof_seed(ids);

      n := public._authz_probe_visible('talent_pools', u_a_admin,
             format('organization_id = %L', org_a));
      results := array_append(results, (CASE WHEN n = 2 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: client_admin reads %s of 2 pools in their own organization', n));

      n := public._authz_probe_visible('talent_pools', u_a_view,
             format('organization_id = %L', org_a));
      results := array_append(results, (CASE WHEN n = 2 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: client_viewer reads %s of 2 pools in their own organization', n));

      n := public._authz_probe_visible('talent_pools', u_b_admin,
             format('organization_id = %L', org_a));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: another organization''s admin reads %s pools here', n));

      n := public._authz_probe_visible('talent_pools', u_cand,
             format('organization_id IN (%L,%L)', org_a, org_b));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: candidate reads %s talent pools', n));

      n := public._authz_probe_visible('talent_pools', u_staff,
             format('organization_id = %L', org_a));
      results := array_append(results, (CASE WHEN n = 2 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: platform staff reads %s of 2 pools for support', n));

      n := public._authz_probe_visible('talent_pool_members', u_a_admin,
             format('pool_id = %L', pool_a));
      results := array_append(results, (CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: client_admin reads %s of 2 pool members (only the approved candidate)', n));

      n := public._authz_probe_visible('talent_pool_members', u_a_admin,
             format('candidate_profile_id = %L', cand_hidden));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: client_admin reads %s pool rows for a candidate not approved for them', n));

      n := public._authz_probe_visible('talent_pool_members', u_b_admin,
             format('pool_id = %L', pool_a));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: another organization''s admin reads %s pool members here', n));

      n := public._authz_probe_visible('talent_pool_members', u_cand,
             format('pool_id = %L', pool_a));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: candidate reads %s pool member rows', n));

      ok := public._authz_probe_insert_allowed('talent_pools', u_a_admin,
              format('%L::uuid AS organization_id, %L::text AS name, false AS is_system', org_a, 'probe'));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: client_admin may create a talent pool in their own organization');

      ok := NOT public._authz_probe_insert_allowed('talent_pools', u_a_view,
              format('%L::uuid AS organization_id, %L::text AS name, false AS is_system', org_a, 'probe'));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: read-only seat may not create a talent pool');

      ok := NOT public._authz_probe_insert_allowed('talent_pools', u_b_admin,
              format('%L::uuid AS organization_id, %L::text AS name, false AS is_system', org_a, 'probe'));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: an admin of another organization may not create a pool here');

      ok := NOT public._authz_probe_insert_allowed('talent_pool_members', u_a_view,
              format('%L::uuid AS pool_id, %L::uuid AS organization_id, %L::uuid AS candidate_profile_id',
                     pool_a, org_a, cand_ok));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: read-only seat may not add a candidate to a pool');

      n := public._authz_probe_view_visible('client_visible_candidates', u_a_admin,
             format('t.position_id = %L', pos_a));
      results := array_append(results, (CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: client_admin reads %s of 2 candidates on the role (only the published one)', n));

      n := public._authz_probe_view_visible('client_visible_candidates', u_a_admin,
             format('t.candidate_match_id = %L', match_hidden));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: client_admin reads %s not-yet-approved candidate detail rows', n));

      n := public._authz_probe_view_visible('client_visible_candidates', u_a_view,
             format('t.candidate_match_id = %L', match_ok));
      results := array_append(results, (CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: client_viewer reads %s of 1 approved candidate detail row', n));

      n := public._authz_probe_view_visible('client_visible_candidates', u_b_admin,
             format('t.organization_id = %L', org_a));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: another organization''s admin reads %s candidate detail rows here', n));

      n := public._authz_probe_view_visible('client_visible_candidates', u_cand,
             format('t.organization_id = %L', org_a));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: candidate reads %s candidate detail rows in a client organization', n));

      n := public._authz_probe_view_visible('client_visible_candidates', NULL,
             format('t.organization_id = %L', org_a), 'anon');
      results := array_append(results, (CASE WHEN n <= 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: anonymous read of candidate detail returns %s (-1 = denied)', n));

      n := public._authz_probe_view_visible('candidate_evidence_client', u_a_admin,
             format('t.candidate_match_id = %L', match_ok));
      results := array_append(results, (CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: client_admin reads %s of 1 evidence row for the approved candidate', n));

      n := public._authz_probe_view_visible('candidate_evidence_client', u_a_admin,
             format('t.candidate_match_id = %L', match_hidden));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: client_admin reads %s evidence rows for the hidden candidate', n));

      n := public._authz_probe_view_visible('candidate_evidence_client', u_b_admin,
             format('t.organization_id = %L', org_a));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: another organization''s admin reads %s evidence rows here', n));

      n := public._authz_probe_view_visible('candidate_evidence_client', u_cand,
             format('t.organization_id = %L', org_a));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: candidate reads %s evidence rows in a client organization', n));

      ok := public.is_match_client_visible(u_a_admin, match_ok)
        AND NOT public.is_match_client_visible(u_a_admin, match_hidden)
        AND NOT public.is_match_client_visible(u_b_admin, match_ok);
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: match visibility follows approval and organization membership');

      ok := NOT public.is_match_contact_released(u_a_admin, match_ok);
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: an approved candidate does not imply released contact details');

      ok := NOT public.is_candidate_visible_to_org(u_a_admin, org_a, cand_hidden)
        AND public.is_candidate_visible_to_org(u_a_admin, org_a, cand_ok);
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: candidate visibility helper agrees with the approval state');

      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u_a_admin::text, 'role', 'authenticated')::text, true);
      BEGIN
        EXECUTE 'SET LOCAL ROLE authenticated';
        DELETE FROM public.talent_pools WHERE id = pool_sys;
        GET DIAGNOSTICS deleted = ROW_COUNT;
      EXCEPTION WHEN insufficient_privilege THEN
        deleted := 0;
      END;
      EXECUTE format('SET LOCAL ROLE %I', prev);
      PERFORM set_config('request.jwt.claims', '', true);
      results := array_append(results, (CASE WHEN deleted = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: client_admin deleted %s system pools (must be 0)', deleted));

      FOREACH r IN ARRAY results LOOP
        RETURN NEXT r;
      END LOOP;

      RAISE EXCEPTION 'RLS_PROOF_ROLLBACK';
    END;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'RLS_PROOF_ROLLBACK' THEN
      RETURN NEXT 'FAIL :: proof aborted: ' || SQLERRM;
    END IF;
  END;
  RETURN;
END $$;

REVOKE ALL ON FUNCTION public.run_talent_pool_rls_proof() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_talent_pool_rls_proof() TO service_role;