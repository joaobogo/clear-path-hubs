-- 1) Guard: block client-side users from changing staff-controlled columns.
create or replace function public.enforce_staff_only_columns()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  col text;
  o jsonb := to_jsonb(OLD);
  n jsonb := to_jsonb(NEW);
begin
  -- Server-side/privileged contexts (service role, triggers, jobs) have no auth.uid().
  if auth.uid() is null or public.is_platform_staff(auth.uid()) then
    return NEW;
  end if;

  foreach col in array TG_ARGV loop
    if (o -> col) is distinct from (n -> col) then
      raise exception 'Field % is staff-controlled and cannot be changed here', col
        using errcode = '42501';
    end if;
  end loop;

  return NEW;
end;
$$;

revoke all on function public.enforce_staff_only_columns() from public, anon, authenticated;

drop trigger if exists trg_candidate_matches_staff_columns on public.candidate_matches;
create trigger trg_candidate_matches_staff_columns
before update on public.candidate_matches
for each row execute function public.enforce_staff_only_columns(
  'admin_status','client_visibility','canonical_state','eligibility_status','eligibility_updated_at',
  'evidence_confidence','recommendation','recommendation_reason','recommendation_updated_at',
  'integrity_status','contact_released_at','contact_released_by','contact_release_reason',
  'current_score_run_id','approved_score_run_id','processing_state','processing_error_code',
  'processing_error_message','last_processing_trace_id','organization_id','position_id',
  'candidate_profile_id','application_id','is_test_record','test_run_id','delivered_at',
  'submitted_to_client_at','expires_at'
);

drop trigger if exists trg_hire_records_staff_columns on public.hire_records;
create trigger trg_hire_records_staff_columns
before update on public.hire_records
for each row execute function public.enforce_staff_only_columns(
  'candidate_match_id','organization_id','position_id','candidate_profile_id','application_id',
  'created_by','guarantee_days','guarantee_starts_on','guarantee_ends_on','guarantee_terms',
  'guarantee_visible_to_client'
);

drop trigger if exists trg_interviews_staff_columns on public.interviews;
create trigger trg_interviews_staff_columns
before update on public.interviews
for each row execute function public.enforce_staff_only_columns(
  'candidate_match_id','organization_id','position_id','candidate_submission_id','created_by',
  'requested_by_user_id','candidate_response','candidate_response_at','candidate_selected_time',
  'candidate_note','admin_coordination_required'
);

drop trigger if exists trg_client_decisions_staff_columns on public.client_decisions;
create trigger trg_client_decisions_staff_columns
before update on public.client_decisions
for each row execute function public.enforce_staff_only_columns(
  'candidate_match_id','organization_id','decision','actor_user_id','recorded_by_staff',
  'recorded_by_user_id','from_stage'
);

drop trigger if exists trg_interview_scorecards_staff_columns on public.interview_scorecards;
create trigger trg_interview_scorecards_staff_columns
before update on public.interview_scorecards
for each row execute function public.enforce_staff_only_columns(
  'interview_id','candidate_match_id','organization_id','position_id','reviewer_user_id'
);

-- 2) eligibility_checks: writes become staff-only; org members keep read access.
drop policy if exists "editors manage eligibility checks" on public.eligibility_checks;

create policy "staff insert eligibility checks"
on public.eligibility_checks
for insert
to authenticated
with check (public.is_platform_staff(auth.uid()));

create policy "staff update eligibility checks"
on public.eligibility_checks
for update
to authenticated
using (public.is_platform_staff(auth.uid()))
with check (public.is_platform_staff(auth.uid()));

create policy "staff delete eligibility checks"
on public.eligibility_checks
for delete
to authenticated
using (public.is_platform_staff(auth.uid()));

-- 3) Remove anonymous EXECUTE on privileged functions that are not public API.
revoke all on function public.is_match_assigned_interviewer(uuid, uuid) from anon;
revoke all on function public.purge_expired_intake_drafts() from public, anon, authenticated;
revoke all on function public.tg_end_assignment_on_feedback() from public, anon, authenticated;
revoke all on function public.tg_end_assignments_on_decline() from public, anon, authenticated;