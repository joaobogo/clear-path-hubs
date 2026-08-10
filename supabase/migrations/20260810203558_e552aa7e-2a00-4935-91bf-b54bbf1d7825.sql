CREATE OR REPLACE FUNCTION public.run_collaborator_role_tests()
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
      u_admin uuid := gen_random_uuid();
      u_editor uuid := gen_random_uuid();
      u_viewer uuid := gen_random_uuid();
      u_b_editor uuid := gen_random_uuid();
      pos_a uuid := gen_random_uuid();
      pos_draft uuid := gen_random_uuid();
      pos_b uuid := gen_random_uuid();
      cand uuid := gen_random_uuid();
      app_a uuid := gen_random_uuid();
      app_b uuid := gen_random_uuid();
      match_a uuid := gen_random_uuid();
      match_b uuid := gen_random_uuid();
      n bigint;
      ok boolean;
    BEGIN
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                              email_confirmed_at, created_at, updated_at)
      SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             x::text || '@collab.test.invalid', '', now(), now(), now()
      FROM unnest(ARRAY[u_staff, u_admin, u_editor, u_viewer, u_b_editor]) x;

      INSERT INTO public.profiles (auth_user_id, email, full_name, status)
      SELECT x, x::text || '@collab.test.invalid', 'Collab fixture', 'active'
      FROM unnest(ARRAY[u_staff, u_admin, u_editor, u_viewer, u_b_editor]) x;

      INSERT INTO public.organizations (id, name, client_seat_limit)
      VALUES (org_a, 'Collab Fixture A', 3), (org_b, 'Collab Fixture B', 3);

      INSERT INTO public.memberships (user_id, organization_id, role, status)
      VALUES (u_staff, org_a, 'platform_admin', 'active'),
             (u_admin, org_a, 'client_admin', 'active');

      -- ---- Invitation path: an admin invites an editor and a viewer -------------
      ok := public._authz_probe_insert_allowed('memberships', u_admin,
        format('%L::uuid AS user_id, %L::uuid AS organization_id, %L::public.membership_role AS role, %L::public.membership_status AS status',
               u_editor, org_a, 'client_editor', 'invited'));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: an admin may invite a client_editor to their own workspace');

      ok := public._authz_probe_insert_allowed('memberships', u_admin,
        format('%L::uuid AS user_id, %L::uuid AS organization_id, %L::public.membership_role AS role, %L::public.membership_status AS status',
               u_viewer, org_a, 'client_viewer', 'invited'));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: an admin may invite a client_viewer to their own workspace');

      ok := NOT public._authz_probe_insert_allowed('memberships', u_admin,
        format('%L::uuid AS user_id, %L::uuid AS organization_id, %L::public.membership_role AS role, %L::public.membership_status AS status',
               u_editor, org_a, 'client_admin', 'invited'));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: an invitation cannot grant client_admin');

      ok := NOT public._authz_probe_insert_allowed('memberships', u_admin,
        format('%L::uuid AS user_id, %L::uuid AS organization_id, %L::public.membership_role AS role, %L::public.membership_status AS status',
               u_editor, org_b, 'client_editor', 'invited'));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: an admin cannot invite into another organization');

      INSERT INTO public.memberships (user_id, organization_id, role, status)
      VALUES (u_editor, org_a, 'client_editor', 'active'),
             (u_viewer, org_a, 'client_viewer', 'active'),
             (u_b_editor, org_b, 'client_editor', 'active');

      -- ---- Seat permissions ----------------------------------------------------
      ok := public.has_client_permission(u_editor, org_a, 'manage_jobs')
        AND NOT public.has_client_permission(u_viewer, org_a, 'manage_jobs');
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: only the editor seat carries manage_jobs');

      ok := NOT public.has_client_permission(u_editor, org_a, 'invite_members')
        AND NOT public.has_client_permission(u_viewer, org_a, 'invite_members');
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: neither editor nor viewer can invite members');

      ok := public.is_org_editor(u_editor, org_a) AND NOT public.is_org_editor(u_viewer, org_a);
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: is_org_editor separates the editor from the viewer');

      ok := public.is_org_member(u_viewer, org_a) AND NOT public.is_org_member(u_viewer, org_b)
        AND NOT public.is_org_editor(u_b_editor, org_a);
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: seats never carry into another organization');

      -- ---- Fixtures ------------------------------------------------------------
      INSERT INTO public.positions (id, organization_id, title, description, status,
                                    requirements, visibility, payment_status)
      VALUES (pos_a, org_a, 'Collab Fixture Role A',
              'Description long enough to satisfy the approval completeness gate.',
              'active', '[{"label":"req"}]'::jsonb, 'private', 'exempt'),
             (pos_draft, org_a, 'Collab Fixture Draft Role',
              'Description long enough to satisfy the approval completeness gate.',
              'draft', '[{"label":"req"}]'::jsonb, 'private', 'exempt'),
             (pos_b, org_b, 'Collab Fixture Role B',
              'Description long enough to satisfy the approval completeness gate.',
              'active', '[{"label":"req"}]'::jsonb, 'private', 'exempt');

      INSERT INTO public.candidate_profiles (id, full_name, email)
      VALUES (cand, 'Collab Fixture Candidate', cand::text || '@collab.test.invalid');

      INSERT INTO public.applications (id, position_id, candidate_profile_id)
      VALUES (app_a, pos_a, cand), (app_b, pos_b, cand);

      INSERT INTO public.candidate_matches
        (id, organization_id, position_id, application_id, candidate_profile_id, client_visibility)
      VALUES (match_a, org_a, pos_a, app_a, cand, 'hidden'),
             (match_b, org_b, pos_b, app_b, cand, 'hidden');

      -- ---- Roles: create and edit ---------------------------------------------
      ok := public._authz_probe_insert_allowed('positions', u_editor,
        format('%L::uuid AS organization_id, %L AS title', org_a, 'Editor created role'));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the editor may create a role in their workspace');

      ok := NOT public._authz_probe_insert_allowed('positions', u_viewer,
        format('%L::uuid AS organization_id, %L AS title', org_a, 'Viewer created role'));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the viewer cannot create a role');

      ok := NOT public._authz_probe_insert_allowed('positions', u_b_editor,
        format('%L::uuid AS organization_id, %L AS title', org_a, 'Cross org role'));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: an editor of org B cannot create a role inside org A');

      n := public._authz_probe_update_count('positions', u_editor, format('t.id = %L', pos_draft));
      results := array_append(results, (CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the editor may edit a role brief that is still open (draft)');

      n := public._authz_probe_update_count('positions', u_viewer, format('t.id = %L', pos_draft));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the viewer cannot edit a role brief');

      n := public._authz_probe_update_count('positions', u_editor, format('t.id = %L', pos_a));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: a live role is not client-editable directly (staff-mediated by design)');

      n := public._authz_probe_update_count('positions', u_b_editor, format('t.id = %L', pos_draft));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: an editor of org B cannot edit an org A role');

      -- ---- Candidate decisions -------------------------------------------------
      ok := public._authz_probe_insert_allowed('client_decisions', u_editor,
        format('%L::uuid AS organization_id, %L::uuid AS candidate_match_id', org_a, match_a));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the editor may record a candidate decision');

      ok := NOT public._authz_probe_insert_allowed('client_decisions', u_viewer,
        format('%L::uuid AS organization_id, %L::uuid AS candidate_match_id', org_a, match_a));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the viewer cannot record a candidate decision');

      ok := NOT public._authz_probe_insert_allowed('client_decisions', u_b_editor,
        format('%L::uuid AS organization_id, %L::uuid AS candidate_match_id', org_a, match_a));
      results := array_append(results, (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END)
        || ' :: an editor of org B cannot decide on an org A candidate');

      -- ---- Reading another organization ---------------------------------------
      n := public._authz_probe_visible('positions', u_viewer, format('t.id = %L', pos_b));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the viewer cannot read another organization''s role');

      n := public._authz_probe_visible('positions', u_editor, format('t.id = %L', pos_b));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the editor cannot read another organization''s role');

      n := public._authz_probe_visible('positions', u_editor, format('t.id = %L', pos_a));
      results := array_append(results, (CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the editor can still read their own workspace role');

      n := public._authz_probe_visible('positions', u_viewer, format('t.id = %L', pos_a));
      results := array_append(results, (CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the viewer can still read their own workspace role');

      n := public._authz_probe_visible('candidate_matches', u_editor, format('t.id = %L', match_b));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the editor cannot read another organization''s candidate');

      n := public._authz_probe_visible('candidate_matches', u_viewer, format('t.id = %L', match_b));
      results := array_append(results, (CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the viewer cannot read another organization''s candidate');

      n := public._authz_probe_visible('memberships', u_editor,
        format('t.organization_id = %L', org_a));
      results := array_append(results, (CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the editor sees only their own seat, not the roster');

      n := public._authz_probe_visible('memberships', u_viewer,
        format('t.organization_id = %L', org_a));
      results := array_append(results, (CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END)
        || ' :: the viewer sees only their own seat, not the roster');

      RAISE EXCEPTION 'collab_test_rollback';
    END;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'collab_test_rollback' THEN
      RAISE;
    END IF;
  END;

  FOREACH r IN ARRAY results LOOP
    RETURN NEXT r;
  END LOOP;
  RETURN NEXT CASE
    WHEN EXISTS (SELECT 1 FROM unnest(results) x WHERE x LIKE 'FAIL%')
      THEN 'RESULT :: FAILURES DETECTED'
    ELSE 'RESULT :: ALL COLLABORATOR ROLE CHECKS PASSED'
  END;
END $function$;

REVOKE ALL ON FUNCTION public.run_collaborator_role_tests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_collaborator_role_tests() TO service_role;

DELETE FROM public.authz_test_reports WHERE suite = 'collaborator_roles';
INSERT INTO public.authz_test_reports (suite, ordinal, line)
SELECT 'collaborator_roles', row_number() OVER (), t
FROM public.run_collaborator_role_tests() t;