-- ---------------------------------------------------------------------------
-- Demo workspace cleanup: remove the QA fixtures that leaked into the demo.
--
--   "[QA] Senior Accountant (delete me)"
--   "AUDIT-DELETE-ME"
--
-- Run in the Supabase SQL editor (service role) against the PRODUCTION
-- project. The script is in three parts: REPORT, DELETE, VERIFY. Run the
-- REPORT first and read it; the DELETE only touches rows the REPORT lists.
--
-- Deletion goes through the same `hard_delete_position` /
-- `hard_delete_candidate_match` routines the admin "Delete role" button uses,
-- so every dependent row (matches, applications, score runs, evidence,
-- interviews, tasks, notifications, memory, stage history, hire records,
-- shares) goes with the position, and every count, report and board that is
-- derived from those tables reflects the removal immediately. Nothing else
-- in the demo workspace is touched.
-- ---------------------------------------------------------------------------

-- ===== 1. REPORT ============================================================
-- Where do the two strings appear?
with needles as (
  select unnest(array['%Senior Accountant (delete me)%', '%AUDIT-DELETE-ME%', '%[QA]%delete me%']) as pat
)
select 'position' as kind, p.id, p.title as label, p.organization_id, p.status::text as status, p.created_at
  from public.positions p join needles n on p.title ilike n.pat
union
select 'organization', o.id, o.name, o.id, null, o.created_at
  from public.organizations o join needles n on o.name ilike n.pat
union
select 'candidate_profile', c.id, c.full_name, null, null, c.created_at
  from public.candidate_profiles c join needles n on (c.full_name ilike n.pat or c.email ilike n.pat)
union
select 'intake_submission', i.id, i.role_title || ' @ ' || i.company_name, null, null, i.created_at
  from public.intake_submissions i join needles n on (i.role_title ilike n.pat or i.company_name ilike n.pat)
union
select 'task', t.id, t.title, t.organization_id, null, t.created_at
  from public.tasks t join needles n on t.title ilike n.pat
order by kind, created_at;

-- ===== 2. DELETE ============================================================
-- Positions (and everything attached to them) through the staff routine.
do $$
declare
  actor uuid;
  r record;
  n int := 0;
begin
  -- Any active platform admin is a valid actor for the audit trail.
  select user_id into actor
    from public.memberships
   where status = 'active' and role = 'platform_admin'
   order by created_at
   limit 1;
  if actor is null then
    raise exception 'no active platform_admin membership found; pick an actor id by hand';
  end if;

  for r in
    select id, title
      from public.positions
     where title ilike '%Senior Accountant (delete me)%'
        or title ilike '%AUDIT-DELETE-ME%'
        or title ilike '%[QA]%delete me%'
  loop
    perform public.hard_delete_position(r.id, actor, 'demo cleanup: QA fixture');
    n := n + 1;
    raise notice 'deleted position % (%)', r.title, r.id;
  end loop;

  -- Candidate profiles carrying the marker: every match first, then the
  -- profile itself once nothing points at it.
  for r in
    select c.id, c.full_name
      from public.candidate_profiles c
     where c.full_name ilike '%AUDIT-DELETE-ME%'
        or c.full_name ilike '%[QA]%delete me%'
        or c.email ilike '%audit-delete-me%'
  loop
    perform public.hard_delete_candidate_match(m.id, actor, 'demo cleanup: QA fixture')
       from public.candidate_matches m
      where m.candidate_profile_id = r.id;
    delete from public.applications where candidate_profile_id = r.id;
    delete from public.candidate_profiles where id = r.id;
    n := n + 1;
    raise notice 'deleted candidate profile % (%)', r.full_name, r.id;
  end loop;

  -- Loose rows that only carry the text.
  delete from public.tasks
   where title ilike '%AUDIT-DELETE-ME%' or title ilike '%[QA]%delete me%';
  delete from public.notifications
   where title ilike '%AUDIT-DELETE-ME%' or body ilike '%AUDIT-DELETE-ME%'
      or title ilike '%[QA]%delete me%' or body ilike '%[QA]%delete me%';
  delete from public.intake_submissions
   where role_title ilike '%AUDIT-DELETE-ME%' or company_name ilike '%AUDIT-DELETE-ME%'
      or role_title ilike '%[QA]%delete me%';

  -- An organisation named with the marker, only when it is now empty.
  for r in
    select o.id, o.name
      from public.organizations o
     where (o.name ilike '%AUDIT-DELETE-ME%' or o.name ilike '%[QA]%delete me%')
       and not exists (select 1 from public.positions p where p.organization_id = o.id)
       and not exists (select 1 from public.candidate_matches m where m.organization_id = o.id)
  loop
    delete from public.memberships where organization_id = r.id;
    delete from public.organizations where id = r.id;
    n := n + 1;
    raise notice 'deleted empty organization % (%)', r.name, r.id;
  end loop;

  raise notice 'demo cleanup: % record(s) removed', n;
end $$;

-- ===== 3. VERIFY ============================================================
-- Re-run the REPORT query above: it must return no rows. Then open the demo
-- workspace: Roles, Candidates (list and board), Insights and the admin
-- Positions list no longer show either record, and the role counts drop by
-- the number of positions removed.
