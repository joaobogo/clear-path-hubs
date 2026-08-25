CREATE OR REPLACE FUNCTION public._rls_proof_seed(ids jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  org_a uuid := (ids->>'org_a')::uuid;
  org_b uuid := (ids->>'org_b')::uuid;
  u_staff uuid := (ids->>'u_staff')::uuid;
  u_a_admin uuid := (ids->>'u_a_admin')::uuid;
  u_a_view uuid := (ids->>'u_a_view')::uuid;
  u_b_admin uuid := (ids->>'u_b_admin')::uuid;
  u_cand uuid := (ids->>'u_cand')::uuid;
  pos_a uuid := (ids->>'pos_a')::uuid;
  cand_ok uuid := (ids->>'cand_ok')::uuid;
  cand_hidden uuid := (ids->>'cand_hidden')::uuid;
  app_ok uuid := (ids->>'app_ok')::uuid;
  app_hidden uuid := (ids->>'app_hidden')::uuid;
  match_ok uuid := (ids->>'match_ok')::uuid;
  match_hidden uuid := (ids->>'match_hidden')::uuid;
  rubric uuid := (ids->>'rubric')::uuid;
  run_ok uuid := (ids->>'run_ok')::uuid;
  ev_ok uuid := (ids->>'ev_ok')::uuid;
  ev_hidden uuid := (ids->>'ev_hidden')::uuid;
  pool_a uuid := (ids->>'pool_a')::uuid;
  pool_sys uuid := (ids->>'pool_sys')::uuid;
  pool_b uuid := (ids->>'pool_b')::uuid;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         x::text || '@rlsproof.test.invalid', '', now(), now(), now()
  FROM unnest(ARRAY[u_staff, u_a_admin, u_a_view, u_b_admin, u_cand]) x;

  INSERT INTO public.profiles (auth_user_id, email, full_name, status)
  SELECT x, x::text || '@rlsproof.test.invalid', 'RLS proof fixture', 'active'
  FROM unnest(ARRAY[u_staff, u_a_admin, u_a_view, u_b_admin, u_cand]) x;

  INSERT INTO public.organizations (id, name, client_seat_limit)
  VALUES (org_a, 'RLS Proof Fixture A', 5), (org_b, 'RLS Proof Fixture B', 5);

  INSERT INTO public.memberships (user_id, organization_id, role, status) VALUES
    (u_staff,   org_a, 'platform_admin', 'active'),
    (u_a_admin, org_a, 'client_admin',   'active'),
    (u_a_view,  org_a, 'client_viewer',  'active'),
    (u_b_admin, org_b, 'client_admin',   'active');

  INSERT INTO public.positions (id, organization_id, title, description, status,
                                requirements, visibility, payment_status)
  VALUES (pos_a, org_a, 'RLS Proof Fixture Role',
          'Description long enough to satisfy the approval completeness gate.',
          'active', '[{"label":"req"}]'::jsonb, 'private', 'exempt');

  INSERT INTO public.candidate_profiles (id, full_name, email) VALUES
    (cand_ok,     'RLS Proof Approved Candidate', cand_ok::text || '@rlsproof.test.invalid'),
    (cand_hidden, 'RLS Proof Hidden Candidate',   cand_hidden::text || '@rlsproof.test.invalid');

  INSERT INTO public.applications (id, position_id, candidate_profile_id) VALUES
    (app_ok, pos_a, cand_ok), (app_hidden, pos_a, cand_hidden);

  INSERT INTO public.rubric_versions (id, position_id, organization_id, version_number,
                                      status, label)
  VALUES (rubric, pos_a, org_a, 1, 'active', 'RLS proof rubric');

  INSERT INTO public.candidate_matches
    (id, organization_id, position_id, application_id, candidate_profile_id,
     client_visibility, canonical_state)
  VALUES (match_ok,     org_a, pos_a, app_ok,     cand_ok,     'hidden', 'provisional_scoring'),
         (match_hidden, org_a, pos_a, app_hidden, cand_hidden, 'hidden', 'provisional_scoring');

  INSERT INTO public.score_runs (id, candidate_match_id, position_id, application_id,
                                 candidate_profile_id, candidate_submission_id,
                                 organization_id, engine_version,
                                 status, blueprint_version, raw_score, final_score,
                                 fit_band, rubric_version_id, completed_at)
  VALUES (run_ok, match_ok, pos_a, app_ok, cand_ok, app_ok, org_a, 'proof-1', 'completed',
          'proof-1', 80, 80, 'strong', rubric, now());

  UPDATE public.candidate_matches
     SET approved_score_run_id = run_ok, canonical_state = 'human_review'
   WHERE id = match_ok;
  UPDATE public.candidate_matches SET canonical_state = 'approved' WHERE id = match_ok;
  UPDATE public.candidate_matches
     SET canonical_state = 'published_to_client', client_visibility = 'visible'
   WHERE id = match_ok;

  INSERT INTO public.candidate_evidence (id, candidate_match_id, candidate_profile_id,
                                         engine_version)
  VALUES (ev_ok, match_ok, cand_ok, 'proof-1'),
         (ev_hidden, match_hidden, cand_hidden, 'proof-1');

  INSERT INTO public.candidate_evidence_items
    (candidate_evidence_id, candidate_match_id, organization_id, rubric_criterion_key,
     rubric_dimension_key, match_type, confidence, source_passage, normalized_meaning,
     reviewer_status, engine_version, integrity_ok)
  VALUES (ev_ok, match_ok, org_a, 'req_1', 'must_have', 'direct', 0.9,
          'Led the integration platform team for four years.',
          'Four years leading integrations.', 'accepted', 'proof-1', true),
         (ev_hidden, match_hidden, org_a, 'req_1', 'must_have', 'direct', 0.9,
          'Hidden candidate passage that must not leak.',
          'Hidden meaning.', 'accepted', 'proof-1', true);

  INSERT INTO public.talent_pools (id, organization_id, name, is_system, system_key)
  VALUES (pool_a,   org_a, 'RLS Proof Pool A', false, NULL),
         (pool_sys, org_a, 'RLS Proof System Pool', true, 'rls_proof_system'),
         (pool_b,   org_b, 'RLS Proof Pool B', false, NULL);

  INSERT INTO public.talent_pool_members (pool_id, organization_id, candidate_profile_id)
  VALUES (pool_a, org_a, cand_ok), (pool_a, org_a, cand_hidden);
END $$;

REVOKE ALL ON FUNCTION public._rls_proof_seed(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._rls_proof_seed(jsonb) TO service_role;

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

      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u_a_admin::text, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      BEGIN
        DELETE FROM public.talent_pools WHERE id = pool_sys;
        GET DIAGNOSTICS deleted = ROW_COUNT;
      EXCEPTION WHEN insufficient_privilege THEN
        deleted := 0;
      END;
      RESET ROLE;
      PERFORM set_config('request.jwt.claims', '', true);
      results := array_append(results, (CASE WHEN deleted = 0 THEN 'PASS' ELSE 'FAIL' END)
        || format(' :: client_admin deleted %s system pools (must be 0)', deleted));

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