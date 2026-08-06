DROP FUNCTION IF EXISTS public._authz_probe_insert(text, uuid);

CREATE OR REPLACE FUNCTION public._authz_probe_insert_allowed(_table text, _user uuid, _row text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  checks text;
  ok boolean;
BEGIN
  SELECT string_agg('(' || pg_get_expr(p.polwithcheck, p.polrelid) || ')', ' OR ')
    INTO checks
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public'
     AND c.relname = _table
     AND p.polcmd IN ('a', '*')
     AND p.polwithcheck IS NOT NULL
     AND (p.polroles = '{0}'::oid[]
          OR 'authenticated'::regrole = ANY (p.polroles));

  IF checks IS NULL THEN
    RETURN false;
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _user::text, 'role', 'authenticated')::text, true);

  EXECUTE format('SELECT coalesce((%s), false) FROM (SELECT %s) t', checks, _row) INTO ok;

  PERFORM set_config('request.jwt.claims', '', true);
  RETURN coalesce(ok, false);
END $$;

REVOKE EXECUTE ON FUNCTION public._authz_probe_insert_allowed(text, uuid, text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_scoring_authz_tests()
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  results text[] := ARRAY[]::text[];
  r text;
BEGIN
  BEGIN
    DECLARE
      org_a uuid := gen_random_uuid();
      org_b uuid := gen_random_uuid();
      u_a_edit uuid := gen_random_uuid();
      u_b_edit uuid := gen_random_uuid();
      pos_a uuid := gen_random_uuid();
      pos_b uuid := gen_random_uuid();
      cand uuid := gen_random_uuid();
      app_a uuid := gen_random_uuid();
      app_b uuid := gen_random_uuid();
      match_a uuid := gen_random_uuid();
      match_b uuid := gen_random_uuid();
      ev_a uuid := gen_random_uuid();
      item_a uuid := gen_random_uuid();
      allowed boolean;
    BEGIN
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                              email_confirmed_at, created_at, updated_at)
      SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             x::text || '@authz.test.invalid', '', now(), now(), now()
      FROM unnest(ARRAY[u_a_edit, u_b_edit]) x;

      INSERT INTO public.profiles (auth_user_id, email, full_name, status)
      SELECT x, x::text || '@authz.test.invalid', 'AuthZ authoring fixture', 'active'
      FROM unnest(ARRAY[u_a_edit, u_b_edit]) x;

      INSERT INTO public.organizations (id, name, client_seat_limit)
      VALUES (org_a, 'AuthZ Authoring A', 3), (org_b, 'AuthZ Authoring B', 3);

      INSERT INTO public.memberships (user_id, organization_id, role, status) VALUES
        (u_a_edit, org_a, 'client_admin', 'active'),
        (u_b_edit, org_b, 'client_admin', 'active');

      INSERT INTO public.positions (id, organization_id, title, description, status,
                                    requirements, visibility, payment_status)
      VALUES (pos_a, org_a, 'AuthZ Authoring Role A',
              'Description long enough to satisfy the approval completeness gate.',
              'active', '[{"label":"req"}]'::jsonb, 'private', 'exempt'),
             (pos_b, org_b, 'AuthZ Authoring Role B',
              'Description long enough to satisfy the approval completeness gate.',
              'active', '[{"label":"req"}]'::jsonb, 'private', 'exempt');

      INSERT INTO public.candidate_profiles (id, full_name, email)
      VALUES (cand, 'AuthZ Authoring Candidate', cand::text || '@authz.test.invalid');

      INSERT INTO public.applications (id, position_id, candidate_profile_id)
      VALUES (app_a, pos_a, cand), (app_b, pos_b, cand);

      INSERT INTO public.candidate_matches
        (id, organization_id, position_id, application_id, candidate_profile_id, client_visibility)
      VALUES (match_a, org_a, pos_a, app_a, cand, 'hidden'),
             (match_b, org_b, pos_b, app_b, cand, 'hidden');

      INSERT INTO public.candidate_evidence
        (id, candidate_match_id, candidate_profile_id, engine_version)
      VALUES (ev_a, match_a, cand, 'test');

      INSERT INTO public.candidate_evidence_items
        (id, candidate_evidence_id, candidate_match_id, organization_id,
         rubric_dimension_key, rubric_criterion_key, match_type, result, confidence,
         source_passage, source_location, normalized_meaning, reviewer_status,
         engine_version, integrity_ok)
      VALUES (item_a, ev_a, match_a, org_a, 'skills', 'sql', 'direct', 'strong', 0.9,
              'wrote sql daily', '{"page":1}'::jsonb, 'sql experience', 'accepted',
              'test', true);

      allowed := public._authz_probe_insert_allowed('rubric_versions', u_a_edit, format(
        '%L::uuid AS organization_id, %L::uuid AS position_id', org_a, pos_a));
      results := array_append(results, (CASE WHEN allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an editor can create a rubric version for their own organization');

      allowed := public._authz_probe_insert_allowed('rubric_versions', u_a_edit, format(
        '%L::uuid AS organization_id, %L::uuid AS position_id', org_b, pos_b));
      results := array_append(results, (CASE WHEN NOT allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an editor of org A cannot create a rubric version for org B');

      allowed := public._authz_probe_insert_allowed('rubric_versions', u_a_edit, format(
        '%L::uuid AS organization_id, %L::uuid AS position_id', org_a, pos_b));
      results := array_append(results, (CASE WHEN NOT allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - a rubric version cannot point at another organization''s role');

      allowed := public._authz_probe_insert_allowed('evidence_overrides', u_a_edit, format(
        '%L::uuid AS organization_id, %L::uuid AS candidate_match_id, %L::uuid AS evidence_item_id, %L::uuid AS actor_user_id',
        org_a, match_a, item_a, u_a_edit));
      results := array_append(results, (CASE WHEN allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an editor can correct evidence in their own organization');

      allowed := public._authz_probe_insert_allowed('evidence_overrides', u_a_edit, format(
        '%L::uuid AS organization_id, %L::uuid AS candidate_match_id, NULL::uuid AS evidence_item_id, %L::uuid AS actor_user_id',
        org_b, match_b, u_a_edit));
      results := array_append(results, (CASE WHEN NOT allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an editor of org A cannot create an evidence override for org B');

      allowed := public._authz_probe_insert_allowed('evidence_overrides', u_a_edit, format(
        '%L::uuid AS organization_id, %L::uuid AS candidate_match_id, NULL::uuid AS evidence_item_id, %L::uuid AS actor_user_id',
        org_a, match_b, u_a_edit));
      results := array_append(results, (CASE WHEN NOT allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an evidence override cannot point at another organization''s candidate');

      allowed := public._authz_probe_insert_allowed('evidence_overrides', u_b_edit, format(
        '%L::uuid AS organization_id, %L::uuid AS candidate_match_id, %L::uuid AS evidence_item_id, %L::uuid AS actor_user_id',
        org_b, match_b, item_a, u_b_edit));
      results := array_append(results, (CASE WHEN NOT allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an evidence override cannot reference an evidence item from another candidate');

      allowed := public._authz_probe_insert_allowed('evidence_overrides', u_a_edit, format(
        '%L::uuid AS organization_id, %L::uuid AS candidate_match_id, NULL::uuid AS evidence_item_id, %L::uuid AS actor_user_id',
        org_a, match_a, u_b_edit));
      results := array_append(results, (CASE WHEN NOT allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an evidence override must be attributed to the acting reviewer');

      RAISE EXCEPTION 'authz_test_rollback';
    END;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'authz_test_rollback' THEN
      RAISE;
    END IF;
  END;

  FOREACH r IN ARRAY results LOOP
    RETURN NEXT r;
  END LOOP;
  RETURN NEXT CASE
    WHEN EXISTS (SELECT 1 FROM unnest(results) x WHERE x LIKE 'FAIL%')
      THEN 'RESULT :: FAILURES DETECTED'
    ELSE 'RESULT :: ALL AUTHORING AUTHORIZATION CHECKS PASSED'
  END;
END $$;

REVOKE EXECUTE ON FUNCTION public.run_scoring_authz_tests() FROM anon, authenticated;