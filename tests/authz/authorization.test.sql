-- ─────────────────────────────────────────────────────────────────────────────
-- TaaSFlow authorization test suite (database level).
--
-- Verifies the canonical role / permission / visibility model directly against
-- RLS helpers, the membership guard trigger and the publish gate — the layer
-- that actually enforces access. UI and server-function checks are
-- supplementary and are covered separately in src/lib/authz.test.ts.
--
-- SAFETY: all fixtures are created and destroyed inside `run_authz_tests()`,
-- which always ends by raising a sentinel exception to unwind its
-- subtransaction. No production row is ever created, read into results,
-- modified or deleted. Verified empty after every run.
--
-- Run:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f tests/authz/authorization.test.sql
--
-- Coverage:
--   1. Default seat permissions are derived from the role.
--   2. Membership and permission helpers are organization-scoped.
--   3. The recruiter seat cap (owner + 3) is enforced on every write path.
--   4. An unapproved candidate is invisible to every client seat.
--   5. A candidate cannot be published without an approved score run.
--   6. Approval never crosses an organization or job boundary.
--   7. Contact release is withheld by default, is separate from visibility,
--      and does not leak across organizations.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

SELECT * FROM public.run_authz_tests();

-- Fail the run if any individual check reported FAIL.
DO $$
DECLARE failures int;
BEGIN
  SELECT count(*) INTO failures
    FROM public.run_authz_tests() t
   WHERE t LIKE 'FAIL%';
  IF failures > 0 THEN
    RAISE EXCEPTION 'authorization test suite: % check(s) failed', failures;
  END IF;
  RAISE INFO 'authorization test suite: all checks passed';
END $$;

-- Residue guard — the suite must never persist a fixture.
DO $$
DECLARE residue int;
BEGIN
  SELECT (SELECT count(*) FROM public.organizations WHERE name LIKE 'AuthZ Fixture%')
       + (SELECT count(*) FROM public.profiles WHERE email LIKE '%@authz.test.invalid')
       + (SELECT count(*) FROM public.candidate_profiles WHERE email LIKE '%@authz.test.invalid')
       + (SELECT count(*) FROM public.positions WHERE title LIKE 'AuthZ Fixture%')
    INTO residue;
  IF residue > 0 THEN
    RAISE EXCEPTION 'authorization test suite left % fixture row(s) behind', residue;
  END IF;
  RAISE INFO 'authorization test suite: no fixture residue';
END $$;
