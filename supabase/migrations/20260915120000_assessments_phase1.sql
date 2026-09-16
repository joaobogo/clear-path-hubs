-- Psychometric assessments, Phase 1: the data model, behind a flag that is off.
--
-- Clients are asking for assessments (audit 15 Sep, §5 / PSY-001). The design
-- decision recorded there, and the one this migration implements, is that an
-- assessment is a PARALLEL, clearly-labelled signal that a human reviews — it
-- never touches the evidence score.
--
-- The single most important property of these tables is what they are NOT
-- connected to. Nothing here is read by the scoring engine, the publish gate,
-- or the Fit band. There is no foreign key from candidate_matches into any of
-- them, no column added to candidate_matches, and no trigger. A scoring run
-- with the flag on must produce a byte-identical score to one with it off, and
-- the only way to guarantee that is for the score path to have nothing to read.
--
-- Everything is additive. With assessments_enabled = false — which is the
-- default, for every organisation, including existing ones — the product
-- behaves exactly as it does today.

-- ─── The per-organisation switch ─────────────────────────────────────────────
-- Off by default and off for every row that already exists. An organisation
-- opts in deliberately; nothing opts in on its behalf.
alter table public.organizations
  add column if not exists assessments_enabled boolean not null default false;

comment on column public.organizations.assessments_enabled is
  'Phase 1 psychometric assessments. Off by default. Never read by scoring.';

-- ─── What a role asks for ────────────────────────────────────────────────────
create table if not exists public.assessment_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  vendor text not null,
  instrument text not null,
  config_json jsonb not null default '{}'::jsonb,
  -- "Required" gates the SHORTLIST conversation, never the publish gate and
  -- never the score. A role can be published with an assessment outstanding.
  required_before_shortlist boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One instrument per role. Changing it is an update, not a second row.
  constraint assessment_definitions_one_per_position unique (position_id)
);

-- ─── Who was invited, and how far they got ───────────────────────────────────
create table if not exists public.assessment_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  definition_id uuid not null references public.assessment_definitions(id) on delete cascade,
  candidate_match_id uuid not null references public.candidate_matches(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','sent','started','completed','expired','declined')),
  sent_at timestamptz,
  expires_at timestamptz,
  reminder_count integer not null default 0,
  invited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_invitations_one_per_match unique (candidate_match_id, definition_id)
);

-- ─── The result, which a human releases ──────────────────────────────────────
create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invitation_id uuid not null references public.assessment_invitations(id) on delete cascade,
  band text,
  percentile numeric,
  raw_json jsonb not null default '{}'::jsonb,
  vendor_report_url text,
  -- Until reviewed_by is set, the client sees nothing. A result never reaches
  -- an employer without a person having looked at it first.
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_results_one_per_invitation unique (invitation_id)
);

-- ─── Consent, recorded per candidate per invitation ──────────────────────────
create table if not exists public.assessment_consent (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invitation_id uuid not null references public.assessment_invitations(id) on delete cascade,
  consented boolean not null,
  version text not null,
  accommodation_requested boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─── Trail ───────────────────────────────────────────────────────────────────
create table if not exists public.assessment_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  actor uuid,
  action text not null,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create index if not exists assessment_definitions_org_idx on public.assessment_definitions(organization_id);
create index if not exists assessment_invitations_org_idx on public.assessment_invitations(organization_id);
create index if not exists assessment_invitations_match_idx on public.assessment_invitations(candidate_match_id);
create index if not exists assessment_results_org_idx on public.assessment_results(organization_id);
create index if not exists assessment_audit_org_idx on public.assessment_audit(organization_id);

-- ─── Access ──────────────────────────────────────────────────────────────────
-- Staff manage everything. A client may READ its own organisation's rows and
-- nothing else: results are released by staff, so a client has no write here.
-- Candidate-facing writes go through service_role from the invite endpoint.

alter table public.assessment_definitions enable row level security;
alter table public.assessment_invitations enable row level security;
alter table public.assessment_results enable row level security;
alter table public.assessment_consent enable row level security;
alter table public.assessment_audit enable row level security;

grant select on public.assessment_definitions to authenticated;
grant select on public.assessment_invitations to authenticated;
grant select on public.assessment_results to authenticated;
grant select on public.assessment_consent to authenticated;
grant select on public.assessment_audit to authenticated;
grant all on public.assessment_definitions to service_role;
grant all on public.assessment_invitations to service_role;
grant all on public.assessment_results to service_role;
grant all on public.assessment_consent to service_role;
grant all on public.assessment_audit to service_role;

drop policy if exists "staff manage assessment definitions" on public.assessment_definitions;
create policy "staff manage assessment definitions"
  on public.assessment_definitions for all to authenticated
  using (public.is_platform_staff(auth.uid()))
  with check (public.is_platform_staff(auth.uid()));

drop policy if exists "client reads own assessment definitions" on public.assessment_definitions;
create policy "client reads own assessment definitions"
  on public.assessment_definitions for select to authenticated
  using (public.has_client_permission(auth.uid(), organization_id, 'view_candidates'::client_permission));

drop policy if exists "staff manage assessment invitations" on public.assessment_invitations;
create policy "staff manage assessment invitations"
  on public.assessment_invitations for all to authenticated
  using (public.is_platform_staff(auth.uid()))
  with check (public.is_platform_staff(auth.uid()));

drop policy if exists "client reads own assessment invitations" on public.assessment_invitations;
create policy "client reads own assessment invitations"
  on public.assessment_invitations for select to authenticated
  using (public.has_client_permission(auth.uid(), organization_id, 'view_candidates'::client_permission));

drop policy if exists "staff manage assessment results" on public.assessment_results;
create policy "staff manage assessment results"
  on public.assessment_results for all to authenticated
  using (public.is_platform_staff(auth.uid()))
  with check (public.is_platform_staff(auth.uid()));

-- A client sees a result only once a person has reviewed it. This is the
-- human-in-the-loop rule, enforced in the database rather than in a component
-- that could be bypassed by a different query.
drop policy if exists "client reads reviewed assessment results" on public.assessment_results;
create policy "client reads reviewed assessment results"
  on public.assessment_results for select to authenticated
  using (
    reviewed_by is not null
    and public.has_client_permission(auth.uid(), organization_id, 'view_candidates'::client_permission)
  );

drop policy if exists "staff manage assessment consent" on public.assessment_consent;
create policy "staff manage assessment consent"
  on public.assessment_consent for all to authenticated
  using (public.is_platform_staff(auth.uid()))
  with check (public.is_platform_staff(auth.uid()));

drop policy if exists "staff read assessment audit" on public.assessment_audit;
create policy "staff read assessment audit"
  on public.assessment_audit for select to authenticated
  using (public.is_platform_staff(auth.uid()));
