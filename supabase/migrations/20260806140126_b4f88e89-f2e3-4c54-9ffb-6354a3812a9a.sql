alter table public.interviews
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_1h_sent_at timestamptz,
  add column if not exists no_show_flagged_at timestamptz;

alter table public.candidate_profiles
  add column if not exists gap_nudge_count integer not null default 0,
  add column if not exists gap_nudge_last_at timestamptz;

create index if not exists interviews_reminder_scan_idx
  on public.interviews (scheduled_at)
  where status = 'scheduled';