create or replace function public.public_position_employer(_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(p.intake_context->'posting'->>'confidentiality','') = 'confidential'
      then jsonb_build_object('name', 'Confidential employer', 'logo_url', null)
    else jsonb_build_object('name', coalesce(o.name, 'TaaSFlow client'), 'logo_url', o.logo_url)
  end
  from public.positions p
  left join public.organizations o on o.id = p.organization_id
  where p.id = _id
    and p.visibility = 'public'
    and p.status in ('active','paused')
$$;

grant execute on function public.public_position_employer(uuid) to anon, authenticated, service_role;