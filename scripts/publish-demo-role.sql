-- ============================================================
-- DO NOT RUN. Superseded 18 Sep 2026.
--
-- This script put the Northwind demo role on the public job board as a real,
-- applyable posting, and stripped "(Demo)" from the organisation name so
-- candidates could not tell. That is the exact exposure audit 17 Sep item 5
-- reported: real people applying into a demo workspace, where nobody would
-- ever answer them.
--
-- The public board gate now excludes demo, QA and internal organisations
-- (supabase/migrations/20260918090000_public_board_excludes_demo_orgs.sql), so
-- this script can no longer achieve what it says. Its own verification column
-- (`will_appear_on_job_board`) hardcodes the pre-fix rule and would report TRUE
-- for a role that will not appear.
--
-- Kept for history. If a demo role is ever wanted on the board again, that is a
-- change to the gate, not a rename of an org.
-- ============================================================

-- Put the demo role on the public job board as a real, applyable posting.
--
-- Run in the Supabase SQL editor. Idempotent: safe to run more than once.
--
-- WHAT THE BOARD REQUIRES
-- listPublicPositions filters on status='active', visibility='public' and
-- is_test_record false/null, then runs each row through evaluatePublishGate,
-- which additionally wants: a title, a description of at least 80 characters,
-- employment_type, work_model, seniority, a location unless the role is remote,
-- a non-empty requirements array, and either approved_at or published_at set.
-- Payments are off (PAYMENTS_ENABLED = false), so the payment gate passes on
-- its own and payment_status is left alone.
--
-- The public apply handler checks the same status/visibility plus a description
-- over 40 characters and non-empty requirements, so a row that lists is a row
-- that can be applied to.
--
-- WHY THE ORGANISATION IS RENAMED
-- The public job detail page renders organization_name as the employer, so
-- "Northwind Talent (Demo)" would appear to candidates. The is_demo FLAG is
-- what marks this workspace as non-production — the seeder refuses to run
-- unless is_demo is true, and staff rollups exclude the org by that flag, not
-- by its name. Dropping the suffix therefore changes nothing except what a
-- visitor reads.

BEGIN;

-- 1. Employer name a candidate can read without seeing the word Demo.
--    is_demo stays TRUE: it is what keeps this workspace out of staff metrics.
UPDATE public.organizations
SET name = 'Northwind Talent'
WHERE id = '0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
  AND is_demo IS TRUE;

-- 2. The role itself.
UPDATE public.positions
SET
  status            = 'active',
  visibility        = 'public',
  is_test_record    = false,
  employment_type   = COALESCE(NULLIF(employment_type, ''), 'full_time'),
  work_model        = COALESCE(NULLIF(work_model, ''), 'hybrid'),
  seniority         = COALESCE(NULLIF(seniority, ''), 'senior'),
  location          = COALESCE(NULLIF(location, ''), 'Lisbon, Portugal'),
  approved_at       = COALESCE(approved_at, now()),
  published_at      = COALESCE(published_at, now()),
  updated_at        = now()
WHERE id = 'ee6d2a82-6122-4026-95e4-45a7821b7b7d';

-- 3. A description that reads like a real posting. Replaced only if the
--    existing one is too short for the gate, so a description you have already
--    written by hand is left intact.
UPDATE public.positions
SET description = $desc$
Northwind Talent is hiring a Senior Full-Stack Engineer to own product features end to end, from the data model through to the screen a customer uses.

You will work on a multi-tenant platform used daily by finance and operations teams. The work is genuinely full-stack: designing Postgres schemas and writing the migrations, building the React and TypeScript interfaces on top of them, and keeping both honest with automated tests. Tenant isolation matters here — every workspace must only ever see its own data — so you will work with row-level security and the tests that prove it holds.

We are a small team, so you will have real ownership of what you ship and a direct line to the people using it.

What the role involves
- Owning features from schema design through to the shipped interface
- Designing and evolving Postgres data models, and shipping the migrations
- Building and maintaining React and TypeScript applications in production
- Writing and maintaining automated tests, unit and end-to-end
- Working with row-level security to keep multi-tenant data isolated

What we are looking for
- Several years building production React and TypeScript applications
- Strong SQL and relational data modelling in Postgres
- Practical experience with row-level security or another multi-tenant isolation model
- Comfortable writing and maintaining automated tests
- Fluent English, written and spoken

Nice to have
- Multi-tenant SaaS with per-tenant data isolation
- Experience in an early-stage, founder-led team
- Exposure to AI or large language model features in production
- Experience with Remix, the full-stack React framework

Hybrid from Lisbon, two days a week in the office.
$desc$
WHERE id = 'ee6d2a82-6122-4026-95e4-45a7821b7b7d'
  AND (description IS NULL OR length(trim(description)) < 400);

COMMIT;

-- VERIFY — every condition the board and the apply handler check.
SELECT
  p.title,
  o.name                                        AS employer,
  p.status,
  p.visibility,
  COALESCE(p.is_test_record, false)             AS is_test_record,
  length(trim(p.description))                   AS description_chars,
  p.employment_type,
  p.work_model,
  p.seniority,
  p.location,
  jsonb_array_length(COALESCE(p.requirements, '[]'::jsonb)) AS requirement_count,
  (p.approved_at IS NOT NULL OR p.published_at IS NOT NULL)  AS approved_or_published,
  -- The whole gate in one column.
  (
    p.status = 'active'
    AND p.visibility = 'public'
    AND COALESCE(p.is_test_record, false) = false
    AND length(trim(p.description)) >= 80
    AND p.employment_type IS NOT NULL
    AND p.work_model IS NOT NULL
    AND COALESCE(trim(p.seniority), '') <> ''
    AND (p.work_model = 'remote' OR COALESCE(trim(p.location), '') <> '')
    AND jsonb_array_length(COALESCE(p.requirements, '[]'::jsonb)) > 0
    AND (p.approved_at IS NOT NULL OR p.published_at IS NOT NULL)
  ) AS will_appear_on_job_board,
  -- Anything a candidate could read that gives the game away.
  (o.name ILIKE '%demo%' OR o.name ILIKE '%test%'
   OR p.title ILIKE '%demo%' OR p.title ILIKE '%test%'
   OR p.description ILIKE '%demo%' OR p.description ILIKE '%test record%') AS leaks_demo_wording
FROM public.positions p
JOIN public.organizations o ON o.id = p.organization_id
WHERE p.id = 'ee6d2a82-6122-4026-95e4-45a7821b7b7d';
