-- Position-grain: intake (submitted_at) -> first candidate delivered to the client.
create or replace view public.v_position_time_to_submission
with (security_invoker = on) as
select
  p.id as position_id,
  p.organization_id,
  p.title as position_title,
  public.role_family_of(p.title) as role_family,
  p.submitted_at as intake_at,
  d.first_delivered_at,
  case
    when p.submitted_at is not null and d.first_delivered_at is not null
      then greatest(0::numeric, extract(epoch from (d.first_delivered_at - p.submitted_at)) / 86400.0)
    else null
  end as days_intake_to_first_submission
from public.positions p
left join (
  select cm.position_id, min(cm.delivered_at) as first_delivered_at
  from public.candidate_matches cm
  where cm.delivered_at is not null
  group by cm.position_id
) d on d.position_id = p.id;

grant select on public.v_position_time_to_submission to authenticated;
grant select on public.v_position_time_to_submission to service_role;

-- Match-grain: the downstream milestones, one row per candidate on a role.
create or replace view public.v_match_milestone_timings
with (security_invoker = on) as
with first_decision as (
  select cd.candidate_match_id, min(cd.created_at) as decided_at
  from public.client_decisions cd
  where cd.reversed_at is null
    and cd.decision in (
      'shortlist'::client_decision_type,
      'request_interview'::client_decision_type,
      'not_moving_forward'::client_decision_type,
      'hire'::client_decision_type,
      'offer'::client_decision_type
    )
  group by cd.candidate_match_id
),
iv as (
  select
    i.candidate_match_id,
    min(i.scheduled_at) as first_scheduled_at,
    max(i.completed_at) as last_completed_at
  from public.interviews i
  where i.cancelled_at is null
  group by i.candidate_match_id
),
hr as (
  select
    h.candidate_match_id,
    min(h.sent_at) as offer_sent_at,
    min(h.start_date) as start_date
  from public.hire_records h
  group by h.candidate_match_id
)
select
  cm.id as match_id,
  cm.organization_id,
  cm.position_id,
  p.title as position_title,
  public.role_family_of(p.title) as role_family,
  cm.delivered_at,
  fd.decided_at,
  iv.first_scheduled_at,
  iv.last_completed_at,
  hr.offer_sent_at,
  hr.start_date,
  case when cm.delivered_at is not null and fd.decided_at is not null
    then greatest(0::numeric, extract(epoch from (fd.decided_at - cm.delivered_at)) / 86400.0) end
    as days_submission_to_decision,
  case when fd.decided_at is not null and iv.first_scheduled_at is not null
    then greatest(0::numeric, extract(epoch from (iv.first_scheduled_at - fd.decided_at)) / 86400.0) end
    as days_decision_to_interview,
  case when iv.last_completed_at is not null and hr.offer_sent_at is not null
    then greatest(0::numeric, extract(epoch from (hr.offer_sent_at - iv.last_completed_at)) / 86400.0) end
    as days_interview_to_offer,
  case when hr.offer_sent_at is not null and hr.start_date is not null
    then greatest(0::numeric, extract(epoch from ((hr.start_date::timestamptz) - hr.offer_sent_at)) / 86400.0) end
    as days_offer_to_start
from public.candidate_matches cm
join public.positions p on p.id = cm.position_id
left join first_decision fd on fd.candidate_match_id = cm.id
left join iv on iv.candidate_match_id = cm.id
left join hr on hr.candidate_match_id = cm.id;

grant select on public.v_match_milestone_timings to authenticated;
grant select on public.v_match_milestone_timings to service_role;