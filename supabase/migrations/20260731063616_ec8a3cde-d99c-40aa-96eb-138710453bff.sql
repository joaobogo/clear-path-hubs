CREATE OR REPLACE FUNCTION public.run_authz_tests()
 RETURNS SETOF text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  results text[] := ARRAY[]::text[];
  r text;
BEGIN
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
      conv_a uuid := gen_random_uuid();
      conv_b uuid := gen_random_uuid();
      seat_u uuid;
      seat_n int := 0;
      seat_capped boolean := false;
      n int;
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

      -- Fixture roles are payment-exempt so the payment publish gate does not
      -- block the suite. The gate itself is asserted separately below.
      INSERT INTO public.positions (id, organization_id, title, description, status,
                                    requirements, visibility, payment_status)
      VALUES (pos_a, org_a, 'AuthZ Fixture Role A',
              'Description long enough to satisfy the approval completeness gate.',
              'active', '[{"label":"req"}]'::jsonb, 'private', 'exempt'),
             (pos_b, org_b, 'AuthZ Fixture Role B',
              'Description long enough to satisfy the approval completeness gate.',
              'active', '[{"label":"req"}]'::jsonb, 'private', 'exempt');

      -- The publish gate must still refuse an unpaid role.
      ok := false;
      BEGIN
        INSERT INTO public.positions (organization_id, title, description, status,
                                      requirements, visibility, payment_status)
        VALUES (org_a, 'AuthZ Unpaid Role',
                'Description long enough to satisfy the approval completeness gate.',
                'active', '[{"label":"req"}]'::jsonb, 'private', 'unpaid');
      EXCEPTION WHEN OTHERS THEN ok := true;
      END;
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: an unpaid role cannot be published');

      INSERT INTO public.candidate_profiles (id, full_name, email)
      VALUES (cand, 'AuthZ Fixture Candidate', cand::text || '@authz.test.invalid');

      INSERT INTO public.applications (id, position_id, candidate_profile_id)
      VALUES (app_a, pos_a, cand), (app_b, pos_b, cand);

      INSERT INTO public.candidate_matches
        (id, organization_id, position_id, application_id, candidate_profile_id, client_visibility)
      VALUES (match_a, org_a, pos_a, app_a, cand, 'hidden'),
             (match_b, org_b, pos_b, app_b, cand, 'hidden');

      INSERT INTO public.payments (organization_id, position_id, amount_cents, currency, status)
      VALUES (org_a, pos_a, 100000, 'usd', 'paid'),
             (org_b, pos_b, 200000, 'usd', 'paid');

      INSERT INTO public.conversations (id, organization_id, scope, position_id, subject)
      VALUES (conv_a, org_a, 'position', pos_a, 'AuthZ Fixture Thread A'),
             (conv_b, org_b, 'position', pos_b, 'AuthZ Fixture Thread B');

      INSERT INTO public.messages (conversation_id, organization_id, body, sender_user_id)
      VALUES (conv_a, org_a, 'fixture message a', u_a_owner),
             (conv_b, org_b, 'fixture message b', u_b_owner);

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

      -- ===== Live row-level checks, executed as the authenticated role =====
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u_b_owner::text, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;

      SELECT count(*) INTO n FROM public.positions WHERE id = pos_a;
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS — client of org B cannot read org A private roles');

      SELECT count(*) INTO n FROM public.candidate_matches WHERE id = match_a;
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS — client of org B cannot read org A candidates');

      SELECT count(*) INTO n FROM public.payments WHERE organization_id = org_a;
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS — client of org B cannot read org A payments');

      SELECT count(*) INTO n FROM public.conversations WHERE id = conv_a;
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS — client of org B cannot read org A conversations');

      SELECT count(*) INTO n FROM public.messages WHERE conversation_id = conv_a;
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS — client of org B cannot read org A messages');

      SELECT count(*) INTO n FROM public.payments WHERE organization_id = org_b;
      results := array_append(results, (CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS — a client can still read their own organization payments');

      RESET ROLE;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u_a_view::text, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;

      SELECT count(*) INTO n FROM public.candidate_matches WHERE id = match_a;
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS — an own-org viewer still cannot read unapproved candidates');

      RESET ROLE;
      PERFORM set_config('request.jwt.claims', '', true);

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
END $function$;