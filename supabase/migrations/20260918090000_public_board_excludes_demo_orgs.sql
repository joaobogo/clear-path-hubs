-- The public job board keeps the promise its own gate already makes.
--
-- `public_publishable_position_ids` opens with this comment:
--
--   "Public board gate: a role whose owning organization is a test/QA/demo
--    fixture may never be publicly listed or read"
--
-- and then checks only `is_test_record` and `test_run_id`. Demo and QA and
-- internal orgs were never in the WHERE clause, so the stated rule was not the
-- implemented one.
--
-- That gap is load-bearing rather than theoretical, because a separate
-- migration deliberately forces demo organisations to is_test_record = false
-- (20260818214306), and another forces every position inside a demo org to
-- is_test_record = false (20260819235242). A demo workspace could therefore
-- never trip either of the two conditions that were checked.
--
-- The visible consequence: "Senior Full-Stack Engineer — Northwind Talent", a
-- demo tenant's role, was listed on /jobs beside a real one and accepting real
-- applications from real candidates, who would never hear back (audit 17 Sep,
-- item 5).
--
-- Both public readers are corrected here. The second one matters on its own:
-- `public_position_closure` gates on nothing but visibility and status, so a
-- closed demo role was readable even with the listing fixed, and it renders the
-- employer through the name-stripping helper — which launders "(Demo)" out of
-- the organisation name on the way to the page.
--
-- Additive and reversible: no data is written, no row is deleted, and the two
-- function bodies are otherwise their originals.

-- ─── Which roles the public board may list ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.public_publishable_position_ids(_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.positions p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = ANY(_ids)
    AND COALESCE(p.is_test_record, false) = false
    AND COALESCE(o.is_test_record, false) = false
    AND o.test_run_id IS NULL
    -- The three the comment always claimed. `is_internal` is not redundant
    -- with the others: the TaaSFlow Platform org carries is_internal = true
    -- and is_test_record = false.
    AND COALESCE(o.is_demo, false) = false
    AND COALESCE(o.is_qa, false) = false
    AND COALESCE(o.is_internal, false) = false
$$;

GRANT EXECUTE ON FUNCTION public.public_publishable_position_ids(uuid[]) TO anon, authenticated, service_role;

-- ─── What a closed public role still reveals ─────────────────────────────────
-- Same predicate, so a demo role cannot be reached through the closed-role
-- page once it is off the board. The LEFT JOIN is kept: a position with no
-- organisation row is not a demo role, and COALESCE lets it through as before.
create or replace function public.public_position_closure(_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'status', p.status::text,
    'organization_name',
      case when coalesce(p.intake_context->'posting'->>'confidentiality','') = 'confidential'
        then 'Confidential employer' else coalesce(o.name, 'TaaSFlow client') end
  )
  from public.positions p
  left join public.organizations o on o.id = p.organization_id
  where p.id = _id
    and p.visibility = 'public'
    and p.status in ('paused','filled','closed','archived')
    and coalesce(o.is_test_record, false) = false
    and o.test_run_id is null
    and coalesce(o.is_demo, false) = false
    and coalesce(o.is_qa, false) = false
    and coalesce(o.is_internal, false) = false
$$;

grant execute on function public.public_position_closure(uuid) to anon, authenticated, service_role;
