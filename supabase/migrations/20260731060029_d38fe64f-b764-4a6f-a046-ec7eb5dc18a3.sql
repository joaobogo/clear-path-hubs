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
$$;

grant execute on function public.public_position_closure(uuid) to anon, authenticated, service_role;