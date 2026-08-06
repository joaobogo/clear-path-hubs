-- ── Tenant-scope helpers for authoring tables ────────────────────────────────
CREATE OR REPLACE FUNCTION public.position_in_org(_position_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _position_id IS NULL OR EXISTS (
    SELECT 1 FROM public.positions p
     WHERE p.id = _position_id AND p.organization_id = _org
  )
$$;

CREATE OR REPLACE FUNCTION public.match_in_org(_match_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _match_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.candidate_matches m
     WHERE m.id = _match_id AND m.organization_id = _org
  )
$$;

CREATE OR REPLACE FUNCTION public.evidence_item_in_match(_item_id uuid, _match_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _item_id IS NULL OR EXISTS (
    SELECT 1 FROM public.candidate_evidence_items i
     WHERE i.id = _item_id
       AND i.candidate_match_id = _match_id
       AND i.organization_id = _org
  )
$$;

REVOKE EXECUTE ON FUNCTION public.position_in_org(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.match_in_org(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.evidence_item_in_match(uuid, uuid, uuid) FROM anon;

-- ── Tenant-scoped WITH CHECK on the authoring insert policies ────────────────
DROP POLICY IF EXISTS "org editors write rubric versions" ON public.rubric_versions;
CREATE POLICY "org editors write rubric versions"
ON public.rubric_versions
FOR INSERT
TO authenticated
WITH CHECK (
  (public.is_platform_staff(auth.uid()) OR public.is_org_editor(auth.uid(), organization_id))
  AND public.position_in_org(position_id, organization_id)
);

DROP POLICY IF EXISTS "org editors update rubric versions" ON public.rubric_versions;
CREATE POLICY "org editors update rubric versions"
ON public.rubric_versions
FOR UPDATE
TO authenticated
USING (public.is_platform_staff(auth.uid()) OR public.is_org_editor(auth.uid(), organization_id))
WITH CHECK (
  (public.is_platform_staff(auth.uid()) OR public.is_org_editor(auth.uid(), organization_id))
  AND public.position_in_org(position_id, organization_id)
);

DROP POLICY IF EXISTS "org staff insert evidence overrides" ON public.evidence_overrides;
CREATE POLICY "org staff insert evidence overrides"
ON public.evidence_overrides
FOR INSERT
TO authenticated
WITH CHECK (
  (public.is_platform_staff(auth.uid()) OR public.is_org_editor(auth.uid(), organization_id))
  AND actor_user_id = auth.uid()
  AND public.match_in_org(candidate_match_id, organization_id)
  AND public.evidence_item_in_match(evidence_item_id, candidate_match_id, organization_id)
);

REVOKE INSERT, UPDATE, DELETE ON public.rubric_versions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.evidence_overrides FROM anon;

-- ── Probe helper: does an insert survive RLS for this user? ──────────────────
CREATE OR REPLACE FUNCTION public._authz_probe_insert(_sql text, _user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  allowed boolean;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _user::text, 'role', 'authenticated')::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE _sql;
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    allowed := false;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN allowed;
END $$;

REVOKE EXECUTE ON FUNCTION public._authz_probe_insert(text, uuid) FROM anon, authenticated;

-- ── Authoring authorization tests ───────────────────────────────────────────
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

      INSERT INTO public.candidate_evidence (id, organization_id, candidate_match_id)
      VALUES (ev_a, org_a, match_a);

      INSERT INTO public.candidate_evidence_items
        (id, candidate_evidence_id, candidate_match_id, organization_id,
         rubric_dimension_key, rubric_criterion_key, match_type, confidence,
         source_passage, source_location, normalized_meaning, reviewer_status,
         engine_version, integrity_ok)
      VALUES (item_a, ev_a, match_a, org_a, 'skills', 'sql', 'exact', 0.9,
              'wrote sql daily', 'page 1', 'sql experience', 'accepted', 'test', true);

      -- rubric_versions: own org allowed
      allowed := public._authz_probe_insert(format(
        $q$INSERT INTO public.rubric_versions (organization_id, position_id, version_number, status, label)
           VALUES (%L, %L, 1, 'draft', 'own org')$q$, org_a, pos_a), u_a_edit);
      results := array_append(results, (CASE WHEN allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an editor can create a rubric version for their own organization');

      -- rubric_versions: other org rejected
      allowed := public._authz_probe_insert(format(
        $q$INSERT INTO public.rubric_versions (organization_id, position_id, version_number, status, label)
           VALUES (%L, %L, 1, 'draft', 'cross org')$q$, org_b, pos_b), u_a_edit);
      results := array_append(results, (CASE WHEN NOT allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an editor of org A cannot create a rubric version for org B');

      -- rubric_versions: own org label but another org's position rejected
      allowed := public._authz_probe_insert(format(
        $q$INSERT INTO public.rubric_versions (organization_id, position_id, version_number, status, label)
           VALUES (%L, %L, 2, 'draft', 'smuggled position')$q$, org_a, pos_b), u_a_edit);
      results := array_append(results, (CASE WHEN NOT allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - a rubric version cannot point at another organization''s role');

      -- evidence_overrides: own org allowed
      allowed := public._authz_probe_insert(format(
        $q$INSERT INTO public.evidence_overrides
             (organization_id, candidate_match_id, evidence_item_id, actor_user_id, reason)
           VALUES (%L, %L, %L, %L, 'own org correction')$q$,
        org_a, match_a, item_a, u_a_edit), u_a_edit);
      results := array_append(results, (CASE WHEN allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an editor can correct evidence in their own organization');

      -- evidence_overrides: other org rejected
      allowed := public._authz_probe_insert(format(
        $q$INSERT INTO public.evidence_overrides
             (organization_id, candidate_match_id, actor_user_id, reason)
           VALUES (%L, %L, %L, 'cross org correction')$q$,
        org_b, match_b, u_a_edit), u_a_edit);
      results := array_append(results, (CASE WHEN NOT allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an editor of org A cannot create an evidence override for org B');

      -- evidence_overrides: own org label but another org's match rejected
      allowed := public._authz_probe_insert(format(
        $q$INSERT INTO public.evidence_overrides
             (organization_id, candidate_match_id, actor_user_id, reason)
           VALUES (%L, %L, %L, 'smuggled match')$q$,
        org_a, match_b, u_a_edit), u_a_edit);
      results := array_append(results, (CASE WHEN NOT allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an evidence override cannot point at another organization''s candidate');

      -- evidence_overrides: evidence item must belong to the named match
      allowed := public._authz_probe_insert(format(
        $q$INSERT INTO public.evidence_overrides
             (organization_id, candidate_match_id, evidence_item_id, actor_user_id, reason)
           VALUES (%L, %L, %L, %L, 'mismatched item')$q$,
        org_b, match_b, item_a, u_b_edit), u_b_edit);
      results := array_append(results, (CASE WHEN NOT allowed THEN 'PASS' ELSE 'FAIL' END)
        || ' :: RLS - an evidence override cannot reference an evidence item from another candidate');

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

CREATE OR REPLACE FUNCTION public.run_all_authz_tests()
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.run_authz_tests()
  UNION ALL
  SELECT * FROM public.run_scoring_authz_tests()
$$;

REVOKE EXECUTE ON FUNCTION public.run_all_authz_tests() FROM anon, authenticated;