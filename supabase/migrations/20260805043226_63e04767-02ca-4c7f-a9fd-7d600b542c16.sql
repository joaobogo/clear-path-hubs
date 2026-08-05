alter table public.score_decisions add column if not exists reason_code text;
alter table public.score_decisions add column if not exists stage_at_decision text;

create index if not exists score_decisions_reason_code_idx on public.score_decisions (reason_code) where reason_code is not null;
create index if not exists client_decisions_reason_code_idx on public.client_decisions (reason_code) where reason_code is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'score_decisions_reject_requires_reason') then
    alter table public.score_decisions
      add constraint score_decisions_reject_requires_reason
      check (decision_type <> 'reject'::score_decision_type or (reason_code is not null and length(btrim(reason_code)) > 0))
      not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'client_decisions_decline_requires_reason') then
    alter table public.client_decisions
      add constraint client_decisions_decline_requires_reason
      check (decision <> 'not_moving_forward'::client_decision_type or (reason_code is not null and length(btrim(reason_code)) > 0))
      not valid;
  end if;
end $$;

create or replace view public.v_rejection_decisions
with (security_invoker = on) as
select
  cd.id as decision_id,
  'client'::text as surface,
  cd.candidate_match_id as match_id,
  cm.organization_id,
  cm.position_id,
  cd.reason_code,
  cd.feedback as detail,
  cd.actor_user_id,
  coalesce(cd.from_stage, cm.stage::text) as stage_at_decision,
  cd.created_at
from public.client_decisions cd
join public.candidate_matches cm on cm.id = cd.candidate_match_id
where cd.decision = 'not_moving_forward'::client_decision_type
  and cd.reversed_at is null
union all
select
  sd.id as decision_id,
  'admin'::text as surface,
  sd.candidate_match_id as match_id,
  cm.organization_id,
  cm.position_id,
  sd.reason_code,
  sd.reason as detail,
  sd.actor_user_id,
  coalesce(sd.stage_at_decision, cm.stage::text) as stage_at_decision,
  sd.created_at
from public.score_decisions sd
join public.candidate_matches cm on cm.id = sd.candidate_match_id
where sd.decision_type = 'reject'::score_decision_type;

grant select on public.v_rejection_decisions to authenticated;
grant select on public.v_rejection_decisions to service_role;