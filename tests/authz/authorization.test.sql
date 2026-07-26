-- ─────────────────────────────────────────────────────────────────────────────
-- TaaSFlow authorization test suite (database level).
--
-- Verifies the canonical role / permission / visibility model directly against
-- RLS policies and the membership guard trigger — the layer that actually
-- enforces access. UI and server-function checks are supplementary.
--
-- SAFETY: the entire suite runs inside a single transaction that always ends in
-- ROLLBACK. It creates only synthetic fixtures and never reads, updates or
-- deletes production rows. Run with:
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f tests/authz/authorization.test.sql
--
-- Every check raises an exception on failure, so a non-zero exit means a
-- regression in the authorization model.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

SET LOCAL client_min_messages = WARNING;

CREATE OR REPLACE FUNCTION pg_temp.check(_label text, _condition boolean)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF _condition THEN
    RAISE INFO 'PASS  %', _label;
  ELSE
    RAISE EXCEPTION 'FAIL  %', _label;
  END IF;
END $$;

-- Asserts that a statement is rejected (any error). Used for negative cases.
CREATE OR REPLACE FUNCTION pg_temp.check_rejected(_label text, _sql text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE _sql;
  EXCEPTION WHEN OTHERS THEN
    RAISE INFO 'PASS  % (rejected: %)', _label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL  % — statement was allowed but should have been rejected', _label;
END $$;

-- ─── Fixtures ───────────────────────────────────────────────────────────────
-- Two unrelated client organizations plus one platform staff user.

CREATE TEMP TABLE t_ids (k text primary key, v uuid);

INSERT INTO t_ids(k, v) VALUES
  ('org_a',        gen_random_uuid()),
  ('org_b',        gen_random_uuid()),
  ('u_staff',      gen_random_uuid()),
  ('u_a_owner',    gen_random_uuid()),
  ('u_a_recruiter',gen_random_uuid()),
  ('u_b_owner',    gen_random_uuid()),
  ('pos_a',        gen_random_uuid()),
  ('pos_b',        gen_random_uuid()),
  ('cand',         gen_random_uuid()),
  ('app_a',        gen_random_uuid()),
  ('app_b',        gen_random_uuid()),
  ('match_a',      gen_random_uuid()),
  ('match_b',      gen_random_uuid());

CREATE OR REPLACE FUNCTION pg_temp.id(_k text) RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT v FROM t_ids WHERE k = _k $$;

-- Auth users (required by memberships/profiles FKs).
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
SELECT v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       k || '.authztest@example.invalid', '', now(), now(), now()
FROM t_ids WHERE k LIKE 'u\_%';

INSERT INTO public.profiles (auth_user_id, email, full_name, status)
SELECT v, k || '.authztest@example.invalid', 'AuthZ Test ' || k, 'active'
FROM t_ids WHERE k LIKE 'u\_%';

INSERT INTO public.organizations (id, name, status, client_seat_limit)
VALUES (pg_temp.id('org_a'), 'AuthZ Test Org A', 'active', 3),
       (pg_temp.id('org_b'), 'AuthZ Test Org B', 'active', 3);

INSERT INTO public.memberships (user_id, organization_id, role, status) VALUES
  (pg_temp.id('u_staff'),       pg_temp.id('org_a'), 'platform_admin', 'active'),
  (pg_temp.id('u_a_owner'),     pg_temp.id('org_a'), 'client_admin',   'active'),
  (pg_temp.id('u_a_recruiter'), pg_temp.id('org_a'), 'client_viewer',  'active'),
  (pg_temp.id('u_b_owner'),     pg_temp.id('org_b'), 'client_admin',   'active');

-- ─── 1. Default permissions are derived from the role ───────────────────────

SELECT pg_temp.check(
  'client_admin seat receives the full permission set',
  (SELECT permissions @> ARRAY['view_candidates','manage_jobs','invite_members']::public.client_permission[]
     FROM public.memberships
    WHERE user_id = pg_temp.id('u_a_owner'))
);

SELECT pg_temp.check(
  'client_viewer seat cannot invite members or manage jobs',
  (SELECT NOT (permissions && ARRAY['invite_members','manage_jobs']::public.client_permission[])
     FROM public.memberships
    WHERE user_id = pg_temp.id('u_a_recruiter'))
);

SELECT pg_temp.check(
  'has_client_permission agrees with the stored seat permissions',
  public.has_client_permission(pg_temp.id('u_a_owner'), pg_temp.id('org_a'), 'manage_jobs')
  AND NOT public.has_client_permission(pg_temp.id('u_a_recruiter'), pg_temp.id('org_a'), 'manage_jobs')
);

-- ─── 2. Membership helpers are organization-scoped ──────────────────────────

SELECT pg_temp.check(
  'org A owner is a member of org A only',
  public.is_org_member(pg_temp.id('u_a_owner'), pg_temp.id('org_a'))
  AND NOT public.is_org_member(pg_temp.id('u_a_owner'), pg_temp.id('org_b'))
);

SELECT pg_temp.check(
  'org B owner has no permission inside org A',
  NOT public.has_client_permission(pg_temp.id('u_b_owner'), pg_temp.id('org_a'), 'view_candidates')
);

SELECT pg_temp.check(
  'platform staff is recognised, client owner is not',
  public.is_platform_staff(pg_temp.id('u_staff'))
  AND NOT public.is_platform_staff(pg_temp.id('u_a_owner'))
);

-- ─── 3. Seat cap: one owner seat plus three recruiter seats ─────────────────

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'seat' || g || '.authztest@example.invalid', '', now(), now(), now()
FROM generate_series(1, 4) g;

DO $$
DECLARE
  v_org uuid := (SELECT v FROM t_ids WHERE k = 'org_a');
  u uuid;
  n int := 0;
BEGIN
  -- org A already holds 1 owner + 1 viewer, so 2 more seats must fit and the
  -- 3rd additional seat must be rejected.
  FOR u IN SELECT id FROM auth.users WHERE email LIKE 'seat%.authztest@example.invalid' ORDER BY email LOOP
    n := n + 1;
    INSERT INTO public.profiles (auth_user_id, email, status)
      VALUES (u, 'seat' || n || '.authztest@example.invalid', 'active')
      ON CONFLICT (auth_user_id) DO NOTHING;
    BEGIN
      INSERT INTO public.memberships (user_id, organization_id, role, status)
      VALUES (u, v_org, 'client_viewer', 'active');
    EXCEPTION WHEN check_violation THEN
      IF n <= 2 THEN
        RAISE EXCEPTION 'FAIL  seat cap rejected seat % but the limit allows it', n;
      END IF;
      RAISE INFO 'PASS  seat cap rejected seat number % beyond the limit', n;
      RETURN;
    END;
  END LOOP;
  RAISE EXCEPTION 'FAIL  seat cap never triggered — organization exceeded its seat limit';
END $$;

-- ─── 4. Candidate visibility is scoped to candidate + job + client ──────────

INSERT INTO public.positions (id, organization_id, title, description, status, requirements)
VALUES
  (pg_temp.id('pos_a'), pg_temp.id('org_a'), 'AuthZ Test Role A',
   'A sufficiently long description for the approval completeness gate.',
   'active', '[{"label":"Test requirement"}]'::jsonb),
  (pg_temp.id('pos_b'), pg_temp.id('org_b'), 'AuthZ Test Role B',
   'A sufficiently long description for the approval completeness gate.',
   'active', '[{"label":"Test requirement"}]'::jsonb);

INSERT INTO public.candidate_profiles (id, full_name, email, status)
VALUES (pg_temp.id('cand'), 'AuthZ Test Candidate', 'candidate.authztest@example.invalid', 'active');

INSERT INTO public.applications (id, position_id, organization_id, candidate_profile_id, status)
VALUES
  (pg_temp.id('app_a'), pg_temp.id('pos_a'), pg_temp.id('org_a'), pg_temp.id('cand'), 'received'),
  (pg_temp.id('app_b'), pg_temp.id('pos_b'), pg_temp.id('org_b'), pg_temp.id('cand'), 'received');

INSERT INTO public.candidate_matches
  (id, organization_id, position_id, application_id, candidate_profile_id, client_visibility)
VALUES
  (pg_temp.id('match_a'), pg_temp.id('org_a'), pg_temp.id('pos_a'), pg_temp.id('app_a'), pg_temp.id('cand'), 'hidden'),
  (pg_temp.id('match_b'), pg_temp.id('org_b'), pg_temp.id('pos_b'), pg_temp.id('app_b'), pg_temp.id('cand'), 'hidden');

SELECT pg_temp.check(
  'unapproved candidate is invisible to the client owner',
  NOT public.is_match_client_visible(pg_temp.id('u_a_owner'), pg_temp.id('match_a'))
);

SELECT pg_temp.check(
  'unapproved candidate is invisible to a recruiter seat',
  NOT public.is_match_client_visible(pg_temp.id('u_a_recruiter'), pg_temp.id('match_a'))
);

-- Approve for org A only (bypassing the publish gate is not possible; the gate
-- requires an approved score run, so this test asserts the gate itself fires).
SELECT pg_temp.check_rejected(
  'cannot mark a candidate visible without an approved score run',
  format('UPDATE public.candidate_matches SET client_visibility = ''visible'' WHERE id = %L',
         pg_temp.id('match_a'))
);

SELECT pg_temp.check(
  'candidate remains invisible after the rejected approval attempt',
  NOT public.is_match_client_visible(pg_temp.id('u_a_owner'), pg_temp.id('match_a'))
);

SELECT pg_temp.check(
  'approval in one organization never reveals the candidate in another',
  NOT public.is_match_client_visible(pg_temp.id('u_b_owner'), pg_temp.id('match_a'))
  AND NOT public.is_match_client_visible(pg_temp.id('u_a_owner'), pg_temp.id('match_b'))
);

-- ─── 5. Contact release is a separate permission from visibility ────────────

SELECT pg_temp.check(
  'contact details are not released by default',
  NOT public.is_match_contact_released(pg_temp.id('u_a_owner'), pg_temp.id('match_a'))
);

UPDATE public.candidate_matches
   SET contact_released_at = now(), contact_released_by = pg_temp.id('u_staff')
 WHERE id = pg_temp.id('match_a');

SELECT pg_temp.check(
  'contact release alone does not make a hidden candidate visible',
  NOT public.is_match_client_visible(pg_temp.id('u_a_owner'), pg_temp.id('match_a'))
);

SELECT pg_temp.check(
  'contact release does not leak across organizations',
  NOT public.is_match_contact_released(pg_temp.id('u_b_owner'), pg_temp.id('match_a'))
);

-- ─── 6. RLS blocks direct cross-tenant reads for a signed-in client user ────

SET LOCAL ROLE authenticated;

-- Impersonate org B's owner and attempt to read org A data directly.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', (SELECT v FROM t_ids WHERE k = 'u_b_owner'), 'role', 'authenticated')::text,
  true);

