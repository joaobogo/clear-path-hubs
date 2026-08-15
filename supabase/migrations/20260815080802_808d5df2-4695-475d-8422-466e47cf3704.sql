
create or replace function public.public_position_employers(_ids uuid[])
returns table (position_id uuid, name text, logo_url text)
language sql
stable
security definer
set search_path = public
as $$
  SELECT p.id, 
    CASE 
      WHEN coalesce(p.intake_context->'posting'->>'confidentiality','') = 'confidential' THEN 'Confidential employer'
      ELSE coalesce(o.name, 'Hiring Organization')
    END as name,
    CASE 
      WHEN coalesce(p.intake_context->'posting'->>'confidentiality','') = 'confidential' THEN NULL
      ELSE o.logo_url
    END as logo_url
  FROM public.positions p
  LEFT JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = ANY(_ids)
    AND p.visibility = 'public'
    AND p.status IN ('active', 'paused');
$$;

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
    else jsonb_build_object('name', coalesce(o.name, 'Hiring Organization'), 'logo_url', o.logo_url)
  end
  from public.positions p
  left join public.organizations o on o.id = p.organization_id
  where p.id = _id
    and p.visibility = 'public'
    and p.status in ('active','paused');
$$;
