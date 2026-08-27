-- Loom intro video on a candidate's client-facing profile.
--
-- Stored on candidate_matches, not on the candidate profile: the video belongs
-- to what the recruiting team shares with one client, and candidates never read
-- match rows, so nothing about it can reach a candidate's own view.
alter table public.candidate_matches
  add column if not exists intro_video_url text,
  add column if not exists intro_video_added_by uuid references auth.users(id) on delete set null,
  add column if not exists intro_video_added_at timestamptz;

-- Only a genuine Loom share link may be stored, enforced at the row level so no
-- write path can smuggle another host in.
alter table public.candidate_matches
  drop constraint if exists candidate_matches_intro_video_is_loom;
alter table public.candidate_matches
  add constraint candidate_matches_intro_video_is_loom
  check (
    intro_video_url is null
    or intro_video_url ~ '^https://www\.loom\.com/share/[0-9a-zA-Z]{16,64}$'
  );

comment on column public.candidate_matches.intro_video_url is
  'Loom share link shown on the client-facing profile. Staff-controlled; never exposed to the candidate or the public job board.';

-- The video is attached by the recruiting team only: clients may read the row
-- but must not be able to set, change or clear the link.
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
  'submitted_to_client_at','expires_at',
  'intro_video_url','intro_video_added_by','intro_video_added_at'
);