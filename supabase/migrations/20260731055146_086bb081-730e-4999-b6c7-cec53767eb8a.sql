ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS closure_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_candidate_edit_at timestamptz;

CREATE INDEX IF NOT EXISTS applications_closure_pending_idx
  ON public.applications (closure_notified_at)
  WHERE closure_notified_at IS NULL;