create table if not exists public.tracking_policy (
  id boolean primary key default true,
  essential_trackers text[] not null default '{}',
  require_prior_opt_in_everywhere boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint tracking_policy_singleton check (id)
);

grant select on public.tracking_policy to anon;
grant select, update on public.tracking_policy to authenticated;
grant all on public.tracking_policy to service_role;

alter table public.tracking_policy enable row level security;

drop policy if exists "tracking policy is publicly readable" on public.tracking_policy;
create policy "tracking policy is publicly readable"
  on public.tracking_policy for select
  to anon, authenticated
  using (true);

drop policy if exists "platform staff update tracking policy" on public.tracking_policy;
create policy "platform staff update tracking policy"
  on public.tracking_policy for update
  to authenticated
  using (public.is_platform_staff(auth.uid()))
  with check (public.is_platform_staff(auth.uid()));

insert into public.tracking_policy (id, essential_trackers, require_prior_opt_in_everywhere)
values (true, '{}', true)
on conflict (id) do nothing;