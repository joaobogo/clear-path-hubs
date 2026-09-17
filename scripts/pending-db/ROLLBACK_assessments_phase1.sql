-- ============================================================
-- ROLLBACK — psychometric assessments, Phase 1.
--
-- RUN THIS ONLY IF the assessments migration was already applied
-- to production. If you never ran it, the tables do not exist and
-- you do not need this file at all.
--
-- HOW TO TELL, before running anything:
--
--   select table_name
--     from information_schema.tables
--    where table_schema = 'public'
--      and table_name like 'assessment%';
--
--   -- zero rows  -> never applied, nothing to do, delete this file
--   -- five rows  -> applied, run the rest of this script
--
-- The feature never shipped a user interface, no endpoint ever
-- wrote to these tables, and the flag was false for every
-- organisation, so these tables are expected to be EMPTY. Check
-- before dropping anyway — the counts should all be 0:
--
--   select
--     (select count(*) from public.assessment_definitions) as definitions,
--     (select count(*) from public.assessment_invitations) as invitations,
--     (select count(*) from public.assessment_results)     as results,
--     (select count(*) from public.assessment_consent)     as consent,
--     (select count(*) from public.assessment_audit)       as audit;
--
-- If any count is NOT zero, stop and ask before running the drops.
--
-- Safe to re-run. Touches nothing outside these five tables and the
-- one column; no other table, policy, function or grant is affected.
-- ============================================================

-- ─── The tables ──────────────────────────────────────────────────────────────
-- Dropped child-first so the foreign keys unwind in order. `cascade` also
-- removes the policies, indexes and grants that belong to each table, which is
-- everything the migration created against them.

drop table if exists public.assessment_consent     cascade;
drop table if exists public.assessment_results     cascade;
drop table if exists public.assessment_invitations cascade;
drop table if exists public.assessment_definitions cascade;
drop table if exists public.assessment_audit       cascade;

-- ─── The per-organisation switch ─────────────────────────────────────────────
-- Nothing in the application ever read this column: it was never added to the
-- generated Supabase types, so no query could select it. Dropping it cannot
-- change any existing behaviour.

alter table public.organizations
  drop column if exists assessments_enabled;

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- Both of these should return zero rows.
--
--   select table_name from information_schema.tables
--    where table_schema = 'public' and table_name like 'assessment%';
--
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'organizations'
--      and column_name = 'assessments_enabled';
