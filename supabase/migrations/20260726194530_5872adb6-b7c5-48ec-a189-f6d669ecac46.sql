CREATE OR REPLACE FUNCTION public.run_authz_tests()
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  results text[] := ARRAY[]::text[];
  r text;
BEGIN
  -- Everything happens inside this block. It ALWAYS ends by raising the
  -- sentinel 'authz_test_rollback', which unwinds the implicit subtransaction
  -- and discards every fixture row. No production data is touched.
  BEGIN
    DECLARE
      org_a uuid := gen_random_uuid();
      org_b uuid := gen_random_uuid();
      u_staff uuid := gen_random_uuid();
      u_a_owner uuid := gen_random_uuid();
      u_a_view uuid := gen_random_uuid();
      u_b_owner uuid := gen_random_uuid();
      pos_a uuid := gen_random_uuid();
      pos_b uuid := gen_random_uuid();
      cand uuid := gen_random_uuid();
      app_a uuid := gen_random_uuid();
      app_b uuid := gen_random_uuid();
      match_a uuid := gen_random_uuid();
      match_b uuid := gen_random_uuid();
      seat_u uuid;
      seat_n int := 0;
      seat_capped boolean := false;
      ok boolean;
    BEGIN
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                              email_confirmed_at, created_at, updated_at)
      SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             x::text || '@authz.test.invalid', '', now(), now(), now()
      FROM unnest(ARRAY[u_staff, u_a_owner, u_a_view, u_b_owner]) x;

      INSERT INTO public.profiles (auth_user_id, email, full_name, status)
      SELECT x, x::text || '@authz.test.invalid', 'AuthZ fixture', 'active'
      FROM unnest(ARRAY[u_staff, u_a_owner, u_a_view, u_b_owner]) x;

      INSERT INTO public.organizations (id, name, client_seat_limit)
      VALUES (org_a, 'AuthZ Fixture A', 3), (org_b, 'AuthZ Fixture B', 3);

      INSERT INTO public.memberships (user_id, organization_id, role, status) VALUES
        (u_staff,   org_a, 'platform_admin', 'active'),
        (u_a_owner, org_a, 'client_admin',   'active'),
        (u_a_view,  org_a, 'client_viewer',  'active'),
        (u_b_owner, org_b, 'client_admin',   'active');

      SELECT permissions @> ARRAY['view_candidates','manage_jobs','invite_members']::public.client_permission[]
        INTO ok FROM public.memberships WHERE user_id = u_a_owner;
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: client_admin seat receives the full permission set');

      SELECT NOT (permissions && ARRAY['invite_members','manage_jobs']::public.client_permission[])
        INTO ok FROM public.memberships WHERE user_id = u_a_view;
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: client_viewer seat cannot invite members or manage jobs');

      ok := public.has_client_permission(u_a_owner, org_a, 'manage_jobs')
        AND NOT public.has_client_permission(u_a_view, org_a, 'manage_jobs');
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: has_client_permission matches the stored seat permissions');

      ok := public.is_org_member(u_a_owner, org_a) AND NOT public.is_org_member(u_a_owner, org_b);
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: membership does not cross organization boundaries');

      ok := NOT public.has_client_permission(u_b_owner, org_a, 'view_candidates');
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: another organization''s owner holds no permission here');

      ok := public.is_platform_staff(u_staff) AND NOT public.is_platform_staff(u_a_owner);
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: platform staff detection is exact');

      FOR seat_n IN 1..4 LOOP
        seat_u := gen_random_uuid();
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                                email_confirmed_at, created_at, updated_at)
        VALUES (seat_u, '00000000-0000-0000-0000-000000000000', 'authenticated',
                'authenticated', seat_u::text || '@authz.test.invalid', '', now(), now(), now());
        INSERT INTO public.profiles (auth_user_id, email, status)
        VALUES (seat_u, seat_u::text || '@authz.test.invalid', 'active');
        BEGIN
          INSERT INTO public.memberships (user_id, organization_id, role, status)
          VALUES (seat_u, org_a, 'client_viewer', 'active');
        EXCEPTION WHEN check_violation THEN
          seat_capped := true;
          EXIT;
        END;
      END LOOP;
      results := array_append(results, (CASE WHEN seat_capped THEN 'PASS' ELSE 'FAIL' END)
        || ' :: seat limit rejects seats beyond the organization allowance');

      INSERT INTO public.positions (id, organization_id, title, description, status, requirements)
      VALUES (pos_a, org_a, 'AuthZ Fixture Role A',
              'Description long enough to satisfy the approval completeness gate.',
              'active', '[{"label":"req"}]'::jsonb),
             (pos_b, org_b, 'AuthZ Fixture Role B',
              'Description long enough to satisfy the approval completeness gate.',
              'active', '[{"label":"req"}]'::jsonb);

      INSERT INTO public.candidate_profiles (id, full_name, email)
      VALUES (cand, 'AuthZ Fixture Candidate', cand::text || '@authz.test.invalid');

      INSERT INTO public.applications (id, position_id, candidate_profile_id)
      VALUES (app_a, pos_a, cand), (app_b, pos_b, cand);

      INSERT INTO public.candidate_matches
        (id, organization_id, position_id, application_id, candidate_profile_id, client_visibility)
      VALUES (match_a, org_a, pos_a, app_a, cand, 'hidden'),
             (match_b, org_b, pos_b, app_b, cand, 'hidden');

      ok := NOT public.is_match_client_visible(u_a_owner, match_a)
        AND NOT public.is_match_client_visible(u_a_view, match_a);
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: unapproved candidate is invisible to every client seat');

      ok := false;
      BEGIN
        UPDATE public.candidate_matches SET client_visibility = 'visible' WHERE id = match_a;
      EXCEPTION WHEN OTHERS THEN ok := true;
      END;
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: candidate cannot be published without an approved score run');

      ok := NOT public.is_match_client_visible(u_b_owner, match_a)
        AND NOT public.is_match_client_visible(u_a_owner, match_b);
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: approval never crosses organization or job boundaries');

      ok := NOT public.is_match_contact_released(u_a_owner, match_a);
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: contact details are withheld by default');

      UPDATE public.candidate_matches
         SET contact_released_at = now(), contact_released_by = u_staff
       WHERE id = match_a;

      ok := NOT public.is_match_client_visible(u_a_owner, match_a);
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: releasing contact does not make a hidden candidate visible');

      ok := NOT public.is_match_contact_released(u_b_owner, match_a);
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: contact release does not leak to another organization');

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
    ELSE 'RESULT :: ALL AUTHORIZATION CHECKS PASSED'
  END;
END $fn$;

REVOKE ALL ON FUNCTION public.run_authz_tests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_authz_tests() FROM anon, authenticated;
