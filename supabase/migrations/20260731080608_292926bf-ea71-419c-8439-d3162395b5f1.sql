-- Part 4: pay now, or book a call. Both doors land in the workspace.

create table if not exists public.sales_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  position_id uuid references public.positions(id) on delete set null,
  intake_submission_id uuid references public.intake_submissions(id) on delete set null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'booked',
  ics_uid text not null default gen_random_uuid()::text,
  notes text,
  booked_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_calls_status_check check (status in ('booked','completed','cancelled','no_show')),
  constraint sales_calls_window_check check (scheduled_end > scheduled_start)
);

create unique index if not exists sales_calls_slot_unique
  on public.sales_calls (scheduled_start)
  where status = 'booked';

create index if not exists sales_calls_org_idx on public.sales_calls (organization_id, scheduled_start desc);
create index if not exists sales_calls_position_idx on public.sales_calls (position_id);

grant select, insert, update on public.sales_calls to authenticated;
grant all on public.sales_calls to service_role;

alter table public.sales_calls enable row level security;

drop policy if exists "Org members read their own calls" on public.sales_calls;
create policy "Org members read their own calls"
  on public.sales_calls for select to authenticated
  using (public.is_org_member(auth.uid(), organization_id) or public.is_platform_staff(auth.uid()));

drop policy if exists "Org members book their own calls" on public.sales_calls;
create policy "Org members book their own calls"
  on public.sales_calls for insert to authenticated
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_platform_staff(auth.uid()));

drop policy if exists "Org members and staff update their own calls" on public.sales_calls;
create policy "Org members and staff update their own calls"
  on public.sales_calls for update to authenticated
  using (public.is_org_member(auth.uid(), organization_id) or public.is_platform_staff(auth.uid()))
  with check (public.is_org_member(auth.uid(), organization_id) or public.is_platform_staff(auth.uid()));

alter table public.positions
  add column if not exists start_approved_by uuid,
  add column if not exists start_approved_at timestamptz,
  add column if not exists start_approval_reason text;

alter table public.intake_submissions
  add column if not exists lead_status text not null default 'open',
  add column if not exists lead_closed_at timestamptz,
  add column if not exists lead_closed_by uuid,
  add column if not exists lead_close_reason text;

alter table public.intake_submissions
  drop constraint if exists intake_submissions_lead_status_check;
alter table public.intake_submissions
  add constraint intake_submissions_lead_status_check
  check (lead_status in ('open','won','closed'));