SELECT pg_temp.check(
  'client user cannot read another organization''s positions',
  (SELECT count(*) FROM public.positions WHERE id = pg_temp.id('pos_a')) = 0
);

SELECT pg_temp.check(
  'client user cannot read another organization''s candidate matches',
  (SELECT count(*) FROM public.candidate_matches WHERE id = pg_temp.id('match_a')) = 0
);

-- Impersonate org A's own owner: the unapproved candidate must still be hidden.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', (SELECT v FROM t_ids WHERE k = 'u_a_owner'), 'role', 'authenticated')::text,
  true);

SELECT pg_temp.check(
  'client owner cannot read an unapproved candidate in their own organization',
  (SELECT count(*) FROM public.candidate_matches WHERE id = pg_temp.id('match_a')) = 0
);

SELECT pg_temp.check(
  'client owner cannot read the unapproved candidate profile',
  (SELECT count(*) FROM public.candidate_profiles WHERE id = pg_temp.id('cand')) = 0
);

-- ─── 7. Privilege escalation is impossible from a client seat ───────────────

SELECT pg_temp.check_rejected(
  'client owner cannot promote themselves to platform_admin',
  format('UPDATE public.memberships SET role = ''platform_admin'' WHERE user_id = %L',
         pg_temp.id('u_a_owner'))
);

SELECT pg_temp.check_rejected(
  'client owner cannot widen their own seat permissions',
  format($q$UPDATE public.memberships
              SET permissions = ARRAY['view_candidates','manage_jobs','invite_members']::public.client_permission[]
            WHERE user_id = %L$q$, pg_temp.id('u_a_owner'))
);

SELECT pg_temp.check_rejected(
  'client owner cannot grant a platform role to somebody else',
  format('UPDATE public.memberships SET role = ''operations'' WHERE user_id = %L',
         pg_temp.id('u_a_recruiter'))
);

SELECT pg_temp.check_rejected(
  'client owner cannot approve a candidate for client view',
  format('UPDATE public.candidate_matches SET client_visibility = ''visible'' WHERE id = %L',
         pg_temp.id('match_a'))
);

SELECT pg_temp.check_rejected(
  'client owner cannot release candidate contact details',
  format('UPDATE public.candidate_matches SET contact_released_at = now() WHERE id = %L',
         pg_temp.id('match_b'))
);

RESET ROLE;

-- ─── 8. Anonymous visitors see nothing private ──────────────────────────────

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', NULL, true);

SELECT pg_temp.check(
  'anonymous visitor cannot read candidate matches',
  (SELECT count(*) FROM public.candidate_matches) = 0
);

SELECT pg_temp.check(
  'anonymous visitor cannot read candidate profiles',
  (SELECT count(*) FROM public.candidate_profiles) = 0
);

SELECT pg_temp.check(
  'anonymous visitor cannot read memberships',
  (SELECT count(*) FROM public.memberships) = 0
);

RESET ROLE;

DO $$ BEGIN RAISE INFO 'ALL AUTHORIZATION CHECKS PASSED'; END $$;

-- Never persist fixtures.
ROLLBACK;
